/**
 * GET /api/proposals/[id]
 * PATCH /api/proposals/[id]
 *
 * GET: Returns full proposal data for a specific RFP by Airtable record ID.
 *      Includes extracted data and generated draft.
 * PATCH: Updates the RFP status and generated draft content.
 */

import { NextResponse } from "next/server";
import { getRfpById, updateRfpStatus } from "@/lib/airtable";

export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Proposal ID is required" },
        { status: 400 }
      );
    }

    const proposal = await getRfpById(id);

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ proposal });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposal" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Proposal ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { generatedDraft, status } = body;

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      );
    }

    // Update the RFP status with the generated draft
    const updateData = generatedDraft
      ? { "Generated Draft": generatedDraft }
      : {};

    const result = await updateRfpStatus(id, status, updateData);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to update proposal" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Proposal updated successfully",
      proposal: result,
    });
  } catch (error) {
    console.error("Error updating proposal:", error);
    return NextResponse.json(
      { error: "Failed to update proposal" },
      { status: 500 }
    );
  }
}
