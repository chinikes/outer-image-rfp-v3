/**
 * n8n Code Node: "Process Supplementary Files"
 *
 * Takes the list of supplementary files from Parse Metadata
 * and outputs one item per file for the Gemini summarization loop.
 *
 * Place this node after "Parse Metadata", connected to a Loop Over Items
 * that feeds into the Gemini Summarize node.
 *
 * If there are no supplementary files, outputs an empty array
 * so the downstream merge still works.
 */

const metadata = $('Parse Metadata').first().json;
const supplementaryFiles = metadata.supplementaryFiles || [];

if (supplementaryFiles.length === 0) {
  // No supplementary files — output a single item with empty context
  return [{
    json: {
      hasFiles: false,
      supplementarySummaries: [],
    }
  }];
}

// Output one item per supplementary file for the loop
return supplementaryFiles.map((file, index) => ({
  json: {
    hasFiles: true,
    fileIndex: index,
    fileName: file.name,
    fileType: file.fileType,
    fileUrl: file.url,
    mimeType: file.type,
    fileSize: file.size,
  }
}));
