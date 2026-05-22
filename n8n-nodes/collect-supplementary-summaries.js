/**
 * n8n Code Node: "Collect Supplementary Summaries"
 *
 * Runs after the Loop Over Items for supplementary file processing.
 * Collects all Gemini summaries into a single array.
 *
 * Place this node after the loop's "done" output.
 */

const items = $input.all();
const summaries = [];

for (const item of items) {
  try {
    // The Gemini response comes back in candidates[0].content.parts[0].text
    let rawText = '';

    if (item.json.candidates) {
      rawText = item.json.candidates[0]?.content?.parts?.[0]?.text || '';
    } else if (item.json.extractedSummary) {
      // If there's an Extract node in between
      rawText = typeof item.json.extractedSummary === 'string'
        ? item.json.extractedSummary
        : JSON.stringify(item.json.extractedSummary);
    } else if (item.json.supplementarySummaries) {
      // Pass-through from the "no files" branch
      continue;
    }

    if (!rawText) continue;

    // Clean and parse
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
    cleaned = cleaned.replace(/\n?```\s*$/i, '');

    const parsed = JSON.parse(cleaned);

    // Truncate summary to ~500 tokens (~2000 chars) to stay within budget
    if (parsed.summary && parsed.summary.length > 2000) {
      parsed.summary = parsed.summary.substring(0, 2000) + '...';
    }
    if (parsed.relevantDetails && Array.isArray(parsed.relevantDetails)) {
      parsed.relevantDetails = parsed.relevantDetails.slice(0, 5);
    }

    summaries.push(parsed);
  } catch (e) {
    // If parsing fails, create a minimal summary from what we have
    summaries.push({
      fileName: item.json.fileName || 'Unknown file',
      fileType: item.json.fileType || 'other',
      summary: 'File was processed but summary extraction failed.',
      relevantDetails: [],
      budgetInfo: null,
      siteInfo: null,
      technicalSpecs: null,
      scheduleInfo: null,
    });
  }
}

return [{
  json: {
    supplementarySummaries: summaries,
    summaryCount: summaries.length,
  }
}];
