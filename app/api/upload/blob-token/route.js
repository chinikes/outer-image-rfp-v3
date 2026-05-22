/**
 * GET /api/upload/blob-token
 *
 * Generates a client-side upload token for Vercel Blob.
 * The frontend uses this to upload files directly to Blob storage,
 * bypassing the serverless function's 4.5MB body size limit.
 */
import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request) {
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Validate the upload path
        return {
          allowedContentTypes: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg",
            "image/png",
            "text/csv",
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB per file
          tokenPayload: JSON.stringify({ pathname }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Optional: could log or do server-side work after upload
        console.log("Blob upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error("Blob token error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
