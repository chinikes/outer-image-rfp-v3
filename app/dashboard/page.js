"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function StatusBadge({ status }) {
  const config = {
    Received: "bg-gray-200 text-gray-600",
    Parsing: "bg-yellow-100 text-yellow-800",
    Drafting: "bg-blue-100 text-blue-800",
    "Ready for Review": "bg-green-100 text-green-800",
    Finalized: "bg-purple-100 text-purple-800",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${config[status] || config["Received"]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {status}
    </span>
  );
}

function ServiceBadge({ line }) {
  const config = {
    "Design Only": "bg-blue-50 text-blue-700 border-blue-200",
    "Design + Fabrication": "bg-green-50 text-green-700 border-green-200",
    "Fabrication Only": "bg-orange-50 text-orange-700 border-orange-200",
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${config[line] || config["Design Only"]}`}>
      {line}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [configured, setConfigured] = useState(true);

  const statuses = ["All", "Received", "Parsing", "Drafting", "Ready for Review", "Finalized"];

useEffect(() => {
  async function fetchProposals() {
    try {
      const res = await fetch('/api/proposals', { cache: 'no-store' });
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  fetchProposals();
  const interval = setInterval(fetchProposals, 10000);
  return () => clearInterval(interval);
}, []);

  const filtered =
    filter === "All"
      ? proposals
      : proposals.filter((p) => p.status === filter);

  const stats = {
  total: proposals.length,
  active: proposals.filter(p => !["Finalized", "Error"].includes(p.status)).length,
  ready: proposals.filter(p => p.status === "Ready for Review").length
};

  return (
    <div className="max-w-[960px] mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-brand-navy tracking-tight">
            Proposal Dashboard
          </h1>
          <p className="text-[15px] text-gray-500 mt-1.5">
            Track RFPs through the pipeline
          </p>
        </div>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg bg-gradient-to-br from-brand-teal to-brand-teal-accent text-white text-sm font-semibold no-underline hover:opacity-90 transition-all"
        >
          + New RFP
        </Link>
      </div>

      {/* Setup banner when Airtable isn't configured */}
      {!configured && (
        <div className="mb-8 p-5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚙️</span>
            <div>
              <div className="font-semibold text-amber-800 text-sm mb-1">
                Airtable Not Connected
              </div>
              <div className="text-amber-700 text-sm leading-relaxed">
                The dashboard will populate once Airtable is configured. Add your{" "}
                <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">
                  AIRTABLE_API_KEY
                </code>{" "}
                and{" "}
                <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">
                  AIRTABLE_BASE_ID
                </code>{" "}
                to{" "}
                <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs font-mono">
                  .env.local
                </code>{" "}
                and restart the dev server.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total RFPs", value: stats.total, color: "text-brand-navy" },
          { label: "In Pipeline", value: stats.active, color: "text-brand-teal" },
          { label: "Ready for Review", value: stats.ready, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              {s.label}
            </div>
            <div className={`text-3xl font-bold tracking-tight ${s.color}`}>
              {loading ? "—" : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all
              ${filter === s
                ? "bg-brand-navy text-white border-none"
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <div className="grid grid-cols-[2.5fr_1.2fr_1.2fr_1fr_36px] px-5 py-3 bg-gray-50 border-b border-gray-200">
          {["RFP", "Service Line", "Status", "Deadline", ""].map((h) => (
            <div key={h} className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {h}
            </div>
          ))}
        </div>

        {loading && (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">
            Loading proposals...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">
            {configured
              ? <>No proposals found. <Link href="/" className="text-brand-teal font-medium">Upload your first RFP</Link></>
              : "Connect Airtable to see proposals here."}
          </div>
        )}

        {filtered.map((p, i) => {
          const clickable = p.status === "Ready for Review" || p.status === "Finalized";
          return (
            <div
              key={p.id}
              onClick={() => { if (clickable) router.push(`/proposals/${p.id}`); }}
              className={`grid grid-cols-[2.5fr_1.2fr_1.2fr_1fr_36px] px-5 py-4 items-center hover:bg-gray-50 transition-colors
                ${i < filtered.length - 1 ? "border-b border-gray-100" : ""}
                ${clickable ? "cursor-pointer" : ""}`}
            >
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-0.5">{p.rfpName}</div>
                <div className="text-xs text-gray-400">
                  {p.uploadedAt && new Date(p.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              <div>{p.serviceLine && <ServiceBadge line={p.serviceLine} />}</div>
              <div><StatusBadge status={p.status} /></div>
              <div className="text-[13px] text-gray-600 font-medium">
                {p.deadline && new Date(p.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
              <div>
                {clickable && (
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <polyline strokeLinecap="round" strokeLinejoin="round" points="9 18 15 12 9 6"/>
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
