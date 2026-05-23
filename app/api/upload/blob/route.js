/**
 * POST /api/upload/blob
 *
 * Server-side file upload to Vercel Blob using put().
 * This bypasses the client-side token flow entirely —
 * the BLOB_READ_WRITE_TOKEN is used directly on the server.
 *
 * Accepts: FormData with a single "file" field and a "pathname" field.
 * Returns: { url, pathname } of the uploaded blob.
 */
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const pathname = formData.get("pathname");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!pathname) {
      return NextResponse.json(
        { error: "No pathname provided" },
        { status: 400 }
      );
    }

    // Upload directly to Vercel Blob using server-side token
    const blob = await put(pathname, file, {
      access: "public",
      // token is read automatically from BLOB_READ_WRITE_TOKEN env var
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (error) {
    console.error("Server blob upload error:", error);
    return NextResponse.json(
      { error: error.message || "Blob upload failed" },
      { status: 500 }
    );
  }
}
