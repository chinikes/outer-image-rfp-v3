/**
 * n8n Code Node: "Assemble Prompt v3"
 *
 * Builds the full GPT-4o prompt for proposal generation.
 * v3.2 (Laura template alignment):
 *   - 5-section structure matching Laura's Intuit reference proposal:
 *       1. Introduction and Executive Summary (tailored, folds in former "Value")
 *       2. Company Information (flat — no numbered sub-sections)
 *       3. Experience and Qualifications (bullet lists, references inline)
 *       4. Project Phases (design-led: Discovery, Concept, Design Dev, Documentation)
 *       5. Fee Proposal (Phase/Description/Fee table + Hourly Rate Schedule table)
 *   - References are pre-joined to portfolio projects by client name (code-side),
 *     so contact info appears inline in Experience bullets with no cross-pollination.
 *   - No separate "Project Overview", "Proposed Schedule", or "References" sections.
 *
 * Token budget: ~25K input to stay under 30K TPM limit.
 */

const merged = $input.first().json;

// ---- Helper: find specific boilerplate entries ----
function findBP(name) {
  const bp = merged.boilerplate || [];
  const match = bp.find(b => b.section && b.section.toLowerCase().includes(name.toLowerCase()));
  return match ? match.content : '';
}

// ---- Truncation helpers ----
function truncate(str, maxChars) {
  if (!str) return '';
  str = String(str);
  return str.length > maxChars ? str.substring(0, maxChars) + '...' : str;
}

function capList(arr, max) {
  return (arr || []).slice(0, max);
}

// ---- Extract key data ----
const rfp = merged.extractedData || {};
const serviceLine = merged.serviceLine || 'Design + Fabrication';
const industry = merged.industry || '';

// ---- Primary firm contact (stable firm info — used in Company Information) ----
const PRIMARY_CONTACT = 'Laura Vardanian, Project Management Lead — laura@outerimagenyc.com, (212) 470-8056';

// ---- Build team bios section (capped at 8, truncated) ----
const teamSection = capList(merged.teamBios, 8).map(t =>
  `- ${t.name}, ${t.title}${t.role ? ' (' + t.role + ')' : ''}${t.certifications ? ' [' + t.certifications + ']' : ''}\n  Bio: ${truncate(t.bio, 400)}`
).join('\n');

// ---- Build de-duplicated reference list (for inline Experience references) ----
// References are fetched UNFILTERED from Airtable, so all clients are available
// to join. We match a reference to a portfolio project by client name against
// either the project's Client field OR the project name (which usually leads with
// the client, e.g. "Meta — Signage Program"), since the Client field is often blank.
const uniqueRefs = [];
const seenRefClients = new Set();
for (const r of (merged.references || [])) {
  const key = (r.client || '').toLowerCase().trim();
  if (key && !seenRefClients.has(key)) { seenRefClients.add(key); uniqueRefs.push(r); }
}
function findRefFor(p) {
  const proj = (p.project || '').toLowerCase();
  const client = (p.client || '').toLowerCase().trim();
  for (const r of uniqueRefs) {
    const rc = (r.client || '').toLowerCase().trim();
    if (!rc) continue;
    if (rc === client || proj.startsWith(rc) || proj.includes(rc + ' ')) return r;
  }
  return null;
}
function refLineFor(p) {
  const r = findRefFor(p);
  if (!r) return 'Available upon request';
  let line = r.contactName || '';
  if (r.contactEmail) line += (line ? ', ' : '') + r.contactEmail;
  if (r.contactPhone) line += (line ? ', ' : '') + r.contactPhone;
  return line || 'Available upon request';
}

// ---- Select portfolio projects DETERMINISTICALLY by Industry (Client Tier) + Service Line ----
// Strict tier+service-line matches lead; graceful fallback so Experience is never empty.
function selectPortfolio(projects, max) {
  const ind = (industry || '').toLowerCase().trim();
  const sl = (serviceLine || '').toLowerCase().trim();
  const tierMatch = p => ind && (p.tier || '').toLowerCase().trim() === ind;
  const slMatch = p => sl && (p.serviceLine || '').toLowerCase().trim() === sl;
  const seen = new Set();
  const out = [];
  const add = (arr) => {
    for (const p of arr) {
      const k = (p.project || '').toLowerCase().trim();
      if (k && !seen.has(k)) { seen.add(k); out.push(p); }
      if (out.length >= max) break;
    }
  };
  add(projects.filter(p => tierMatch(p) && slMatch(p))); // 1. Industry AND Service Line
  if (out.length < max) add(projects.filter(tierMatch)); // 2. Industry (any service line)
  if (out.length < max) add(projects.filter(slMatch));   // 3. Service Line (any industry)
  if (out.length < max) add(projects);                   // 4. fill to reach max
  return out.slice(0, max);
}
const selectedPortfolio = selectPortfolio(merged.portfolio || [], 5);
const portfolioSection = selectedPortfolio.map(p => {
  let entry = `- ${p.project}${p.client ? ' (Client: ' + p.client + ')' : ''}`;
  if (p.tier) entry += ` [Client Tier: ${p.tier}]`;
  if (p.location) entry += `\n  Location: ${p.location}`;
  if (p.gc) entry += ` | GC: ${p.gc}`;
  if (p.projectSize) entry += `\n  Project Size: ${p.projectSize}`;
  if (p.scopeOfServices) entry += `\n  Scope of Services: ${p.scopeOfServices}`;
  if (p.designValue) entry += `\n  Design Value: ${p.designValue}`;
  if (p.fabricationValue) entry += ` | Fabrication Value: ${p.fabricationValue}`;
  if (p.status) entry += `\n  Status: ${p.status}`;
  // Pre-joined verified reference contact for THIS project (by client name match):
  entry += `\n  Reference (verified, use verbatim): ${refLineFor(p)}`;
  entry += `\n  ${truncate(p.summary, 300)}`;
  return entry;
}).join('\n');

// ---- Build schedule section (folded into Project Phases if present) ----
const scheduleSection = capList(merged.schedules, 3).map(s =>
  `Template: ${s.template}\nPhases: ${truncate(s.phases, 500)}\nDuration: ${s.totalDuration || 'TBD'}`
).join('\n---\n');

// ---- Build rates section ----
const ratesSection = capList(merged.rates, 10).map(r =>
  `- ${r.role}: ${r.rate}${r.notes ? ' (' + r.notes + ')' : ''}`
).join('\n');

// ---- Boilerplate entries ----
const firmOverviewBP = findBP('firm overview') || findBP('overview');
const missionBP = findBP('mission');
const firmHistoryBP = findBP('firm history') || findBP('history');
const disputesBP = findBP('dispute');
// Company Profile drives the Company Overview narrative (Section Name "Corporate Information").
const companyProfileBP = findBP('corporate information') || findBP('company profile') || findBP('company overview') || firmOverviewBP;
const insuranceBP = findBP('licensing, certifications') || findBP('insurance & licensing') || findBP('insurance') || findBP('licensing');

// ---- v3: Build supplementary context section ----
let supplementarySection = '';
if (merged.hasSupplementary && merged.supplementarySummaries.length > 0) {
  supplementarySection = '\n=== SUPPLEMENTARY DOCUMENTS ===\n';
  supplementarySection += 'The following documents were included with the RFP package. Use this context to make the proposal more specific, informed, and tailored:\n\n';

  for (const summary of merged.supplementarySummaries) {
    supplementarySection += `[File: ${summary.fileName}] (${summary.fileType})\n`;
    supplementarySection += `Summary: ${truncate(summary.summary, 500)}\n`;

    if (summary.relevantDetails && summary.relevantDetails.length > 0) {
      supplementarySection += `Key details:\n`;
      for (const detail of summary.relevantDetails.slice(0, 5)) {
        supplementarySection += `  - ${truncate(detail, 200)}\n`;
      }
    }

    if (summary.budgetInfo && summary.budgetInfo !== 'null') {
      supplementarySection += `Budget info: ${truncate(summary.budgetInfo, 300)}\n`;
    }
    if (summary.siteInfo && summary.siteInfo !== 'null') {
      supplementarySection += `Site info: ${truncate(summary.siteInfo, 300)}\n`;
    }
    if (summary.technicalSpecs && summary.technicalSpecs !== 'null') {
      supplementarySection += `Technical specs: ${truncate(summary.technicalSpecs, 300)}\n`;
    }
    if (summary.scheduleInfo && summary.scheduleInfo !== 'null') {
      supplementarySection += `Schedule info: ${truncate(summary.scheduleInfo, 300)}\n`;
    }

    supplementarySection += '\n';
  }
}

// ---- Assemble the full prompt ----
const prompt = `You are a proposal writer for Outer Image LLC, a Brooklyn-based WBE-certified signage design, fabrication, and implementation studio. Design Studio: 161 Water Street, Suite 1533, New York, NY 10038. Fabrication Shop: 226 42nd Street, Brooklyn, NY 11232. Phone: 212.661.2124. Website: www.outerimage.com. Primary contact: ${PRIMARY_CONTACT}.

Generate a complete proposal response for the following RFP using EXACTLY the five-section structure defined below. Match the tone and structure of a polished, design-led studio proposal.

=== RFP DATA ===
Issuer: ${rfp.issuer || 'Unknown'}
Project Title: ${rfp.projectTitle || 'Unknown'}
Project Location: ${rfp.location || 'Not specified'}
Submission Deadline: ${rfp.submissionDeadline || 'TBD'}
Service Line: ${serviceLine}${industry ? `\nIndustry/Client Tier: ${industry}` : ''}
IMPORTANT CONTEXT: The user has categorized this RFP as Service Line="${serviceLine}"${industry ? ` and Industry="${industry}"` : ''}. These selections MUST heavily influence the entire proposal — tone, project references, team emphasis, and approach should all be tailored to this specific service type${industry ? ` and ${industry.toLowerCase()} sector` : ''}.
Scope of Work: ${truncate(rfp.scopeOfWork, 1500)}
Evaluation Criteria: ${truncate(rfp.evaluationCriteria, 500)}
Required Certifications: ${rfp.requiredCertifications || 'None specified'}
Budget Range: ${rfp.budgetRange || 'Not specified'}
Key Requirements: ${Array.isArray(rfp.keyRequirements) ? rfp.keyRequirements.join('; ') : (rfp.keyRequirements || 'None specified')}
${supplementarySection}
=== AIRTABLE CONTENT LIBRARY ===

--- TEAM BIOS ---
${teamSection || 'No team bios available.'}

--- PORTFOLIO PROJECTS (already filtered to this RFP's Industry + Service Line; each includes a pre-verified Reference contact) ---
${portfolioSection || 'No portfolio projects available.'}

--- PROJECT SCHEDULE TEMPLATES ---
${scheduleSection || 'No schedule templates available.'}

--- RATE SCHEDULES ---
${ratesSection || 'No rate schedules available.'}

--- BOILERPLATE: COMPANY PROFILE (use VERBATIM for the Company Overview) ---
${truncate(companyProfileBP, 1600) || 'Not available.'}

--- BOILERPLATE: LICENSING, CERTIFICATIONS & INSURANCE (use VERBATIM for that section) ---
${truncate(insuranceBP, 600) || 'Not available.'}

--- BOILERPLATE: FIRM OVERVIEW ---
${truncate(firmOverviewBP, 1000) || 'Not available.'}

--- BOILERPLATE: MISSION ---
${truncate(missionBP, 500) || 'Not available.'}

--- BOILERPLATE: FIRM HISTORY ---
${truncate(firmHistoryBP, 500) || 'Not available.'}

--- BOILERPLATE: DISPUTES ---
${truncate(disputesBP, 300) || 'Not available.'}

=== PROPOSAL INSTRUCTIONS ===

Generate the proposal in markdown with EXACTLY these five "## " sections, in this order and with these exact titles. Do NOT generate a cover letter. Do NOT add any other top-level sections (no separate "Project Overview", no "Proposed Schedule", no standalone "References"). Do NOT use numbered sub-sections like "2.1" or "3.2".

## Introduction and Executive Summary
Write a tailored 3-4 paragraph narrative specific to THIS RFP (not boilerplate):
- Paragraph 1: Address ${rfp.issuer || 'the issuer'} and the "${rfp.projectTitle || 'project'}" directly. Introduce Outer Image as a Brooklyn-based WBE-certified signage studio and frame its fit for this project's ${serviceLine} scope${industry ? ` in the ${industry} sector` : ''}. Adapt the Firm Overview boilerplate — do not copy it verbatim.
- Paragraph 2 (the value paragraph — fold the former "Value to client" content here): explain the specific value Outer Image brings to this client — capabilities, certifications, and team strengths that matter most to ${industry || 'this type of'} client${industry === 'Government' ? ' (compliance, code requirements, public-facing durability, WBE/MBE certification)' : industry === 'Corporate' ? ' (brand alignment, aesthetic quality, stakeholder coordination, high-profile environments)' : industry === 'Non-Profit' ? ' (cost-effectiveness, mission-driven design, community impact, budget sensitivity)' : industry === 'Health' ? ' (ADA compliance, wayfinding clarity, patient experience, regulatory standards, durability)' : ''}.
- Paragraph 3: reference ONLY the 1-2 most relevant PORTFOLIO PROJECTS whose Client Tier matches "${industry || 'the RFP sector'}". Do NOT mix sectors; if fewer than 2 matching projects exist, broaden slightly and note the relevance.
- Optional Paragraph 4: a brief closing statement of commitment to the project.

## Company Information
Format this section as labelled groups that match the reference EXACTLY: each label is BOLD on its OWN line, with its content on the line(s) directly below it. Do NOT use "-" bullets anywhere in this section. SPACING: put exactly ONE blank line between each group so they are visually separated; keep the lines WITHIN a group on consecutive lines (no blank line between a label and its content, or between list items). Output these groups in this exact order:

**Company Name:** Outer Image LLC

**Address:**
Design Studio: 161 Water Street, Suite 1533, New York, NY 10038
Fabrication Shop: 226 42nd Street, Brooklyn, NY 11232

**Contact:**
Laura Vardanian, Project Management Lead
laura@outerimagenyc.com
(212) 470-8056
www.outerimagenyc.com

**Company Overview:**
Reproduce the COMPANY PROFILE boilerplate text VERBATIM, preserving its paragraph breaks. Do NOT summarize it, shorten it, or substitute other boilerplate.

**Key Personnel Assigned to Project:**
List EVERY person in TEAM BIOS, one per line, as "Name: Title" using each person's exact Title — no bullets, no omissions, no invented people. Lead with Laura Vardanian, then the rest.

**Licensing, Certifications, and Insurance:**
Reproduce the LICENSING, CERTIFICATIONS & INSURANCE boilerplate VERBATIM, with each item on its own line. If that boilerplate is unavailable, write "Certified WBE in NYC and NY State" plus any certifications found in TEAM BIOS, each on its own line. Do NOT invent certifications or coverage.

## Experience and Qualifications
Include EVERY project in the PORTFOLIO PROJECTS list below (up to 5), in the order given. That list has ALREADY been filtered to this RFP's Industry ("${industry || 'any'}") and Service Line ("${serviceLine}") — do NOT add, drop, substitute, or reorder projects. For EACH project, output a bold project-name heading followed by a bullet list, using this EXACT format:

**[Project Name]**
- **Scope:** [a single descriptive line of the project scope — use the project's Scope of Services and, where helpful, key descriptors from the project summary, combined into ONE line]
- **Location:** [Location]
- **Budget:** $[Design Value] (Design) / $[Fabrication Value] (Fabrication)
- **Timeline:** [Status or timeline info]
- **Reference:** [use the project's pre-verified Reference contact EXACTLY as given in the PORTFOLIO PROJECTS data — including "Available upon request" if that is what is provided]

Do NOT add a separate description paragraph after the bullets — the descriptive detail belongs in the Scope line. Each project is ONLY the bold heading followed by the five bullets above, then a blank line before the next project.

RULES FOR THIS SECTION:
- ONLY use projects listed in PORTFOLIO PROJECTS. Never invent or duplicate a project.
- Use the Reference value already attached to each project. Do NOT invent contact names, emails, or phones, and do NOT swap references between projects.
- If a field is missing in the data, write "[Not provided]" — do not guess.
- Bold the project name; use "- " bullets; format dollars as currency (e.g., "$310,000"); end EVERY bullet line with two trailing spaces.
- The PORTFOLIO PROJECTS list is the authoritative, pre-filtered selection for this Industry and Service Line. Present those projects only — never swap in a project from a different sector or service line.

## Project Phases
Describe Outer Image's design-led process in EXACTLY these four phases, in this order. Each phase is a "### " heading (unnumbered) followed by 3-5 "- " bullets describing the activities and deliverables of that phase. Keep all descriptions general and professional — do NOT invent proprietary methodology names, named internal processes, or software tools not found in TEAM BIOS.

### Discovery & Strategy
- Bullets: kickoff and stakeholder alignment, site/context review, program and message-schedule needs, code/ADA and brand requirements gathering. Reference any supplementary site or design-brief documents if provided.

### Concept Design
- Bullets: design concepts and visual direction, signage families and material studies, preliminary location plans, stakeholder review of concepts.

### Design Development
- Bullets: refined designs, message schedules and location plans, materials/finishes specification, coordination with the client and (for fabrication scope) constructability review.

### Documentation
- Bullets: design intent / fabrication-ready documentation, specifications and schedules, permit/code documentation as applicable, hand-off package for fabrication and installation${/Fabrication/i.test(serviceLine) ? ' (and coordination into in-house fabrication at the Brooklyn shop)' : ''}.

If PROJECT SCHEDULE TEMPLATES contains usable durations, you MAY add one approximate-duration bullet per phase; otherwise omit timing entirely (do not invent durations).

## Fee Proposal
Provide two markdown tables and no invented lump-sum totals.

First, a phase-fee table aligned to the four phases above:
| Phase | Description | Fee |
|-------|-------------|-----|
One row per phase (Discovery & Strategy, Concept Design, Design Development, Documentation). The three columns are DISTINCT — never repeat the Fee text in the Description column:
- Phase column: the phase name.
- Description column: a short phrase (5-12 words) summarizing that phase's key deliverables, drawn from the Project Phases section above (e.g. "Stakeholder alignment, site review, and EGD strategy"). Do NOT put pricing or "hourly" text here.
- Fee column: write "Hourly — billed per rate schedule" (or "To be confirmed upon scope finalization"). Do NOT invent dollar totals unless the RFP scope provides enough detail for an hourly estimate.

Then leave a blank line, output the bold heading **Hourly Rate Schedule** on its own line, leave another blank line, and then output a table built from RATE SCHEDULES with these columns:
| Position | Hourly Rate |
|----------|-------------|
List each role with its rate in the Rate column formatted as "$[rate]/hr" so the per-hour basis is explicit (e.g., "$250/hr"). Keep the header exactly "Hourly Rate" — do NOT append "/hr" to the header. Use the rate values exactly as given; do NOT invent or alter rates. If no rate data is available, write: "Outer Image will provide a detailed fee proposal upon further discussion of the project scope."

=== ZERO-HALLUCINATION POLICY (APPLIES TO THE ENTIRE PROPOSAL) ===
These rules override everything else and apply to EVERY section.

1. AUTHORITATIVE DATA SOURCES:
   - PORTFOLIO PROJECTS = the ONLY source for project names, descriptions, locations, values, GCs, and the verified Reference contact attached to each project.
   - TEAM BIOS = the ONLY source for team member names, titles, certifications, and experience.
   - RATE SCHEDULES = the ONLY source for hourly rates.
   - BOILERPLATE = the ONLY source for firm overview, mission, history, and disputes language.
2. REFERENCES ARE PRE-MATCHED. Each project's Reference contact has already been verified and joined to that specific project. Use it only on that project, exactly as written. Never move a reference to a different project and never invent one.
3. NEVER INVENT. Do not create project names, scopes, budgets, team qualifications, contacts, rates, firm claims, software tools (only those in TEAM BIOS), lump-sum fees, or named proprietary methodologies.
4. MISSING DATA. In Experience, write "[Not provided]" for empty fields. In Fee Proposal, if rate data is missing, use the fallback sentence above. Elsewhere, omit rather than guess.
5. WHEN IN DOUBT, LEAVE IT OUT — especially dollar amounts, tool names, and process/methodology names.

=== FORMATTING RULES ===
1. Use "## " for the five main section headings (exact titles above) and "### " for the four phase headings. Do NOT number the headings yourself.
2. Do NOT wrap the output in code fences.
3. Start the output with "## Introduction and Executive Summary" (no cover letter).
4. Use markdown table syntax (pipes and dashes) for both Fee Proposal tables.
5. Bold with **double asterisks**.
6. In Experience and Qualifications, use "- " bullets under each bold project name and end EVERY field line with two trailing spaces. Format dollar amounts as currency.
7. Reference supplementary document details naturally — do not just list them.
8. Total output should be approximately 2,200-3,500 words.`;

return [{
  json: {
    prompt,
    model: 'gpt-4o',
    maxTokens: 10000,
    temperature: 0.7,
  }
}];
