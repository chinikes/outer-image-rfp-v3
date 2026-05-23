/**
 * POST /api/proposals/[id]/score
 *
 * Scores how well a proposal draft covers the RFP requirements.
 * Uses OpenAI API to analyze coverage and provide scoring data.
 */

import { NextResponse } from "next/server";
import { getRfpById } from "@/lib/airtable";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Proposal ID is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { extractedData, generatedDraft } = body;

    if (!extractedData || !generatedDraft) {
      return NextResponse.json(
        { error: "extractedData and generatedDraft are required" },
        { status: 400 }
      );
    }

    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Build the scoring prompt
    const scoringPrompt = `You are an expert RFP analyst. Analyze how well the following proposal draft covers the RFP requirements.

RFP Requirements (Extracted):
${JSON.stringify(extractedData, null, 2)}

Proposal Draft:
${generatedDraft}

Provide a detailed scoring analysis in JSON format with the following structure:
{
  "overallScore": <number 0-100>,
  "requirements": [
    {
      "requirement": "<requirement name>",
      "covered": <boolean>,
      "notes": "<analysis notes>"
    }
  ],
  "strengths": [<array of strength descriptions>],
  "gaps": [<array of identified gaps>],
  "suggestions": [<array of improvement suggestions>]
}

Respond ONLY with valid JSON, no additional text.`;

    // Call OpenAI API
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [
            {
              role: "user",
              content: scoringPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      }
    );

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json();
      console.error("OpenAI API error:", errorData);
      return NextResponse.json(
        { error: "Failed to score proposal with OpenAI API" },
        { status: 500 }
      );
    }

    const openaiData = await openaiResponse.json();

    // Extract the scoring data from OpenAI response
    let scoringData;
    try {
      const responseText =
        openaiData.choices[0].message.content.trim();
      scoringData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      return NextResponse.json(
        { error: "Failed to parse scoring data from API response" },
        { status: 500 }
      );
    }

    // Validate the scoring data structure
    if (
      typeof scoringData.overallScore !== "number" ||
      !Array.isArray(scoringData.requirements) ||
      !Array.isArray(scoringData.strengths) ||
      !Array.isArray(scoringData.gaps) ||
      !Array.isArray(scoringData.suggestions)
    ) {
      return NextResponse.json(
        { error: "Invalid scoring data structure from API" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      score: scoringData,
    });
  } catch (error) {
    console.error("Error scoring proposal:", error);
    return NextResponse.json(
      { error: "Failed to score proposal" },
      { status: 500 }
    );
  }
}
