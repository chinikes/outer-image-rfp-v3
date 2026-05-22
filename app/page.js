"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/csv",
];

const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".xlsx",
  ".xls",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".csv",
];

const MAX_FILES = 10;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

function getFileIcon(type, name) {
  const ext = name.split(".").pop().toLowerCase();
  if (type === "application/pdf" || ext === "pdf") return "📄";
  if (type.includes("spreadsheet") || type.includes("excel") || ["xlsx", "xls", "csv"].includes(ext)) return "📊";
  if (type.includes("wordprocessing") || ["docx", "doc"].includes(ext)) return "📝";
  if (type.startsWith("image/") || ["jpg", "jpeg", "png"].includes(ext)) return "🖼️";
  return "📎";
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    (newFiles) => {
      setError(null);
      const fileArray = Array.from(newFiles);

      // Validate file types
      const invalid = fileArray.filter((f) => {
        const ext = "." + f.name.split(".").pop().toLowerCase();
        return !ACCEPTED_TYPES.includes(f.type) && !ACCEPTED_EXTENSIONS.includes(ext);
      });
      if (invalid.length > 0) {
        setError(
          `Unsupported file type: ${invalid.map((f) => f.name).join(", ")}. Accepted: PDF, Excel, Word, CSV, JPG, PNG.`
        );
        return;
      }

      // Validate file sizes
      const oversized = fileArray.filter((f) => f.size > MAX_FILE_SIZE);
      if (oversized.length > 0) {
        setError(
          `File too large: ${oversized.map((f) => f.name).join(", ")}. Maximum 50MB per file.`
        );
        return;
      }

      // Check total count
      const combined = [...files, ...fileArray];
      if (combined.length > MAX_FILES) {
        setError(`Maximum ${MAX_FILES} files allowed. You have ${files.length}, tried to add ${fileArray.length}.`);
        return;
      }

      setFiles(combined);
    },
    [files]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const removeFile = (index) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (primaryIndex === index) setPrimaryIndex(0);
      else if (primaryIndex > index) setPrimaryIndex((p) => p - 1);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError("Please add at least one RFP file.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      // Step 1: Upload each file directly to Vercel Blob
      const blobFiles = [];
      const timestamp = Date.now();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(
          `Uploading file ${i + 1} of ${files.length}: ${file.name}...`
        );

        const blob = await upload(
          `rfps/${timestamp}-${i}-${file.name}`,
          file,
          {
            access: "public",
            handleUploadUrl: "/api/upload/blob-token",
          }
        );

        blobFiles.push({
          name: file.name,
          type: file.type,
          size: file.size,
          url: blob.url,
        });
      }

      // Step 2: Send blob URLs to our API
      setUploadProgress("Processing upload...");

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryIndex,
          files: blobFiles,
        }),
      });

      // Check content type before parsing
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          `Server returned non-JSON response (${response.status}): ${text.slice(0, 200)}`
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setSuccess({
        rfpId: data.proposal.rfpId,
        id: data.proposal.id,
        fileCount: data.proposal.fileCount,
        supplementaryCount: data.proposal.supplementaryCount,
      });
      setFiles([]);
      setPrimaryIndex(0);
      setUploadProgress("");
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Upload failed. Please try again.");
      setUploadProgress("");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">OI</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Outer Image RFP Portal
              </h1>
              <p className="text-xs text-gray-500">v3 — Multi-File Upload</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            View Dashboard →
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* Success State */}
        {success && (
          <div className="mb-8 bg-green-50 border border-green-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">✅</div>
              <div>
                <h3 className="font-semibold text-green-900">
                  RFP Uploaded Successfully
                </h3>
                <p className="text-green-700 text-sm mt-1">
                  <strong>{success.rfpId}</strong> — {success.fileCount} file
                  {success.fileCount > 1 ? "s" : ""} received
                  {success.supplementaryCount > 0 &&
                    ` (${success.supplementaryCount} supplementary)`}
                  . Processing has begun.
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => router.push(`/proposals/${success.id}`)}
                    className="text-sm bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    View Proposal
                  </button>
                  <button
                    onClick={() => setSuccess(null)}
                    className="text-sm text-green-700 hover:text-green-900 font-medium"
                  >
                    Upload Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <span className="text-red-500 text-lg">⚠️</span>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Upload Card */}
        {!success && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Upload RFP Documents
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Upload your primary RFP file and any supplementary documents.
                The primary file will be used for proposal generation.
              </p>
            </div>

            {/* Drop Zone */}
            <div className="p-6">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                }`}
              >
                <div className="text-4xl mb-3">📁</div>
                <p className="text-gray-700 font-medium">
                  Drag & drop files here, or click to browse
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  PDF, Excel, Word, CSV, JPG, PNG — up to 50MB each, max{" "}
                  {MAX_FILES} files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_EXTENSIONS.join(",")}
                  onChange={(e) => handleFiles(e.target.files)}
                  className="hidden"
                />
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="px-6 pb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Files ({files.length})
                  </h3>
                  <span className="text-xs text-gray-400">
                    Click the star to set primary RFP file
                  </span>
                </div>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        index === primaryIndex
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <button
                        onClick={() => setPrimaryIndex(index)}
                        className={`text-lg transition-all ${
                          index === primaryIndex
                            ? "text-blue-500 scale-110"
                            : "text-gray-300 hover:text-blue-400"
                        }`}
                        title={
                          index === primaryIndex
                            ? "Primary RFP file"
                            : "Set as primary"
                        }
                      >
                        {index === primaryIndex ? "⭐" : "☆"}
                      </button>
                      <span className="text-xl">
                        {getFileIcon(file.type, file.name)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                          {index === primaryIndex && (
                            <span className="ml-2 text-blue-600 font-semibold">
                              Primary RFP
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Remove file"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Submit Button */}
                <div className="mt-6">
                  <button
                    onClick={handleSubmit}
                    disabled={uploading || files.length === 0}
                    className={`w-full py-3 rounded-xl text-white font-semibold text-sm transition-all ${
                      uploading
                        ? "bg-blue-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                    }`}
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        {uploadProgress || "Processing..."}
                      </span>
                    ) : (
                      `Upload ${files.length} File${
                        files.length > 1 ? "s" : ""
                      } & Generate Proposal`
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-2">📤</div>
            <h3 className="font-semibold text-gray-900 text-sm">
              Multi-File Upload
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Upload your primary RFP plus supplementary files like floor plans,
              photos, or specs.
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-2">🤖</div>
            <h3 className="font-semibold text-gray-900 text-sm">
              AI-Powered Extraction
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Gemini 2.5 Flash extracts RFP requirements. GPT-4o generates your
              custom proposal.
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-2">✉️</div>
            <h3 className="font-semibold text-gray-900 text-sm">
              Cover Letter Included
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              v3 generates a personalized cover letter prepended to the full
              7-section proposal.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
