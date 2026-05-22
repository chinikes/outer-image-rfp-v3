/**
 * POST /api/webhook/status
 *
 * Callback endpoint for n8n to push status updates.
 * Includes detailed error logging to diagnose Airtable issues.
 */

import { NextResponse } from "next/server";
import { updateRfpStatus, isAirtableConfigured } from "@/lib/airtable";

const VALID_STATUSES = [
  "Received", "Parsing", "Drafting", "Ready for Review", "Finalized",
  "Error — Parsing", "Error — Drafting", "Error — Intake",
];

export async function POST(request) {
  try {
    const body = await request.json();
    const { recordId, status, extractedData, generatedDraft, serviceLine, deadline, errorLog } = body;

    console.log("Webhook received:", { recordId, status, serviceLine, deadline });

    if (!recordId || !status) {
      return NextResponse.json(
        { error: "recordId and status are required" },
        { status: 400 }
      );
    }

    if (!isAirtableConfigured()) {
      console.log("Airtable not configured — skipping update");
      return NextResponse.json({ success: true, recordId, status, note: "Airtable not configured" });
    }

    // Build update fields — only include fields that have values
    const updateFields = {};

    if (extractedData) {
      try {
        updateFields["Extracted Data (JSON)"] =
          typeof extractedData === "string"
            ? extractedData
            : JSON.stringify(extractedData);
      } catch (e) {
        console.error("Failed to stringify extractedData:", e);
      }
    }

    if (generatedDraft) {
      updateFields["Generated Draft"] = generatedDraft;
    }

    if (serviceLine) {
      updateFields["Service Line (Detected)"] = serviceLine;
    }

    if (deadline) {
      updateFields["Submission Deadline"] = deadline;
    }

    if (errorLog) {
      updateFields["Error Log"] = errorLog;
    }

    console.log("Updating Airtable record:", recordId, "with fields:", Object.keys(updateFields));

    const fieldErrors = [];

    // First: update status + all fields together
    try {
      await updateRfpStatus(recordId, status, updateFields);
      return NextResponse.json({ success: true, recordId, status });
    } catch (airtableError) {
      console.error("Airtable full update failed:", airtableError.message);
      fieldErrors.push(`bulk: ${airtableError.message}`);
    }

    // Fallback: update status alone first
    try {
      await updateRfpStatus(recordId, status, {});
      console.log("Status-only update succeeded");
    } catch (fallbackError) {
      console.error("Even status-only update failed:", fallbackError.message);
      return NextResponse.json(
        { error: `Airtable update failed: ${fallbackError.message}` },
        { status: 500 }
      );
    }

    // Then try each extra field individually
    for (const [fieldName, fieldValue] of Object.entries(updateFields)) {
      try {
        await updateRfpStatus(recordId, status, { [fieldName]: fieldValue });
        console.log(`Field "${fieldName}" saved successfully`);
      } catch (fieldError) {
        console.error(`Field "${fieldName}" failed:`, fieldError.message);
        fieldErrors.push(`${fieldName}: ${fieldError.message}`);
      }
    }

    return NextResponse.json({ 
      success: true, recordId, status,
      warning: `Some fields failed individually: ${fieldErrors.join("; ")}` 
    });
  } catch (error) {
    console.error("Webhook status error:", error);
    return NextResponse.json(
      { error: "Failed to update status" },
      { status: 500 }
    );
  }
}
