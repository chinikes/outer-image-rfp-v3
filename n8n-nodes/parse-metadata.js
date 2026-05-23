/**
 * n8n Code Node: "Parse Metadata"
 *
 * Receives the webhook payload from the v3 portal.
 * Separates primary RFP info from supplementary files.
 * Outputs structured data for downstream nodes.
 *
 * Place this node immediately after the Webhook trigger.
 */

const items = $input.all();
const item = items[0].json;

// Primary RFP info (same fields as v2)
const primaryRfp = {
  recordId: item.recordId,
  fileUrl: item.fileUrl,
  fileName: item.fileName,
  fileType: item.fileType,
  callbackUrl: item.callbackUrl,
  extractedText: item.extractedText || null,
  triggeredAt: item.triggeredAt,
};

// v3: Supplementary files
const supplementaryFiles = item.supplementaryFiles || [];
const fileCount = item.fileCount || 1;
const version = item.version || "2.0";

// v3.1: User-selected categorization
const industry = item.industry || '';
const serviceLine = item.serviceLine || '';

// Prioritize supplementary files for processing:
// PDFs and spreadsheets first (most useful context), then documents, then images
const priorityOrder = { pdf: 1, spreadsheet: 2, document: 3, image: 4, other: 5 };
const sortedSupplementary = [...supplementaryFiles].sort(
  (a, b) => (priorityOrder[a.fileType] || 5) - (priorityOrder[b.fileType] || 5)
);

// Cap at 5 supplementary files to stay within token budget
const cappedSupplementary = sortedSupplementary.slice(0, 5);

return [{
  json: {
    primaryRfp,
    supplementaryFiles: cappedSupplementary,
    supplementaryCount: supplementaryFiles.length,
    processedCount: cappedSupplementary.length,
    skippedCount: Math.max(0, supplementaryFiles.length - 5),
    fileCount,
    version,
    hasSupplementary: cappedSupplementary.length > 0,
    // v3.1: Pass through user categorization for downstream nodes
    industry,
    serviceLine,
  }
}];
