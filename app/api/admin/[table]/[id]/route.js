export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

const tableMap = {
  "team-bios": "Team Bios",
  "client-references": "Client References",
  "portfolio": "Portfolio",
  "rate-schedules": "Rate Schedules",
  "boilerplate": "Boilerplate Content",
  "project-schedules": "Project Schedules",
};

export async function PUT(req, { params }) {
  const tableName = tableMap[params.table];
  if (!tableName) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  try {
    const { fields } = await req.json();
    const record = await base(tableName).update(params.id, fields);
    return NextResponse.json({ id: record.id, ...record.fields });
  } catch (err) {
    console.error("Admin update error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const tableName = tableMap[params.table];
  if (!tableName) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  try {
    await base(tableName).destroy(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
