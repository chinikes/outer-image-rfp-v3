/**
 * n8n Code Node: "Merge All Content v3"
 *
 * Combines:
 *   - Primary RFP extracted data (from Gemini Parse PDF)
 *   - Airtable content (team bios, references, portfolio, etc.)
 *   - Supplementary file summaries (new in v3)
 *
 * This is the v3 version of v2's "Merge Content1" node.
 * Same Airtable field mappings, plus supplementary context.
 */

// ---- Primary RFP data (same as v2) ----
let extractedData = {};
try {
  extractedData = $('Extract Gemini Response').first().json.extractedData || {};
} catch (e) {}

let serviceLine = '';
try {
  serviceLine = $('Set Service Line').first().json.serviceLine || '';
} catch (e) {}

// ---- Airtable content (same as v2) ----
let teamBios = [];
try {
  teamBios = $('Fetch Team Bios').all().map(i => ({
    name: i.json.Name || i.json['Name'] || '',
    title: i.json.Title || i.json['Title'] || '',
    role: i.json.Role || i.json['Role'] || '',
    bio: i.json['Bio (Short)'] || i.json['Bio (Full)'] || '',
    certifications: i.json.Certifications || i.json['Certifications'] || '',
  }));
} catch (e) {}

let references = [];
try {
  references = $('Fetch Client References').all().map(i => ({
    client: i.json['Client Name'] || '',
    project: i.json['Project Name'] || '',
    description: i.json['Project Description'] || '',
    contactName: i.json['Contact Name'] || '',
    contactEmail: i.json['Contact Email'] || i.json['Contact Info'] || '',
    contactPhone: i.json['Contact Phone'] || '',
    year: i.json['Year'] || '',
    tier: i.json['Client Tier'] || '',
  }));
} catch (e) {}

let portfolio = [];
try {
  portfolio = $('Fetch Portfolio').all().map(i => ({
    project: i.json['Project Name'] || '',
    client: i.json['Client'] || i.json['Client Name'] || '',
    summary: i.json['Summary'] || '',
    location: i.json['Location'] || '',
    gc: i.json['GC'] || i.json['General Contractor'] || '',
    projectSize: i.json['Project Size'] || '',
    scopeOfServices: i.json['Scope of Services'] || '',
    designValue: i.json['Design Value'] || '',
    fabricationValue: i.json['Fabrication Value'] || '',
    status: i.json['Status'] || '',
    completionDate: i.json['Completion Date'] || '',
    tier: i.json['Client Tier'] || '',
    tags: i.json['Project Type Tags'] || '',
  }));
} catch (e) {}

let boilerplate = [];
try {
  boilerplate = $('Fetch Boilerplate Content').all().map(i => ({
    section: i.json['Section Name'] || '',
    content: i.json['Content'] || '',
  }));
} catch (e) {}

let schedules = [];
try {
  schedules = $('Fetch Project Schedules').all().map(i => ({
    template: i.json['Template Name'] || '',
    phases: i.json['Phases'] || '',
    totalDuration: i.json['Total Duration'] || '',
    notes: i.json['Notes'] || '',
  }));
} catch (e) {}

let rates = [];
try {
  rates = $('Fetch Rate Schedules').all().map(i => ({
    role: i.json['Role / Line Item'] || '',
    rate: i.json['Rate'] || '',
    notes: i.json['Notes'] || '',
  }));
} catch (e) {}

// ---- v3: Supplementary file summaries ----
let supplementarySummaries = [];
try {
  const summaryData = $('Collect Supplementary Summaries').first().json;
  supplementarySummaries = summaryData.supplementarySummaries || [];
} catch (e) {}

// ---- Assemble merged payload ----
return [{
  json: {
    // RFP data
    extractedData,
    serviceLine,

    // Airtable content
    teamBios,
    references,
    portfolio,
    boilerplate,
    schedules,
    rates,

    // v3: Supplementary context
    supplementarySummaries,
    hasSupplementary: supplementarySummaries.length > 0,

    // Metadata
    version: '3.0',
  }
}];
