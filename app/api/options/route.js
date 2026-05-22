/**
 * GET /api/options
 *
 * Returns dropdown options for the upload form.
 * - serviceLines: distinct Service Line values from Portfolio + Client References
 * - clientTiers: distinct Client Tier values from Portfolio + Client References
 *
 * Cached for 5 minutes to avoid hammering Airtable.
 */
import { NextResponse } from "next/server";
import { getDropdownOptions } from "@/lib/airtable";

export const dynamic = "force-dynamic";

let cachedOptions = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET() {
  try {
    const now = Date.now();
    if (cachedOptions && now < cacheExpiry) {
      return NextResponse.json(cachedOptions);
    }

    const options = await getDropdownOptions();
    cachedOptions = options;
    cacheExpiry = now + CACHE_TTL;

    return NextResponse.json(options);
  } catch (error) {
    console.error("Options fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch options" },
      { status: 500 }
    );
  }
}
