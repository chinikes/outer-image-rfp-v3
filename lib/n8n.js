/**
 * n8n Webhook Client — v3
 *
 * Triggers the n8n v3 intake workflow when a new RFP package is uploaded.
 * Now supports multi-file payloads with supplementary file metadata.
 */
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

/**
 * Fire the n8n intake webhook.
 * Called after file upload + Airtable record creation.
 *
 * @param {Object} payload
 * @param {string} payload.recordId - Airtable record ID for status updates
 * @param {string} payload.fileUrl - Blob storage URL of the primary RFP
 * @param {string} payload.fileName - Primary RFP filename
 * @param {string} payload.fileType - "pdf", "xlsx", or "docx"
 * @param {string} payload.callbackUrl - Portal webhook URL for status updates
 * @param {string|null} payload.extractedText - Pre-extracted text for Word docs
 * @param {Array} payload.supplementaryFiles - Array of { name, type, size, url, fileType } for supporting docs
 * @param {number} payload.fileCount - Total number of files in the package
 */
export async function triggerIntakeWorkflow({
  recordId,
  fileUrl,
  fileName,
  fileType,
  callbackUrl,
  extractedText,
  supplementaryFiles = [],
  fileCount = 1,
}) {
  if (!N8N_WEBHOOK_URL) {
    console.warn("N8N_WEBHOOK_URL not configured — skipping webhook trigger");
    return { success: false, error: "Webhook URL not configured" };
  }

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Primary RFP (same as v2)
        recordId,
        fileUrl,
        fileName,
        fileType,
        callbackUrl,
        extractedText,
        triggeredAt: new Date().toISOString(),
        // v3: Multi-file support
        version: "3.0",
        fileCount,
        supplementaryFiles,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("n8n webhook failed:", response.status, errorText);
      return { success: false, error: `n8n returned ${response.status}` };
    }

    const data = await response.json().catch(() => ({}));
    return { success: true, data };
  } catch (error) {
    console.error("n8n webhook error:", error);
    return { success: false, error: error.message };
  }
}
