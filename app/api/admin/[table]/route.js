export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from "next/server";
import Airtable from "airtable";

const isConfigured = process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID;
const base = isConfigured
  ? new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID)
  : null;

const tableMap = {
  "team-bios": "Team Bios",
  "client-references": "Client References",
  "portfolio": "Portfolio",
  "rate-schedules": "Rate Schedules",
  "boilerplate": "Boilerplate Content",
  "project-schedules": "Project Schedules",
};

export async function GET(req, { params }) {
  if (!isConfigured) {
    return NextResponse.json({ error: "Airtable not configured" }, { status: 503 });
  }
  const tableName = tableMap[params.table];
  if (!tableName) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  try {
    const records = await base(tableName).select().all();
    const data = records.map((r) => ({
      id: r.id,
      ...r.fields,
    }));
    return NextResponse.json({ records: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  if (!isConfigured) {
    return NextResponse.json({ error: "Airtable not configured" }, { status: 503 });
  }
  const tableName = tableMap[params.table];
  if (!tableName) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  try {
    const { fields } = await req.json();
    // typecast lets Airtable coerce string inputs (e.g. "125" → currency number,
    // select option names) so new records with number/currency/select fields save.
    const [record] = await base(tableName).create(
      [{ fields }],
      { typecast: true }
    );
    return NextResponse.json({ id: record.id, ...record.fields });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
