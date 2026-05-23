"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// Pure helpers — defined outside component to avoid recreating on every render
const stripNumberPrefix = (title) => title.replace(/^\d+(?:\.\d+)?\s*\.?\s*/, "");

const renumberSubsections = (content, sectionNum) => {
  const hasH3 = /^###\s+\d+(?:\.\d+)?\s/m.test(content);
  const hasBold = /^\*\*\d+(?:\.\d+)\s/m.test(content);

  let subCounter = 1;
  let result = content;

  if (hasH3) {
    result = result.replace(
      /^(###\s+)\d+(?:\.\d+)?\s*/gm,
      () => `### ${sectionNum}.${subCounter++} `
    );
  }

  if (hasBold) {
    let boldCounter = hasH3 ? subCounter : 1;
    result = result.replace(
      /^(\*\*)\d+(?:\.\d+)\s+/gm,
      (match, stars) => `${stars}${sectionNum}.${boldCounter++} `
    );
  }

  return result;
};

export default function ProposalViewPage() {
  const params = useParams();
  const router = useRouter();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(0);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("sections");
  const [editingSection, setEditingSection] = useState(null);
  const [editedSections, setEditedSections] = useState({});
  const [savingSection, setSavingSection] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const html2pdfScriptLoaded = useRef(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    async function fetchProposal() {
      try {
        const res = await fetch(`/api/proposals/${params.id}`);
        if (!res.ok) throw new Error("Proposal not found");
        const data = await res.json();
        setProposal(data.proposal);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchProposal();
  }, [params.id]);

  // Derive effective deadline — fall back to extracted data if Airtable field is empty
  const effectiveDeadline = useMemo(() => {
    if (!proposal) return null;
    if (proposal.deadline) return proposal.deadline;
    const ed = proposal.extractedData || {};
    const rawKey = Object.keys(ed).find(k => /submission\s*deadline\s*raw/i.test(k));
    const fmtKey = Object.keys(ed).find(k => /^submission\s*deadline$/i.test(k));
    return (fmtKey && ed[fmtKey]) || (rawKey && ed[rawKey]) || null;
  }, [proposal]);

  const parseSections = (draft) => {
    if (!draft) return [{ title: "Draft", content: "No draft generated yet." }];

    // Strip any leading/trailing markdown code fences the AI may have added
    let cleaned = draft.trim();
    cleaned = cleaned.replace(/^```(?:markdown|md)?\s*\n/i, "");
    cleaned = cleaned.replace(/\n```\s*$/i, "");
    cleaned = cleaned.replace(/^```(?:markdown|md)?\s*$/gim, "");

    const sections = [];
    const parts = cleaned.split(/^## /m);

    for (const part of parts) {
      if (!part.trim()) continue;
      const newlineIdx = part.indexOf("\n");
      if (newlineIdx === -1) {
        sections.push({ title: stripNumberPrefix(part.trim()), content: "" });
      } else {
        sections.push({
          title: stripNumberPrefix(part.substring(0, newlineIdx).trim()),
          content: part.substring(newlineIdx + 1).trim(),
        });
      }
    }

    return sections.length > 0
      ? sections
      : [{ title: "Full Draft", content: draft }];
  };

  const reassembleDraft = useCallback((sectionArray) => {
    return sectionArray
      .map((s, i) => {
        const num = i + 1;
        const updatedContent = renumberSubsections(s.content || "", num);
        return `## ${num}. ${stripNumberPrefix(s.title)}\n${updatedContent}`;
      })
      .join("\n\n");
  }, []);

  const reorderSections = useCallback(async (fromIndex, toIndex) => {
    if (!proposal || fromIndex === toIndex) return;
    setReordering(true);
    try {
      const currentSections = parseSections(proposal.generatedDraft);
      const reordered = [...currentSections];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      const newDraft = reassembleDraft(reordered);

      const res = await fetch(`/api/proposals/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedDraft: newDraft, status: proposal.status || "Ready for Review" }),
      });
      if (!res.ok) throw new Error("Failed to reorder sections");

      const refreshRes = await fetch(`/api/proposals/${params.id}`);
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setProposal(data.proposal);
      }

      if (activeSection === fromIndex) {
        setActiveSection(toIndex);
      } else if (fromIndex < activeSection && toIndex >= activeSection) {
        setActiveSection(activeSection - 1);
      } else if (fromIndex > activeSection && toIndex <= activeSection) {
        setActiveSection(activeSection + 1);
      }
    } catch (err) {
      console.error("Reorder failed:", err);
    } finally {
      setReordering(false);
    }
  }, [proposal, params.id, activeSection, reassembleDraft]);

  const saveSection = useCallback(async (sectionIndex) => {
    if (!proposal || !editedSections[sectionIndex]) return;

    setSavingSection(sectionIndex);
    setSaveStatus("saving");

    try {
      const currentSections = parseSections(proposal.generatedDraft);
      const updatedSections = currentSections.map((s, i) =>
        i === sectionIndex
          ? { ...s, content: editedSections[sectionIndex] }
          : s
      );

      const newDraft = reassembleDraft(updatedSections);

      const res = await fetch(`/api/proposals/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedDraft: newDraft, status: proposal.status || "Ready for Review" }),
      });

      if (!res.ok) throw new Error("Failed to save section");

      const refreshRes = await fetch(`/api/proposals/${params.id}`);
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        setProposal(refreshData.proposal);
      }
      setEditedSections((prev) => {
        const updated = { ...prev };
        delete updated[sectionIndex];
        return updated;
      });
      setEditingSection(null);
      setSaveStatus("saved");

      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      setSaveStatus("error");
      console.error("Save error:", err);
      setTimeout(() => setSaveStatus(null), 2000);
    } finally {
      setSavingSection(null);
    }
  }, [proposal, editedSections, params.id, reassembleDraft]);

  const runScoreAnalysis = useCallback(async () => {
    if (!proposal) return;

    setLoadingScore(true);
    try {
      const res = await fetch(`/api/proposals/${params.id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedData: proposal.extractedData,
          generatedDraft: proposal.generatedDraft,
        }),
      });

      if (!res.ok) throw new Error("Failed to run score analysis");
      const data = await res.json();
      setScoreData(data.score || data);
    } catch (err) {
      console.error("Score error:", err);
    } finally {
      setLoadingScore(false);
    }
  }, [proposal, params.id]);

  const loadHtml2Pdf = useCallback(async () => {
    return new Promise((resolve) => {
      if (window.html2pdf) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = () => resolve();
      script.onerror = () => {
        console.error("Failed to load html2pdf");
        resolve();
      };
      document.head.appendChild(script);
    });
  }, []);

  // Shared helper: convert markdown tables to styled HTML tables for export.
  const convertMarkdownTables = (text, opts = {}) => {
    const { forWord = false } = opts;
    const tableStyle = forWord
      ? 'width:100%;border-collapse:collapse;margin:8pt 0;font-size:10.5pt;border:1px solid #666;'
      : 'width:100%;border-collapse:collapse;margin:10px 0;font-size:10.5pt;border:1px solid #666;';
    const thStyle = forWord
      ? 'padding:6pt 8pt;text-align:left;border:1px solid #666;background:#f2f2f2;font-weight:bold;color:#000;'
      : 'padding:6px 10px;text-align:left;border:1px solid #666;background:#f2f2f2;font-weight:bold;color:#000;';
    const tdStyle = forWord
      ? 'padding:6pt 8pt;border:1px solid #666;vertical-align:top;'
      : 'padding:6px 10px;border:1px solid #666;vertical-align:top;';

    return text.replace(
      /(?:^|\n)([ \t]*\|[^\n]+\|[ \t]*)\n([ \t]*\|[\s\-:|]+\|[ \t]*)\n((?:[ \t]*\|[^\n]+\|[ \t]*(?:\n|$))+)/g,
      (match, header, separator, body) => {
        const thCells = header.trim().split("|").filter(c => c.trim()).map(c => `<th style="${thStyle}">${c.trim()}</th>`).join("");
        const rows = body.trim().split("\n").map(row => {
          const cells = row.trim().split("|").filter(c => c.trim()).map(c => `<td style="${tdStyle}">${c.trim()}</td>`).join("");
          return `<tr>${cells}</tr>`;
        }).join("");
        return `\n<table style="${tableStyle}"><thead><tr>${thCells}</tr></thead><tbody>${rows}</tbody></table>\n`;
      }
    );
  };

  // isCoverLetter removed in v3.1 — cover letter no longer generated

  const exportPDF = useCallback(async () => {
    if (!proposal) return;

    await loadHtml2Pdf();

    if (!window.html2pdf) {
      alert("PDF export library failed to load. Please try again.");
      return;
    }

    const currentSections = parseSections(proposal.generatedDraft);
    const extracted = proposal.extractedData || {};
    const clientName = extracted.clientName || extracted.client || extracted.agency || extracted.organization || "";
    const projectName = extracted.projectName || extracted.projectTitle || extracted.project || proposal.rfpName || "";
    const location = extracted.location || extracted.projectLocation || "";
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const content = document.createElement("div");
    content.style.padding = "40px";
    content.style.fontFamily = "'Arial', sans-serif";
    content.style.fontSize = "11pt";
    content.style.lineHeight = "1.5";
    content.style.color = "#333";

    const proposalSections = currentSections;

    // Proposal letterhead — text-based logo
    const logoText = document.createElement("div");
    logoText.style.fontFamily = "Arial Black, Impact, Helvetica, sans-serif";
    logoText.style.fontWeight = "900";
    logoText.style.fontSize = "22pt";
    logoText.style.letterSpacing = "4px";
    logoText.style.color = "#000";
    logoText.style.lineHeight = "1.2";
    logoText.style.marginBottom = "8px";
    logoText.innerHTML = "OUTER<br>IMAGE";
    content.appendChild(logoText);

    const addressBlock = document.createElement("div");
    addressBlock.style.fontSize = "10.5pt";
    addressBlock.style.color = "#555";
    addressBlock.style.lineHeight = "1.5";
    addressBlock.innerHTML = `226 42nd Street<br>Brooklyn, NY 11232<br>212.661.2124<br><span style="color:#2C7A7B">www.outerimage.com</span>`;
    content.appendChild(addressBlock);

    const divider = document.createElement("hr");
    divider.style.border = "none";
    divider.style.borderTop = "1.5px solid #999";
    divider.style.margin = "16px 0 20px 0";
    content.appendChild(divider);

    // Proposal block
    const proposalLabel = document.createElement("div");
    proposalLabel.textContent = "Proposal";
    proposalLabel.style.fontSize = "14pt";
    proposalLabel.style.fontWeight = "bold";
    proposalLabel.style.border = "2px solid #003366";
    proposalLabel.style.padding = "12px 16px";
    proposalLabel.style.display = "inline-block";
    proposalLabel.style.marginBottom = "16px";
    content.appendChild(proposalLabel);

    const detailsBlock = document.createElement("div");
    detailsBlock.style.marginLeft = "16px";
    detailsBlock.style.marginBottom = "16px";
    let detailsHtml = `<div style="font-weight:bold;font-size:10.5pt;color:#555;margin-bottom:10px;">Project Details</div>`;
    if (clientName) detailsHtml += `<div style="font-size:10.5pt;color:#333;">Client: ${clientName}</div>`;
    detailsHtml += `<div style="font-size:10.5pt;color:#333;">Project: ${projectName}</div>`;
    if (location) detailsHtml += `<div style="font-size:10.5pt;color:#333;">Location: ${location}</div>`;
    detailsHtml += `<div style="font-size:10.5pt;color:#333;margin-top:10px;">Date: ${today}</div>`;
    detailsBlock.innerHTML = detailsHtml;
    content.appendChild(detailsBlock);

    const metaInfo = document.createElement("div");
    metaInfo.style.fontSize = "10pt";
    metaInfo.style.color = "#718096";
    metaInfo.style.margin = "0 0 20px 0";
    const fmtDeadline = (() => {
      if (!effectiveDeadline) return null;
      const d = new Date(effectiveDeadline);
      return isNaN(d.getTime()) ? effectiveDeadline : d.toLocaleDateString();
    })();
    const metaText = [
      proposal.serviceLine && `Service Line: ${proposal.serviceLine}`,
      fmtDeadline && `Deadline: ${fmtDeadline}`,
      `Status: ${proposal.status}`,
    ]
      .filter(Boolean)
      .join(" | ");
    metaInfo.textContent = metaText;
    content.appendChild(metaInfo);

    proposalSections.forEach((section, idx) => {
      const sectionTitle = document.createElement("h2");
      sectionTitle.textContent = `${idx + 1}. ${section.title}`;
      sectionTitle.style.color = "#0F2027";
      sectionTitle.style.fontSize = "14pt";
      sectionTitle.style.fontWeight = "bold";
      sectionTitle.style.marginTop = "32px";
      sectionTitle.style.marginBottom = "12px";
      sectionTitle.style.borderBottom = "1px solid #E2E8F0";
      sectionTitle.style.paddingBottom = "5px";
      content.appendChild(sectionTitle);

      const sectionContent = document.createElement("div");
      sectionContent.style.marginBottom = "20px";

      let rawContent = convertMarkdownTables(renumberSubsections(section.content || "", idx + 1), { forWord: false });
      const tableBlocks = [];
      rawContent = rawContent.replace(/<table[\s\S]*?<\/table>/gi, (m) => {
        tableBlocks.push(m);
        return `__TABLE_BLOCK_${tableBlocks.length - 1}__`;
      });

      let processed = rawContent
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/^### (.+)$/gm, '<strong style="font-size:12pt">$1</strong>')
        .replace(/\n\n+/g, "</p><p>")
        .replace(/\n/g, "<br>")
        .split(/(?=<p>)/)
        .map(
          (line) =>
            (line.startsWith("<") ? line : `<p>${line}</p>`).replace(
              /^<p><p>/,
              "<p>"
            )
        )
        .join("");

      tableBlocks.forEach((block, i) => {
        processed = processed.replace(`__TABLE_BLOCK_${i}__`, block);
      });

      sectionContent.innerHTML = processed;
      content.appendChild(sectionContent);
    });

    const options = {
      margin: 20,
      filename: `${(proposal.rfpName || "proposal").replace(/[^a-zA-Z0-9]/g, "-")}-proposal.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().set(options).from(content).save();
  }, [proposal, loadHtml2Pdf, effectiveDeadline]);

  const exportWord = useCallback(() => {
    if (!proposal) return;

    const currentSections = parseSections(proposal.generatedDraft);
    const extracted = proposal.extractedData || {};

    const clientName = extracted.clientName || extracted.client || extracted.agency || extracted.organization || "";
    const projectName = extracted.projectName || extracted.projectTitle || extracted.project || proposal.rfpName || "";
    const location = extracted.location || extracted.projectLocation || "";
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const proposalSections = currentSections;

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${proposal.rfpName}</title>
      <style>
        @page { margin: 1in 1in 1in 1in; }
        body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.4; color: #333; }
        .letterhead { margin-bottom: 8pt; }
        .logo-text { font-family: Arial Black, Impact, Helvetica, sans-serif; font-weight: 900; font-size: 22pt; letter-spacing: 4px; color: #000; line-height: 1.2; margin: 0 0 8pt 0; }
        .address { font-size: 10.5pt; color: #555; line-height: 1.5; margin: 0 0 2pt 0; }
        .address a { color: #2C7A7B; text-decoration: none; }
        .divider { border: none; border-top: 1.5px solid #999; margin: 16pt 0 20pt 0; }
        .proposal-label { font-family: Arial, sans-serif; font-size: 14pt; font-weight: bold; color: #000; margin: 0 0 16pt 0; border: 2px solid #003366; padding: 12pt 16pt; display: inline-block; }
        .project-details { margin: 16pt 0 6pt 16pt; }
        .project-details .label { font-size: 10.5pt; color: #555; margin: 0 0 10pt 0; }
        .project-details .field { font-size: 10.5pt; color: #333; margin: 0 0 2pt 0; }
        .project-date { font-size: 10.5pt; color: #333; margin: 12pt 0 24pt 16pt; }
        h2 { font-size: 13pt; color: #000; font-weight: bold; margin: 28pt 0 8pt 0; border-bottom: 1px solid #ccc; padding-bottom: 4pt; }
        h3 { font-size: 12pt; color: #333; font-weight: bold; margin: 14pt 0 4pt 0; }
        h4 { font-size: 11pt; color: #333; font-weight: bold; margin: 10pt 0 4pt 0; }
        p { margin: 0 0 6pt 0; font-size: 11pt; }
        .section-content { margin-left: 0; }
        .page-break { page-break-after: always; }
      </style></head><body>`;

    // Proposal letterhead
    html += `<div class="letterhead">`;
    html += `<div class="logo-text">OUTER<br>IMAGE</div>`;
    html += `<p class="address">226 42nd Street</p>`;
    html += `<p class="address">Brooklyn, NY 11232</p>`;
    html += `<p class="address">212.661.2124</p>`;
    html += `<p class="address"><a href="http://www.outerimage.com">www.outerimage.com</a></p>`;
    html += `</div>`;
    html += `<hr class="divider">`;

    // Proposal header block
    html += `<div class="proposal-label">Proposal</div>`;
    html += `<div class="project-details">`;
    html += `<p class="label" style="font-weight:bold;">Project Details</p>`;
    if (clientName) html += `<p class="field">Client: ${clientName}</p>`;
    html += `<p class="field">Project: ${projectName}</p>`;
    if (location) html += `<p class="field">Location: ${location}</p>`;
    html += `</div>`;
    html += `<p class="project-date">Date: ${today}</p>`;

    // Service line + deadline meta
    const metaParts = [];
    if (proposal.serviceLine) metaParts.push(`Service Line: ${proposal.serviceLine}`);
    if (effectiveDeadline) {
      const wd = new Date(effectiveDeadline);
      metaParts.push(`Deadline: ${isNaN(wd.getTime()) ? effectiveDeadline : wd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
    }
    if (metaParts.length > 0) {
      html += `<p style="font-size:10pt;color:#718096;margin:0 0 16pt 0;">${metaParts.join(" &nbsp;|&nbsp; ")}</p>`;
    }

    // Proposal sections
    proposalSections.forEach((s, idx) => {
      html += `<h2>${idx + 1}. ${s.title}</h2>`;

      let sectionBody = convertMarkdownTables(renumberSubsections(s.content || "", idx + 1), { forWord: true });
      const tableBlocks = [];
      sectionBody = sectionBody.replace(/<table[\s\S]*?<\/table>/gi, (m) => {
        tableBlocks.push(m);
        return `\n\n__TABLE_BLOCK_${tableBlocks.length - 1}__\n\n`;
      });

      const paragraphs = sectionBody.split(/\n\n+/);
      paragraphs.forEach((p) => {
        const trimmed = p.trim();
        if (!trimmed) return;

        const tableMatch = trimmed.match(/^__TABLE_BLOCK_(\d+)__$/);
        if (tableMatch) {
          html += tableBlocks[parseInt(tableMatch[1], 10)];
          return;
        }

        let formatted = trimmed
          .replace(/^### (.+)$/gm, '<h4>$1</h4>')
          .replace(/^## (.+)$/gm, '<h3>$1</h3>')
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(/\n/g, "<br>");
        html += `<p>${formatted}</p>`;
      });
    });

    html += `</body></html>`;

    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(proposal.rfpName || "proposal").replace(/[^a-zA-Z0-9]/g, "-")}-draft.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [proposal, effectiveDeadline]);

  if (loading) {
    return (
      <div className="max-w-[960px] mx-auto px-6 py-12 text-center text-gray-400">
        Loading proposal...
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="max-w-[960px] mx-auto px-6 py-12 text-center">
        <div className="text-red-600 mb-4">{error || "Proposal not found"}</div>
        <Link href="/dashboard" className="text-neutral-600 font-medium">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const sections = parseSections(proposal.generatedDraft);
  const rawExtracted = proposal.extractedData || {};

  // Merge "Submission Deadline Raw" into "Submission Deadline" if the latter is empty,
  // then drop the raw key so we don't show a redundant field
  const extractedData = { ...rawExtracted };
  const dlRawKey = Object.keys(extractedData).find(k => /submission\s*deadline\s*raw/i.test(k));
  const dlKey = Object.keys(extractedData).find(k => /^submission\s*deadline$/i.test(k));
  if (dlRawKey && extractedData[dlRawKey]) {
    if (dlKey && !extractedData[dlKey]) {
      extractedData[dlKey] = extractedData[dlRawKey];
    }
    delete extractedData[dlRawKey]; // Remove redundant raw field from display
  }


  const currentSection = sections[activeSection];

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-12">
      {/* Back button */}
      <button
        onClick={() => router.push("/dashboard")}
        className="flex items-center gap-1.5 text-neutral-600 text-sm font-medium mb-6 bg-transparent border-none cursor-pointer p-0 hover:opacity-80"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <line strokeLinecap="round" strokeLinejoin="round" x1="19" y1="12" x2="5" y2="12" />
          <polyline
            strokeLinecap="round"
            strokeLinejoin="round"
            points="12 19 5 12 12 5"
          />
        </svg>
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-black">
              {proposal.rfpName}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
              ${proposal.status === "Ready for Review" ? "bg-neutral-800 text-white" : "bg-black text-white"}`}
            >
              {proposal.status}
            </span>
          </div>
          <div className="flex gap-4 text-[13px] text-gray-500 items-center">
            {proposal.serviceLine && (
              <span className="px-2.5 py-0.5 rounded-md border border-neutral-300 bg-neutral-100 text-neutral-700 text-[11px] font-semibold">
                {proposal.serviceLine}
              </span>
            )}
            {effectiveDeadline && (
              <span>
                Due{" "}
                {(() => {
                  const d = new Date(effectiveDeadline);
                  return isNaN(d.getTime())
                    ? effectiveDeadline  // Show raw text if not parseable
                    : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
                })()}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportPDF}
            className="px-5 py-2.5 rounded-lg bg-black text-white text-sm font-semibold hover:opacity-90 border-none cursor-pointer"
          >
            Export PDF
          </button>
          <button
            onClick={exportWord}
            className="px-5 py-2.5 rounded-lg bg-black text-white text-sm font-semibold hover:opacity-90 border-none cursor-pointer"
          >
            Export Draft
          </button>
        </div>
      </div>

      {/* View mode toggle */}
      <div className="flex gap-2 mb-8 bg-white rounded-lg border border-gray-200 p-1 w-fit">
        {["sections", "compare", "score"].map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all border-none cursor-pointer ${
              viewMode === mode
                ? "bg-black text-white"
                : "bg-transparent text-gray-600 hover:text-black"
            }`}
          >
            {mode === "sections" && "Sections"}
            {mode === "compare" && "Compare"}
            {mode === "score" && "Score"}
          </button>
        ))}
      </div>

      {/* Extracted data summary */}
      {(viewMode === "sections" || viewMode === "compare") &&
        Object.keys(extractedData).length > 0 && (
          <div className="rounded-xl border border-gray-200 p-5 mb-8 bg-gray-50">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Extracted RFP Data
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(extractedData).map(([key, val]) => (
                <div key={key}>
                  <div className="text-[11px] font-semibold text-gray-400 mb-0.5 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </div>
                  <div className="text-[13px] text-gray-700 leading-relaxed">
                    {(() => {
                      const tryParse = (v) => {
                        if (typeof v !== "string") return v;
                        const trimmed = v.trim();
                        if (
                          (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
                          (trimmed.startsWith("[") && trimmed.endsWith("]"))
                        ) {
                          try {
                            return JSON.parse(trimmed);
                          } catch {}
                        }
                        return v;
                      };

                      const renderObject = (obj) => {
                        if (obj.name) {
                          return (
                            <>
                              <strong className="text-gray-900">{obj.name}</strong>
                              {obj.description ? <> — {obj.description}</> : ""}
                            </>
                          );
                        }
                        if (obj.criterion) {
                          return (
                            <>
                              <strong className="text-gray-900">{obj.criterion}</strong>
                              {obj.weight ? <span className="text-gray-400 ml-1">({obj.weight})</span> : ""}
                            </>
                          );
                        }
                        if (obj.title) {
                          const rest = Object.entries(obj)
                            .filter(([k]) => k !== "title")
                            .map(([, v]) => String(v))
                            .join(" · ");
                          return (
                            <>
                              <strong className="text-gray-900">{obj.title}</strong>
                              {rest ? <> — {rest}</> : ""}
                            </>
                          );
                        }
                        const entries = Object.entries(obj);
                        if (entries.length <= 3) {
                          const [first, ...rest] = entries;
                          return (
                            <>
                              <strong className="text-gray-900">{String(first[1])}</strong>
                              {rest.length > 0 ? <> — {rest.map(([, v]) => String(v)).join(" · ")}</> : ""}
                            </>
                          );
                        }
                        return entries.map(([k, v], j) => (
                          <span key={k}>
                            {j > 0 ? " · " : ""}
                            <strong className="text-gray-900">{k}:</strong> {String(v)}
                          </span>
                        ));
                      };

                      const renderItem = (item, i) => {
                        const parsed = tryParse(item);
                        return (
                          <div key={i} className="flex gap-2 mb-1.5">
                            <span className="text-gray-400 mt-px">•</span>
                            <span>
                              {typeof parsed === "object" && parsed !== null
                                ? renderObject(parsed)
                                : String(parsed)}
                            </span>
                          </div>
                        );
                      };

                      const parsed = tryParse(val);
                      if (Array.isArray(parsed)) {
                        return parsed.map((item, i) => renderItem(item, i));
                      }
                      if (typeof parsed === "object" && parsed !== null) {
                        return Object.entries(parsed).map(([k, v]) => (
                          <div key={k} className="mb-1">
                            <strong className="text-gray-900">{k.replace(/([A-Z])/g, " $1").trim()}:</strong> {String(v)}
                          </div>
                        ));
                      }
                      return String(val ?? "");
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* SECTIONS VIEW */}
      {viewMode === "sections" && (
        <div className="grid grid-cols-[200px_1fr] gap-6">
          {/* Section nav — drag to reorder */}
          <div className="flex flex-col gap-0.5">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 flex justify-between items-center">
              <span>Sections</span>
              {reordering && <span className="text-[10px] text-neutral-600 font-normal normal-case">Saving...</span>}
            </div>
            {sections.map((s, i) => (
              <button
                key={i}
                draggable
                onDragStart={(e) => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
                    reorderSections(dragIndex, dragOverIndex);
                  }
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(i);
                }}
                onDragLeave={() => {
                  if (dragOverIndex === i) setDragOverIndex(null);
                }}
                onClick={() => {
                  setActiveSection(i);
                  setEditingSection(null);
                }}
                className={`px-3 py-2.5 rounded-lg border-2 text-[13px] text-left cursor-grab transition-all flex items-center gap-2
                  ${activeSection === i
                    ? "bg-black text-white font-semibold border-transparent"
                    : "bg-transparent text-gray-600 hover:bg-gray-100 border-transparent"}
                  ${dragOverIndex === i && dragIndex !== i ? "border-black border-dashed" : ""}
                  ${dragIndex === i ? "opacity-40" : ""}
                  `}
              >
                <span className={`text-[10px] cursor-grab select-none ${activeSection === i ? "text-white/50" : "text-gray-300"}`}>☰</span>
                <span className="truncate">
                  {i + 1}. {s.title}
                </span>
              </button>
            ))}
          </div>

          {/* Content panel */}
          <div className="rounded-xl border border-gray-200 bg-white p-8 min-h-[400px]">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-black">
                {activeSection + 1}. {currentSection?.title}
              </h2>
              <button
                onClick={() => {
                  if (editingSection === activeSection) {
                    setEditingSection(null);
                  } else {
                    setEditingSection(activeSection);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-black text-white text-sm font-medium border-none cursor-pointer hover:opacity-90"
              >
                {editingSection === activeSection ? "Cancel" : "Edit"}
              </button>
            </div>

            {editingSection === activeSection ? (
              <div className="space-y-4">
                <textarea
                  value={
                    editedSections[activeSection] ||
                    (currentSection?.content || "")
                  }
                  onChange={(e) =>
                    setEditedSections((prev) => ({
                      ...prev,
                      [activeSection]: e.target.value,
                    }))
                  }
                  className="w-full min-h-[400px] p-4 border border-gray-300 rounded-lg font-mono text-sm text-gray-700 focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  placeholder="Enter markdown content..."
                />
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => saveSection(activeSection)}
                    disabled={savingSection === activeSection}
                    className="px-5 py-2.5 rounded-lg bg-black text-white text-sm font-semibold border-none cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {savingSection === activeSection ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Saving...
                      </>
                    ) : (
                      "Save Section"
                    )}
                  </button>
                  {saveStatus === "saved" && (
                    <span className="text-neutral-700 text-sm font-medium flex items-center gap-1">
                      ✓ Saved
                    </span>
                  )}
                  {saveStatus === "error" && (
                    <span className="text-red-600 text-sm font-medium flex items-center gap-1">
                      ✗ Error saving
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="text-sm text-gray-700 leading-[1.8]"
                dangerouslySetInnerHTML={{
                  __html: (() => {
                    let html = renumberSubsections(currentSection?.content || "", activeSection + 1)
                      .replace(/\r\n/g, "\n");

                    html = html.replace(
                      /(?:^|\n)([ \t]*\|[^\n]+\|[ \t]*)\n([ \t]*\|[\s\-:|]+\|[ \t]*)\n((?:[ \t]*\|[^\n]+\|[ \t]*(?:\n|$))+)/g,
                      (match, header, separator, body) => {
                        const thCells = header.trim().split("|").filter(c => c.trim()).map(c => `<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #0F2027;font-weight:700;color:#0F2027">${c.trim()}</th>`).join("");
                        const rows = body.trim().split("\n").map(row => {
                          const cells = row.trim().split("|").filter(c => c.trim()).map(c => `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${c.trim()}</td>`).join("");
                          return `<tr>${cells}</tr>`;
                        }).join("");
                        return `\n<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px"><thead><tr>${thCells}</tr></thead><tbody>${rows}</tbody></table>\n`;
                      }
                    );

                    html = html.replace(/<table>/g, '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">');
                    html = html.replace(/<th>/g, '<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #0F2027;font-weight:700;color:#0F2027">');
                    html = html.replace(/<td>/g, '<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">');

                    html = html
                      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\*(.+?)\*/g, "<em>$1</em>")
                      .replace(
                        /^### (.+)$/gm,
                        '<h4 style="font-size:15px;font-weight:700;margin:12px 0 2px;color:#0F2027">$1</h4>'
                      )
                      .replace(
                        /^## (.+)$/gm,
                        '<h3 style="font-size:16px;font-weight:700;margin:20px 0 6px;color:#0F2027">$1</h3>'
                      );

                    const tableBlocks = [];
                    html = html.replace(/<table[\s\S]*?<\/table>/gi, (m) => {
                      tableBlocks.push(m);
                      return `__TABLE_BLOCK_${tableBlocks.length - 1}__`;
                    });

                    html = html
                      .replace(/\n\n+/g, "<br><br>")
                      .replace(/\n/g, "<br>")
                      .replace(/<\/strong>(<br>)+/g, "</strong> ")
                      .replace(/<\/h4>(<br>)+/g, "</h4>")
                      .replace(/<\/h3>(<br>)+/g, "</h3>");

                    tableBlocks.forEach((block, i) => {
                      html = html.replace(`__TABLE_BLOCK_${i}__`, block);
                    });

                    return html;
                  })(),
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* COMPARE VIEW */}
      {viewMode === "compare" && (
        <div className="grid grid-cols-2 gap-6 h-[600px]">
          <div className="rounded-xl border border-gray-200 bg-white p-6 overflow-y-auto">
            <h3 className="text-lg font-bold text-black mb-4">
              Extracted RFP Requirements
            </h3>
            {Object.entries(extractedData).map(([key, val]) => (
              <div key={key} className="mb-6 pb-4 border-b border-gray-100">
                <h4 className="text-sm font-bold text-black mb-2 capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </h4>
                <div className="text-sm text-gray-700">
                  {typeof val === "string" ? (
                    <p>{val}</p>
                  ) : Array.isArray(val) ? (
                    <ul className="space-y-1">
                      {val.map((item, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-neutral-600 font-bold">✓</span>
                          <span>{JSON.stringify(item)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>{JSON.stringify(val)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 overflow-y-auto">
            <h3 className="text-lg font-bold text-black mb-4">
              Generated Proposal
            </h3>
            <div className="space-y-6">
              {sections.map((section, i) => (
                <div key={i} className="pb-4 border-b border-gray-100">
                  <h4 className="text-sm font-bold text-black mb-2">
                    {i + 1}. {section.title}
                  </h4>
                  <div
                    className="text-sm text-gray-700 line-clamp-4"
                    dangerouslySetInnerHTML={{
                      __html: renumberSubsections(section.content || "", i + 1)
                        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\*(.+?)\*/g, "<em>$1</em>")
                        .substring(0, 200),
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SCORE VIEW */}
      {viewMode === "score" && (
        <div className="space-y-6">
          {!scoreData ? (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
              <p className="text-gray-600 mb-6">
                Run a coverage analysis to see how well your proposal addresses the RFP requirements.
              </p>
              <button
                onClick={runScoreAnalysis}
                disabled={loadingScore}
                className="px-6 py-3 rounded-lg bg-black text-white text-sm font-semibold border-none cursor-pointer hover:opacity-90 disabled:opacity-50"
              >
                {loadingScore ? "Running Analysis..." : "Run Coverage Analysis"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div
                    className="relative w-32 h-32 rounded-full flex items-center justify-center text-white font-bold text-4xl"
                    style={{
                      backgroundColor:
                        scoreData.overallScore >= 80
                          ? "#10b981"
                          : scoreData.overallScore >= 50
                            ? "#f59e0b"
                            : "#ef4444",
                    }}
                  >
                    {scoreData.overallScore}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-black mb-2">Coverage Score</h3>
                <p className="text-sm text-gray-600">
                  {scoreData.overallScore >= 80
                    ? "Excellent coverage of RFP requirements"
                    : scoreData.overallScore >= 50
                      ? "Good coverage with some gaps"
                      : "Limited coverage - review gaps"}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h4 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                    <span className="text-neutral-700">✓</span> Strengths
                  </h4>
                  <ul className="space-y-3">
                    {(scoreData.strengths || []).map((strength, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-neutral-700 font-bold mt-0.5">✓</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h4 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                    <span className="text-red-600">✕</span> Gaps
                  </h4>
                  <ul className="space-y-3">
                    {(scoreData.gaps || []).map((gap, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-red-600 font-bold mt-0.5">✕</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h4 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                    <span className="text-neutral-500">💡</span> Suggestions
                  </h4>
                  <ul className="space-y-3">
                    {(scoreData.suggestions || []).map((suggestion, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-700">
                        <span className="text-neutral-500 mt-0.5">💡</span>
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {(scoreData.requirements || scoreData.requirementsCoverage) && (
                <div className="rounded-xl border border-gray-200 bg-white p-6">
                  <h4 className="text-lg font-bold text-black mb-4">Requirements Checklist</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {(scoreData.requirements || scoreData.requirementsCoverage || []).map((req, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className={req.covered ? "text-neutral-700" : "text-gray-300"}>
                          {req.covered ? "✓" : "○"}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{req.requirement}</p>
                          {(req.notes || req.status) && (
                            <p className="text-xs text-gray-500 mt-0.5">{req.notes || req.status}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={runScoreAnalysis}
                  disabled={loadingScore}
                  className="px-6 py-2 rounded-lg bg-black text-white text-sm font-semibold border-none cursor-pointer hover:opacity-90 disabled:opacity-50"
                >
                  {loadingScore ? "Re-analyzing..." : "Re-run Analysis"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
