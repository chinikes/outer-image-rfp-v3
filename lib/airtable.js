/**
 * Airtable Client for Outer Image RFP Portal
 *
 * Provides typed access to all Airtable tables.
 * Returns empty data gracefully when API keys are not configured.
 */

import Airtable from "airtable";

// ============================================
// CONNECTION CHECK
// ============================================

const isConfigured =
  process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID;

let base = null;
let tables = {};

if (isConfigured) {
  base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
    process.env.AIRTABLE_BASE_ID
  );
  tables = {
    rfpTracker: base("RFP Tracker"),
    teamBios: base("Team Bios"),
    clientReferences: base("Client References"),
    portfolio: base("Portfolio"),
    rateSchedules: base("Rate Schedules"),
    boilerplate: base("Boilerplate Content"),
    projectSchedules: base("Project Schedules"),
  };
}

/**
 * Check if Airtable is configured.
 * API routes use this to return mock data during development.
 */
export function isAirtableConfigured() {
  return isConfigured;
}

// ============================================
// RFP TRACKER
// ============================================

export async function createRfpRecord({ rfpName, fileUrl, industry, serviceLine }) {
  if (!isConfigured) {
    console.warn("Airtable not configured — returning mock record");
    return {
      id: `mock_${Date.now()}`,
      rfpId: rfpName,
      status: "Received",
    };
  }

  const baseFields = {
    "RFP Name": rfpName,
    Status: "Received",
    "File URL": fileUrl,
    "Uploaded At": new Date().toISOString(),
  };

  // "Client Tier" and "Service Line (Detected)" are single-select fields.
  // If the user-selected value isn't an existing option (and the API token
  // can't create new options), Airtable returns INVALID_MULTIPLE_CHOICE_OPTIONS.
  // These values are also passed to n8n directly via the webhook, so the
  // pipeline doesn't depend on them being stored here. To keep uploads from
  // failing, we try to store them but fall back to a record without them.
  const selectFields = {};
  if (industry) selectFields["Client Tier"] = industry;
  if (serviceLine) selectFields["Service Line (Detected)"] = serviceLine;

  let record;
  try {
    record = await tables.rfpTracker.create({ ...baseFields, ...selectFields });
  } catch (err) {
    if (Object.keys(selectFields).length > 0) {
      console.warn(
        "createRfpRecord: select-field write failed, retrying without Client Tier / Service Line (Detected):",
        err.message
      );
      record = await tables.rfpTracker.create(baseFields);
    } else {
      throw err;
    }
  }

  return {
    id: record.id,
    rfpId: record.get("RFP Name"),
    status: record.get("Status"),
  };
}

export async function updateRfpStatus(recordId, status, extraFields = {}) {
  if (!isConfigured) {
    console.warn("Airtable not configured — skipping status update");
    return null;
  }

  const record = await tables.rfpTracker.update(recordId, {
    Status: status,
    ...extraFields,
  });
  return record;
}

export async function getAllRfps() {
  if (!isConfigured) {
    return [];
  }

  const records = await tables.rfpTracker
    .select({
      sort: [{ field: "Uploaded At", direction: "desc" }],
    })
    .all();

  return records.map((r) => ({
    id: r.id,
    rfpName: r.get("RFP Name"),
    status: r.get("Status"),
    serviceLine: r.get("Service Line (Detected)") || null,
    deadline: r.get("Submission Deadline") || null,
    fileUrl: r.get("File URL"),
    extractedData: r.get("Extracted Data (JSON)")
      ? JSON.parse(r.get("Extracted Data (JSON)"))
      : null,
    generatedDraft: r.get("Generated Draft") || null,
    uploadedAt: r.get("Uploaded At"),
    industry: r.get("Client Tier") || null,
  }));
}

export async function getRfpById(recordId) {
  if (!isConfigured) {
    return null;
  }

  const r = await tables.rfpTracker.find(recordId);
  return {
    id: r.id,
    rfpName: r.get("RFP Name"),
    status: r.get("Status"),
    serviceLine: r.get("Service Line (Detected)") || null,
    deadline: r.get("Submission Deadline") || null,
    fileUrl: r.get("File URL"),
    extractedData: r.get("Extracted Data (JSON)")
      ? JSON.parse(r.get("Extracted Data (JSON)"))
      : null,
    generatedDraft: r.get("Generated Draft") || null,
    uploadedAt: r.get("Uploaded At"),
    industry: r.get("Client Tier") || null,
  };
}

// ============================================
// DROPDOWN OPTIONS (distinct values)
// ============================================

export async function getDropdownOptions() {
  // Base options — these match the Airtable field configurations
  const baseServiceLines = ["Design Only", "Design + Fabrication", "Fabrication Only", "Fabrication + Installation"];
  const baseClientTiers = ["Government", "Corporate", "Non-Profit", "Mid-Market", "Health"];

  if (!isConfigured) {
    return { serviceLines: baseServiceLines, clientTiers: baseClientTiers };
  }

  // Pull values from Portfolio, Client References, and Team Bios to catch any extras
  const [portfolioRecords, refRecords, teamRecords] = await Promise.all([
    tables.portfolio.select({ fields: ["Service Line", "Client Tier"] }).all(),
    tables.clientReferences.select({ fields: ["Service Line", "Client Tier"] }).all(),
    tables.teamBios.select({ fields: ["Service Lines"] }).all(),
  ]);

  const serviceLineSet = new Set(baseServiceLines);
  const clientTierSet = new Set(baseClientTiers);

  for (const r of [...portfolioRecords, ...refRecords]) {
    const sl = r.get("Service Line");
    const ct = r.get("Client Tier");
    if (sl) serviceLineSet.add(sl);
    if (ct) clientTierSet.add(ct);
  }

  // Team Bios use a multiselect "Service Lines" field
  for (const r of teamRecords) {
    const sls = r.get("Service Lines");
    if (Array.isArray(sls)) sls.forEach((s) => serviceLineSet.add(s));
  }

  return {
    serviceLines: [...serviceLineSet].sort(),
    clientTiers: [...clientTierSet].sort(),
  };
}

// ============================================
// CONTENT QUERIES
// ============================================

export async function getTeamBios(serviceLine = null) {
  if (!isConfigured) return [];
  const options = serviceLine
    ? { filterByFormula: `FIND("${serviceLine}", {Service Lines})` }
    : {};
  const records = await tables.teamBios.select(options).all();
  return records.map((r) => ({
    id: r.id,
    name: r.get("Name"),
    title: r.get("Title"),
    role: r.get("Role") || null,
    bioShort: r.get("Bio (Short)"),
    bioFull: r.get("Bio (Full)"),
    serviceLines: r.get("Service Lines"),
    certifications: r.get("Certifications"),
    portfolioProjects: r.get("Portfolio Projects") || null,
  }));
}

export async function getReferences(serviceLine = null, clientTier = null) {
  if (!isConfigured) return [];
  let formula = [];
  if (serviceLine) formula.push(`{Service Line} = "${serviceLine}"`);
  if (clientTier) formula.push(`{Client Tier} = "${clientTier}"`);
  const options =
    formula.length > 0
      ? { filterByFormula: formula.length > 1 ? `AND(${formula.join(",")})` : formula[0] }
      : {};
  const records = await tables.clientReferences.select(options).all();
  return records.map((r) => ({
    id: r.id,
    clientName: r.get("Client Name"),
    projectName: r.get("Project Name"),
    serviceLine: r.get("Service Line"),
    description: r.get("Project Description"),
    clientTier: r.get("Client Tier"),
    contactName: r.get("Contact Name"),
    contactEmail: r.get("Contact Email") || r.get("Contact Info") || null,
    contactPhone: r.get("Contact Phone") || null,
    year: r.get("Year") || null,
  }));
}

export async function getPortfolio(serviceLine = null) {
  if (!isConfigured) return [];
  // Fetch all portfolio projects — no longer filtering by exact service line match.
  // The prompt assembly will prioritize relevant projects.
  const records = await tables.portfolio.select().all();
  return records.map((r) => ({
    id: r.id,
    projectName: r.get("Project Name"),
    client: r.get("Client Name") || r.get("Client") || null,
    serviceLine: r.get("Service Line"),
    clientTier: r.get("Client Tier"),
    summary: r.get("Summary"),
    location: r.get("Location") || null,
    gc: r.get("General Contractor") || null,
    projectSize: r.get("Project Size") || null,
    scopeOfServices: r.get("Scope of Services") || null,
    designValue: r.get("Design Value") || null,
    fabricationValue: r.get("Fabrication Value") || null,
    status: r.get("Status") || null,
    completionDate: r.get("Completion Date") || null,
    portfolioUrl: r.get("Portfolio URL") || null,
    projectTypeTags: r.get("Project Type Tags"),
  }));
}

export async function getRateSchedules(serviceType = null) {
  if (!isConfigured) return [];
  const options = serviceType
    ? { filterByFormula: `{Service Type} = "${serviceType}"` }
    : {};
  const records = await tables.rateSchedules.select(options).all();
  return records.map((r) => ({
    id: r.id,
    serviceType: r.get("Service Type"),
    roleLineItem: r.get("Role / Line Item"),
    rate: r.get("Rate"),
    notes: r.get("Notes"),
  }));
}

export async function getBoilerplate(serviceLine = null) {
  if (!isConfigured) return [];
  const options = serviceLine
    ? { filterByFormula: `FIND("${serviceLine}", {Service Lines})` }
    : {};
  const records = await tables.boilerplate.select(options).all();
  return records.map((r) => ({
    id: r.id,
    sectionName: r.get("Section Name"),
    content: r.get("Content"),
    serviceLines: r.get("Service Lines"),
    lastUpdated: r.get("Last Updated"),
  }));
}

export async function getProjectSchedule(serviceLine = null) {
  if (!isConfigured) return [];
  const options = serviceLine
    ? { filterByFormula: `{Service Line} = "${serviceLine}"` }
    : {};
  const records = await tables.projectSchedules.select(options).all();
  return records.map((r) => ({
    id: r.id,
    templateName: r.get("Template Name"),
    serviceLine: r.get("Service Line"),
    phases: r.get("Phases"),
    totalDuration: r.get("Total Duration"),
    notes: r.get("Notes"),
  }));
}
