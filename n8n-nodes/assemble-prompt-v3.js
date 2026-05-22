/**
 * n8n Code Node: "Assemble Prompt v3"
 *
 * Builds the full GPT-4o prompt for proposal generation.
 * v3 additions:
 *   - Supplementary context section (from supporting documents)
 *
 * Token budget: ~25K input to stay under 30K TPM limit.
 * Allocation: system ~500, RFP ~2K, supplementary ~3K, Airtable ~8K,
 *             instructions ~4K = ~17.5K input, ~10K output.
 */

const merged = $input.first().json;

// ---- Helper: find specific boilerplate entries ----
function findBP(name) {
  const bp = merged.boilerplate || [];
  const match = bp.find(b => b.section && b.section.toLowerCase().includes(name.toLowerCase()));
  return match ? match.content : '';
}

// ---- Truncation helpers (same as v2) ----
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

// ---- Build team bios section (capped at 8, truncated) ----
const teamSection = capList(merged.teamBios, 8).map(t =>
  `- ${t.name}, ${t.title}${t.role ? ' (' + t.role + ')' : ''}${t.certifications ? ' [' + t.certifications + ']' : ''}\n  Bio: ${truncate(t.bio, 400)}`
).join('\n');

// ---- Build references section (capped at 5) ----
const refsSection = capList(merged.references, 5).map(r =>
  `- ${r.client} — ${r.project}${r.year ? ' (' + r.year + ')' : ''}${r.tier ? ' [' + r.tier + ']' : ''}\n  ${truncate(r.description, 300)}\n  Contact: ${r.contactName}${r.contactEmail ? ', ' + r.contactEmail : ''}${r.contactPhone ? ', ' + r.contactPhone : ''}`
).join('\n');

// ---- Build portfolio section (capped at 5) ----
const portfolioSection = capList(merged.portfolio, 5).map(p => {
  let entry = `- ${p.project}${p.client ? ' (Client: ' + p.client + ')' : ''}`;
  if (p.location) entry += `\n  Location: ${p.location}`;
  if (p.gc) entry += ` | GC: ${p.gc}`;
  if (p.projectSize) entry += `\n  Project Size: ${p.projectSize}`;
  if (p.scopeOfServices) entry += `\n  Scope of Services: ${p.scopeOfServices}`;
  if (p.designValue) entry += ` | Design Value: ${p.designValue}`;
  if (p.fabricationValue) entry += ` | Fabrication Value: ${p.fabricationValue}`;
  if (p.status) entry += `\n  Status: ${p.status}`;
  entry += `\n  ${truncate(p.summary, 300)}`;
  return entry;
}).join('\n');

// ---- Build schedule section ----
const scheduleSection = capList(merged.schedules, 3).map(s =>
  `Template: ${s.template}\nPhases: ${truncate(s.phases, 500)}\nDuration: ${s.totalDuration || 'TBD'}`
).join('\n---\n');

// ---- Build rates section ----
const ratesSection = capList(merged.rates, 10).map(r =>
  `- ${r.role}: ${r.rate}${r.notes ? ' (' + r.notes + ')' : ''}`
).join('\n');

// ---- Boilerplate entries (only the 4 we need, same as v2) ----
const firmOverviewBP = findBP('firm overview') || findBP('overview');
const missionBP = findBP('mission');
const firmHistoryBP = findBP('firm history') || findBP('history');
const disputesBP = findBP('dispute');

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
const prompt = `You are a proposal writer for Outer Image LLC, a Brooklyn-based WBE-certified signage design, fabrication, and implementation studio located at 226 42nd Street, Brooklyn, NY 11232. Phone: 212.661.2124. Website: www.outerimage.com.

Generate a complete proposal response for the following RFP using the standard proposal template sections below.

=== RFP DATA ===
Issuer: ${rfp.issuer || 'Unknown'}
Project Title: ${rfp.projectTitle || 'Unknown'}
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

--- CLIENT REFERENCES ---
${refsSection || 'No references available.'}

--- PORTFOLIO PROJECTS ---
${portfolioSection || 'No portfolio projects available.'}

--- PROJECT SCHEDULE TEMPLATES ---
${scheduleSection || 'No schedule templates available.'}

--- RATE SCHEDULES ---
${ratesSection || 'No rate schedules available.'}

--- BOILERPLATE: FIRM OVERVIEW ---
${truncate(firmOverviewBP, 1000) || 'Not available.'}

--- BOILERPLATE: MISSION ---
${truncate(missionBP, 500) || 'Not available.'}

--- BOILERPLATE: FIRM HISTORY ---
${truncate(firmHistoryBP, 500) || 'Not available.'}

--- BOILERPLATE: DISPUTES ---
${truncate(disputesBP, 300) || 'Not available.'}

=== PROPOSAL INSTRUCTIONS ===

Generate the proposal in markdown format. Start with ## 1. Firm Overview and continue with the standard sections below. Do NOT generate a cover letter.

## 1. Firm Overview
Write exactly 3 paragraphs:
- Paragraph 1: Use the Firm Overview boilerplate as the foundation (adapt, don't copy verbatim). Frame Outer Image's introduction through the lens of the ${serviceLine} service line${industry ? ` and its deep experience in the ${industry} sector` : ''}.
- Paragraph 2: Expand on Outer Image's capabilities specifically relevant to ${serviceLine} work${industry ? ` for ${industry} clients` : ''}. Emphasize experience, certifications, and team strengths that matter most to ${industry || 'this type of'} client${industry === 'Government' ? ' (e.g., compliance, code requirements, public-facing durability, WBE/MBE certification)' : industry === 'Corporate' ? ' (e.g., brand alignment, aesthetic quality, stakeholder coordination, high-profile environments)' : industry === 'Non-Profit' ? ' (e.g., cost-effectiveness, mission-driven design, community impact, budget sensitivity)' : industry === 'Health' ? ' (e.g., ADA compliance, wayfinding clarity, patient experience, regulatory standards, durability)' : 's'}.
- Paragraph 3: ONE closing paragraph that references ONLY projects from the PORTFOLIO PROJECTS data above whose Client Tier matches "${industry || 'the RFP sector'}". ONLY mention projects that have a matching Client Tier — do NOT mix sectors. If fewer than 2 matching projects exist, broaden slightly but note the relevance. NEVER mention a client from CLIENT REFERENCES as a project — references and portfolio are separate data sources.

## 2. Project Overview
Write 2-3 paragraphs tailored specifically to the RFP issuer explaining why Outer Image is uniquely positioned for this project. Frame the response around Outer Image's ${serviceLine} capabilities${industry ? ` and proven track record with ${industry} clients` : ''}. Reference specific details from the RFP scope of work and any supplementary documents. Address evaluation criteria directly.${industry ? ` Highlight how Outer Image's experience serving ${industry} organizations translates directly to this project's needs.` : ''} Do NOT invent specific internal processes, proprietary methodologies, or named QA/QC procedures. Keep capability claims grounded in the data provided (team experience, portfolio projects, certifications).

## 3. Corporate Information

### 3.21 Firm History
Use the Firm History boilerplate. Keep to 1 paragraph.

### 3.22 Office Location
226 42nd Street, Brooklyn, NY 11232. Mention proximity/accessibility to the project location if known from the RFP or supplementary documents.

### 3.23 Project Team
List the team members from the bios provided. For each: Name, Title, and a 2-sentence summary of their relevant experience. Match team to the service line.

### 3.24 Disputes
Use the Disputes boilerplate. If it says "none", state clearly: "Outer Image LLC has no record of disputes, litigation, or contract terminations."

### 3.25 Mission
Use the Mission boilerplate. Keep to 1 paragraph.

## 4. Project Approach
IMPORTANT: All subsections below (4.26–4.34) must follow the zero-hallucination policy. Write in general professional terms about Outer Image's approach. Do NOT invent specific proprietary methodology names, named internal processes, specific software tools not listed in team bios, or specific procedural steps that are not found in the Airtable data above. When describing capabilities, ground them in the team's actual experience and portfolio projects.

### 4.26 Unique Systems
Describe Outer Image's approach to signage systems for this project type. Base this on the team's experience from PORTFOLIO PROJECTS and TEAM BIOS. Do not claim "proprietary" systems or named methodologies that are not in the data.

### 4.27 Wayfinding Design
Explain the wayfinding methodology in general professional terms. If supplementary documents include site plans or maps, reference specific site conditions. Do not invent specific named methodologies.

### 4.28 Stakeholder Input
Describe the stakeholder engagement process in general terms.

### 4.29 Cost Management
Explain cost control approach in general terms. If budget information is available from the RFP or supplementary docs, reference it. Do NOT invent specific dollar figures for cost savings or budget targets.

### 4.30 Coordination
Describe coordination with other contractors/consultants. If a GC or other parties are mentioned in supplementary docs, reference them.

### 4.31 Quality Assurance
Describe QA/QC procedures. Keep descriptions general — do NOT invent specific process names, checklists, or procedures that are not mentioned in the data above. Use language like "Outer Image maintains rigorous quality standards throughout the project lifecycle" rather than fabricating specific named processes.

### 4.32 CAD/Revit Deliverables
List standard deliverable formats. ONLY mention software tools that are explicitly named in the TEAM BIOS section above. Do NOT add software tools (e.g., Rhino, SolidWorks, Bluebeam) that are not mentioned in the team bios data.

### 4.33 Internal Structure
Describe the project management structure. Base this on the team roles listed in TEAM BIOS — do not invent departments, titles, or organizational structures not reflected in the data.

### 4.34 Proposed Fee
Reference the rate schedule data ONLY. Present the hourly rates from the RATE SCHEDULES section in a readable summary format. Do NOT calculate, estimate, or invent any lump-sum project fees, total costs, or reimbursable expense amounts. If no rate data is available, state: "Outer Image will provide a detailed fee proposal upon further discussion of the project scope."

## 5.2 Proposed Schedule
Create a markdown table with columns: | Activity | Days to Complete | Anticipated Dates |
Base this on the schedule template data. Include at minimum: Design Development, Client Review, Fabrication Drawings, Fabrication, Installation.

## 5.03 Project Experience
List up to 5 relevant projects from the portfolio. For each project, use this EXACT format. End EVERY line with two trailing spaces to force a markdown line break, then start the next field on a new line. Separate each project with a blank line.

**[Project Name]**
**Client:** [Client Name]
**Location:** [Location]
**GC:** [General Contractor]
**Status:** [Status]
**Project Size:** [Size]
**Scope of Services:** [Scope]
**Design Value:** $[Value]
**Fabrication Value:** $[Value]
[1-2 sentence description]

IMPORTANT FORMATTING: Every line above MUST end with two trailing spaces (markdown line break) so each field renders on its own line. Design Value and Fabrication Value must be formatted as currency with a dollar sign and commas (e.g., "$310,000" not "310000").

CRITICAL RULES FOR PROJECT EXPERIENCE:
- ONLY use projects listed in the PORTFOLIO PROJECTS section above. Do NOT invent, fabricate, or hallucinate any projects.
- NEVER duplicate a project — each project may appear ONLY ONCE in section 5.03.
- If a field value is not provided in the portfolio data, write "[Not provided]" — do NOT make up values.
- PRIORITY ORDER for selecting projects:
  1. FIRST: Projects matching BOTH Service Line "${serviceLine}" AND Client Tier "${industry || 'any'}"
  2. SECOND: Projects matching Client Tier "${industry || 'any'}" (any service line)
  3. THIRD: Projects matching Service Line "${serviceLine}" (any client tier)
  4. LAST: Any remaining projects to fill up to 5 total
- The goal is to demonstrate relevant ${industry || 'sector'} experience through project selection. A proposal for a ${industry || 'specific sector'} client should showcase primarily ${industry || 'similar'} projects.

=== ZERO-HALLUCINATION POLICY (APPLIES TO THE ENTIRE PROPOSAL) ===
These rules override everything else and apply to EVERY section — Firm Overview, Project Overview, Project Approach, Project Experience, and all others.

1. DATA SOURCES ARE SILOED. Each Airtable section above is a separate, authoritative source:
   - PORTFOLIO PROJECTS = the ONLY source for project names, descriptions, locations, values, and GCs.
   - CLIENT REFERENCES = the ONLY source for client contact names, emails, and phones. References are NOT projects — never describe a reference as if it were a completed project.
   - TEAM BIOS = the ONLY source for team member names, titles, and experience descriptions.
   - RATE SCHEDULES = the ONLY source for hourly rates and role pricing.
   - BOILERPLATE = the ONLY source for firm overview, mission, history, and disputes language.

2. NEVER CROSS-POLLINATE. If a client name appears in CLIENT REFERENCES but NOT in PORTFOLIO PROJECTS, you MUST NOT describe any project work for that client anywhere in the proposal. A reference is proof that Outer Image has a relationship with that client — it is NOT proof of a specific project, scope, budget, or deliverable.

3. NEVER INVENT. If information is not explicitly provided in the data above, do not create it. This includes:
   - Project names, scopes, budgets, or descriptions not in PORTFOLIO PROJECTS
   - Team qualifications, degrees, or past employers not in TEAM BIOS
   - Client contact details not in CLIENT REFERENCES
   - Rates not in RATE SCHEDULES
   - Firm claims not in BOILERPLATE
   - Software tools not mentioned in TEAM BIOS (do NOT add tools like Rhino, SolidWorks, Bluebeam, etc. unless they appear in the bios)
   - Lump-sum fees, total project costs, or reimbursable expense amounts (ONLY use hourly rates from RATE SCHEDULES)
   - Named proprietary methodologies, named QA processes, or named internal procedures (keep process descriptions general and professional)

4. MISSING DATA. When a field in the provided data is empty, null, or absent:
   - In section 5.03: write "[Field Name]" as a placeholder (e.g., "[General Contractor]", "[Value]")
   - In section 4.34: If no rate schedule data is available, state "Outer Image will provide a detailed fee proposal upon further discussion of project scope" — do NOT invent a fee
   - In all other sections: omit the detail entirely rather than guessing or filling in a plausible value

5. WHEN IN DOUBT, LEAVE IT OUT. If you are not 100% certain a fact came from the Airtable data above, do not include it. This applies especially to:
   - Dollar amounts of any kind (fees, budgets, costs) — NEVER estimate or invent dollar figures
   - Software tool names — ONLY list tools found in TEAM BIOS
   - Process names or methodology names — keep descriptions general

=== FORMATTING RULES ===
1. Use markdown headings: ## for main sections, ### for subsections
2. Do NOT wrap the output in code fences (\`\`\`markdown or \`\`\`)
3. Start the output with ## 1. Firm Overview (no cover letter)
4. Use markdown table syntax for section 5.2 (pipes and dashes)
5. Bold text with **double asterisks**
6. No bullet points in section 5.03 — use the labeled field format specified above
7. In section 5.03, end EVERY field line with two trailing spaces so markdown renders each on its own line. Format dollar amounts as currency (e.g., "$310,000")
8. Reference supplementary document details naturally — do NOT just list them
9. Total output should be approximately 2,500-3,500 words`;

return [{
  json: {
    prompt,
    model: 'gpt-4o',
    maxTokens: 10000,
    temperature: 0.7,
  }
}];
