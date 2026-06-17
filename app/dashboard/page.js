"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function StatusBadge({ status }) {
  const config = {
    Received: "bg-blue-100 text-blue-700",
    Parsing: "bg-amber-100 text-amber-700",
    Drafting: "bg-purple-100 text-purple-700",
    "Ready for Review": "bg-emerald-100 text-emerald-700",
    Finalized: "bg-black text-white",
    Error: "bg-red-100 text-red-700",
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
    "Design Only": "bg-neutral-100 text-neutral-700 border-neutral-300",
    "Design + Fabrication": "bg-neutral-900 text-white border-neutral-900",
    "Fabrication Only": "bg-neutral-200 text-neutral-800 border-neutral-300",
    "Fabrication + Installation": "bg-neutral-300 text-neutral-900 border-neutral-400",
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
  const [configured, setConfigured] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("All");
  const [industryFilter, setIndustryFilter] = useState("All");
  const [serviceLineFilter, setServiceLineFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const statuses = ["All", "Received", "Parsing", "Drafting", "Ready for Review", "Finalized"];

  useEffect(() => {
    async function fetchProposals() {
      try {
        const res = await fetch("/api/proposals", { cache: "no-store" });
        const data = await res.json();
        setProposals(data.proposals || []);
        if (data.configured === false) setConfigured(false);
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

  // Derive unique industries and service lines for filter dropdowns
  const industries = useMemo(() => {
    const set = new Set();
    proposals.forEach((p) => { if (p.industry) set.add(p.industry); });
    return [...set].sort();
  }, [proposals]);

  const serviceLines = useMemo(() => {
    const set = new Set();
    proposals.forEach((p) => { if (p.serviceLine) set.add(p.serviceLine); });
    return [...set].sort();
  }, [proposals]);

  // Apply all filters
  const filtered = useMemo(() => {
    let result = proposals;
    if (statusFilter !== "All") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (industryFilter !== "All") {
      result = result.filter((p) => p.industry === industryFilter);
    }
    if (serviceLineFilter !== "All") {
      result = result.filter((p) => p.serviceLine === serviceLineFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          (p.rfpName || "").toLowerCase().includes(q) ||
          (p.industry || "").toLowerCase().includes(q) ||
          (p.serviceLine || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [proposals, statusFilter, industryFilter, serviceLineFilter, searchQuery]);

  const stats = {
    total: proposals.length,
    active: proposals.filter((p) => !["Finalized", "Error"].includes(p.status)).length,
    ready: proposals.filter((p) => p.status === "Ready for Review").length,
  };

  const hasActiveFilters = industryFilter !== "All" || serviceLineFilter !== "All" || searchQuery.trim();

  return (
    <div className="max-w-[1060px] mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-black tracking-tight">
            Proposal Dashboard
          </h1>
          <p className="text-[15px] text-gray-500 mt-1.5">
            Track RFPs through the pipeline
          </p>
        </div>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg bg-black text-white text-sm font-semibold no-underline hover:bg-neutral-800 transition-all"
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
          { label: "Total RFPs", value: stats.total, color: "text-black" },
          { label: "In Pipeline", value: stats.active, color: "text-neutral-600" },
          { label: "Ready for Review", value: stats.ready, color: "text-black" },
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

      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search proposals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
          />
        </div>

        {/* Industry filter */}
        <select
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all appearance-none cursor-pointer pr-8 ${
            industryFilter !== "All"
              ? "bg-black text-white border-black"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${industryFilter !== "All" ? "white" : "%23999"}' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
        >
          <option value="All">All Industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>

        {/* Service Line filter */}
        <select
          value={serviceLineFilter}
          onChange={(e) => setServiceLineFilter(e.target.value)}
          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all appearance-none cursor-pointer pr-8 ${
            serviceLineFilter !== "All"
              ? "bg-black text-white border-black"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${serviceLineFilter !== "All" ? "white" : "%23999"}' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
        >
          <option value="All">All Service Lines</option>
          {serviceLines.map((sl) => (
            <option key={sl} value={sl}>{sl}</option>
          ))}
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setIndustryFilter("All");
              setServiceLineFilter("All");
              setSearchQuery("");
            }}
            className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-black hover:bg-gray-100 transition-all"
          >
            Clear
          </button>
        )}
      </div>

      {/* Status Filters */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all
              ${statusFilter === s
                ? "bg-black text-white border-none"
                : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_0.8fr_36px] px-5 py-3 bg-gray-50 border-b border-gray-200">
          {["RFP", "Industry", "Service Line", "Status", "Deadline", ""].map((h) => (
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
              ? hasActiveFilters || statusFilter !== "All"
                ? "No proposals match your filters."
                : <>No proposals found. <Link href="/" className="text-black font-medium underline">Upload your first RFP</Link></>
              : "Connect Airtable to see proposals here."}
          </div>
        )}

        {filtered.map((p, i) => {
          const clickable = p.status === "Ready for Review" || p.status === "Finalized";
          return (
            <div
              key={p.id}
              onClick={() => { if (clickable) router.push(`/proposals/${p.id}`); }}
              className={`grid grid-cols-[2fr_1fr_1fr_1fr_0.8fr_36px] px-5 py-4 items-center hover:bg-gray-50 transition-colors
                ${i < filtered.length - 1 ? "border-b border-gray-100" : ""}
                ${clickable ? "cursor-pointer" : ""}`}
            >
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-0.5">{p.rfpName}</div>
                <div className="text-xs text-gray-400">
                  {p.uploadedAt && new Date(p.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
              <div className="text-[13px] text-gray-600">
                {p.industry || <span className="text-gray-300">—</span>}
              </div>
              <div>{p.serviceLine ? <ServiceBadge line={p.serviceLine} /> : <span className="text-gray-300 text-[13px]">—</span>}</div>
              <div><StatusBadge status={p.status} /></div>
              <div className="text-[13px] text-gray-600 font-medium">
                {p.deadline && new Date(p.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
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

      {/* Results count */}
      {!loading && (hasActiveFilters || statusFilter !== "All") && (
        <div className="mt-3 text-xs text-gray-400 text-right">
          Showing {filtered.length} of {proposals.length} proposals
        </div>
      )}
    </div>
  );
}
