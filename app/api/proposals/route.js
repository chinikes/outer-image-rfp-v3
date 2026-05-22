/**
 * GET /api/proposals
 *
 * Returns all RFP records from Airtable for the dashboard view.
 * Returns empty array with a config warning when Airtable isn't set up.
 */

import { NextResponse } from "next/server";
import { getAllRfps, isAirtableConfigured } from "@/lib/airtable";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    if (!isAirtableConfigured()) {
      return NextResponse.json({
        proposals: [],
        configured: false,
        message:
          "Airtable is not configured. Add AIRTABLE_API_KEY and AIRTABLE_BASE_ID to .env.local to connect.",
      });
    }

    const proposals = await getAllRfps();
    return NextResponse.json({ proposals, configured: true });
  } catch (error) {
    console.error("Error fetching proposals:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposals", proposals: [] },
      { status: 500 }
    );
  }
}
