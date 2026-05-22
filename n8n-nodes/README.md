# n8n Workflow Setup — "RFP Intake Pipeline v3"

## Overview

Create a **new** n8n workflow called "RFP Intake Pipeline v3" (separate from v2).
This workflow processes multi-file RFP packages and generates proposals with cover letters.

## Workflow Structure

```
[Webhook] → [Parse Metadata] → ┬→ [Download Primary] → [Convert Base64] → [Gemini Parse Primary] → [Extract Response] → [Fix Date] → [Set Service Line] ──┐
                                │                                                                                                                             │
                                └→ [Process Supplementary Files] → [Loop Over Items] → [Download File] → [Convert Base64] → [Gemini Summarize] ──┐           │
                                                                                                                                                  │           │
                                                                       [Collect Supplementary Summaries] ←────────────────────────────────────────┘           │
                                                                                  │                                                                           │
                                                                                  ├── uses Service Line from ──────────────────────────────────────────────────┘
                                                                                  │
                                                                    [Fetch Airtable (parallel)] ← Team Bios, References, Portfolio, Boilerplate, Schedules, Rates
                                                                                  │
                                                                    [Merge All Content v3]
                                                                                  │
                                                                    [Assemble Prompt v3]
                                                                                  │
                                                                    [OpenAI Generate]
                                                                                  │
                                                                    [Callback to Portal]
```

## Node-by-Node Setup

### 1. Webhook (Trigger)
- **Type:** Webhook
- **Method:** POST
- **Path:** `rfp-intake-v3`
- Copy the webhook URL to your `.env.local` as `N8N_WEBHOOK_URL`

### 2. Parse Metadata (Code Node)
- Paste code from: `parse-metadata.js`
- Separates primary RFP from supplementary files
- Caps supplementary files at 5, prioritized by type

### 3. Download Primary File (HTTP Request)
- **URL:** `{{ $json.primaryRfp.fileUrl }}`
- Same as v2's Download File node

### 4. Convert to Base64 (Code Node)
- Same as v2 — converts downloaded binary to base64

### 5. Gemini Parse Primary (HTTP Request)
- Same as v2's Gemini Parse PDF node
- Use the exact same jsonBody expression from v2 (see handoff doc)
- Extracts structured JSON from the primary RFP

### 6. Extract Gemini Response (Code Node)
- Same as v2 — cleans and parses the Gemini output

### 7. Fix Date Format (Code Node)
- Same as v2 — normalizes deadline to YYYY-MM-DD

### 8. Set Service Line (Code Node)
- Same as v2 — normalizes to one of 4 service line values

### 9. Process Supplementary Files (Code Node)
- Paste code from: `process-supplementary-files.js`
- Outputs one item per supplementary file for the loop
- Connect to a **Loop Over Items** node

### 10. Loop: Download Supplementary File (HTTP Request)
- **URL:** `{{ $json.fileUrl }}`
- Inside the Loop Over Items

### 11. Loop: Convert to Base64 (Code Node)
- Same base64 conversion as step 4

### 12. Loop: Gemini Summarize (HTTP Request)
- See: `gemini-summarize-supplementary.json` for configuration
- Different prompt than primary — extracts context summaries
- **JSON Body** must be in Expression mode (fx toggle)

### 13. Collect Supplementary Summaries (Code Node)
- Paste code from: `collect-supplementary-summaries.js`
- Connect to the Loop's "done" output
- Aggregates all summaries into a single array

### 14. Fetch Airtable (6 parallel nodes)
- Same as v2 — Team Bios, Client References, Portfolio, Boilerplate, Project Schedules, Rate Schedules
- All filtered by the Service Line from step 8

### 15. Merge All Content v3 (Code Node)
- Paste code from: `merge-all-content-v3.js`
- **New:** Also pulls supplementary summaries from step 13
- Connect inputs from: Airtable nodes, Extract Response, Set Service Line, Collect Summaries

### 16. Assemble Prompt v3 (Code Node)
- Paste code from: `assemble-prompt-v3.js`
- **New:** Includes supplementary context section and cover letter instructions
- Token budget managed: ~18K input, ~10K output

### 17. OpenAI Generate (OpenAI Node)
- **Model:** gpt-4o
- **Max Tokens:** 10000
- **Temperature:** 0.7
- Input: the prompt from step 16

### 18. Callback to Portal (HTTP Request)
- **Method:** POST
- **URL:** `{{ $('Parse Metadata').first().json.primaryRfp.callbackUrl }}`
- Same payload structure as v2 callback

## Key Differences from v2

| Feature | v2 | v3 |
|---------|----|----|
| File inputs | 1 file | 1 primary + up to 5 supplementary |
| Gemini calls | 1 (structured extraction) | 1 + N (extraction + summaries) |
| Prompt | 7 sections | Cover letter + 7 sections |
| Webhook payload | Single file URL | File URL + supplementaryFiles array |
| Token budget | ~15K input | ~18K input (supplementary adds ~3K) |

## Airtable Field Names (Case-Sensitive)

Same as v2:
- `Project Size`, `Scope of Services`, `Design Value`, `Fabrication Value`
- `Client Name`, `Project Name`, `Contact Name`, `Contact Email`, `Contact Phone`
- `Section Name`, `Content`, `Service Lines`
- `Template Name`, `Phases`, `Total Duration`
- `Role / Line Item`, `Rate`, `Notes`
