/**
 * POST /api/upload
 *
 * v3: Receives blob URLs from client-side uploads.
 * Files are already in Vercel Blob — this route just creates the
 * Airtable record, extracts text from Word docs if needed, and
 * triggers the n8n v3 pipeline.
 *
 * Payload: JSON (not FormData) — tiny, well under 4.5MB limit.
 */
import { NextResponse } from "next/server";
import { createRfpRecord, updateRfpStatus } from "@/lib/airtable";
import { triggerIntakeWorkflow } from "@/lib/n8n";
import mammoth from "mammoth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_FILES = 10;

export async function POST(request) {
  try {
    const body = await request.json();
    const { primaryIndex, files, industry, serviceLine } = body;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed` },
        { status: 400 }
      );
    }

    // Validate all files have blob URLs
    for (const file of files) {
      if (!file.url) {
        return NextResponse.json(
          { error: `File "${file.name}" is missing a blob URL` },
          { status: 400 }
        );
      }
    }

    // ---- Determine primary file info ----
    const primaryFile = files[primaryIndex];
    const primaryName = primaryFile.name.replace(/\.[^/.]+$/, "");

    // ---- Create Airtable record ----
    const record = await createRfpRecord({
      rfpName: primaryName,
      fileUrl: primaryFile.url,
      industry: industry || null,
      serviceLine: serviceLine || null,
    });

    // ---- Determine primary file type and extract text if Word doc ----
    let primaryFileType = "xlsx";
    let extractedDocxText = null;

    if (primaryFile.type === "application/pdf") {
      primaryFileType = "pdf";
    } else if (
      primaryFile.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      primaryFileType = "docx";
      // Download the Word doc from Blob to extract text server-side
      try {
        const docResponse = await fetch(primaryFile.url);
        const arrayBuffer = await docResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await mammoth.extractRawText({ buffer });
        extractedDocxText = result.value;
      } catch (e) {
        console.error("Word text extraction failed:", e);
      }
    }

    // ---- Build supplementary files list ----
    const supplementaryFiles = files
      .filter((_, i) => i !== primaryIndex)
      .map((f) => ({
        name: f.name,
        type: f.type,
        size: f.size,
        url: f.url,
        fileType: getFileCategory(f.type, f.name),
      }));

    // ---- Trigger n8n v3 pipeline ----
    const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/status`;
    const webhookResult = await triggerIntakeWorkflow({
      recordId: record.id,
      fileUrl: primaryFile.url,
      fileName: primaryFile.name,
      fileType: primaryFileType,
      callbackUrl,
      extractedText: extractedDocxText,
      supplementaryFiles,
      fileCount: files.length,
      industry: industry || null,
      serviceLine: serviceLine || null,
    });

    if (!webhookResult.success) {
      await updateRfpStatus(record.id, "Error — Intake", {
        "Error Log": `n8n webhook failed: ${webhookResult.error}`,
      });
    }

    return NextResponse.json({
      success: true,
      proposal: {
        id: record.id,
        rfpId: record.rfpId,
        status: webhookResult.success ? "Received" : "Error — Intake",
        fileUrl: primaryFile.url,
        fileCount: files.length,
        supplementaryCount: supplementaryFiles.length,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed. Please try again." },
      { status: 500 }
    );
  }
}

/**
 * Categorize a file by its MIME type and extension for the n8n pipeline.
 */
function getFileCategory(mimeType, fileName) {
  const ext = fileName.split(".").pop().toLowerCase();
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png"].includes(ext))
    return "image";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    ["xlsx", "xls", "csv"].includes(ext)
  )
    return "spreadsheet";
  if (mimeType.includes("wordprocessing") || ["docx", "doc"].includes(ext))
    return "document";
  return "other";
}
