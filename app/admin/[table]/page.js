"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

const SERVICE_LINE_OPTIONS = ["Design Only", "Design + Fabrication","Fabrication + Installation" ,"Fabrication Only"];
const TIER_OPTIONS = ["Corporate", "Government", "Non-Profit", "Mid-Market"];

const tableConfig = {
  "team-bios": {
    label: "Team Bios",
    fields: [
      { key: "Name", type: "text", required: true },
      { key: "Title", type: "text", required: true },
      { key: "Role", type: "select", options: ["Lead", "Design", "Fabrication", "Operations", "Production"] },
      { key: "Bio (Short)", type: "textarea" },
      { key: "Bio (Full)", type: "textarea" },
      { key: "Service Lines", type: "multiselect", options: SERVICE_LINE_OPTIONS },
      { key: "Certifications", type: "text" },
      { key: "Portfolio Projects", type: "text" },
    ],
    displayField: "Name",
    subtitleField: "Title",
    badgeField: "Role",
  },
  "client-references": {
    label: "Client References",
    fields: [
      { key: "Client Name", type: "text", required: true },
      { key: "Project Name", type: "text", required: true },
      { key: "Service Line", type: "select", options: SERVICE_LINE_OPTIONS },
      { key: "Project Description", type: "textarea" },
      { key: "Client Tier", type: "select", options: TIER_OPTIONS },
      { key: "Contact Name", type: "text" },
      { key: "Contact Email", type: "text" },
      { key: "Contact Phone", type: "text" },
      { key: "Year", type: "text" },
    ],
    displayField: "Client Name",
    subtitleField: "Project Name",
    badgeField: "Client Tier",
  },
  "portfolio": {
    label: "Portfolio",
    fields: [
      { key: "Project Name", type: "text", required: true },
      { key: "Client Name", type: "text" },
      { key: "Service Line", type: "select", options: SERVICE_LINE_OPTIONS },
      { key: "Client Tier", type: "select", options: TIER_OPTIONS },
      { key: "Summary", type: "textarea" },
      { key: "Completion Date", type: "text" },
      { key: "Portfolio URL", type: "text" },
      { key: "Project Type Tags", type: "text" },
      { key: "Images / Links", type: "text" },
    ],
    displayField: "Project Name",
    subtitleField: "Service Line",
    badgeField: "Client Tier",
  },
  "rate-schedules": {
    label: "Rate Schedules",
    fields: [
      { key: "Service Type", type: "select", options: SERVICE_LINE_OPTIONS },
      { key: "Role / Line Item", type: "text", required: true },
      { key: "Rate", type: "text", required: true },
      { key: "Notes", type: "textarea" },
    ],
    displayField: "Role / Line Item",
    subtitleField: "Rate",
    badgeField: "Service Type",
  },
  "boilerplate": {
    label: "Boilerplate Content",
    fields: [
      { key: "Section Name", type: "text", required: true },
      { key: "Content", type: "textarea", required: true },
      { key: "Service Lines", type: "multiselect", options: SERVICE_LINE_OPTIONS },
      { key: "Last Updated", type: "text" },
    ],
    displayField: "Section Name",
    subtitleField: "Service Lines",
  },
  "project-schedules": {
    label: "Project Schedules",
    fields: [
      { key: "Template Name", type: "text", required: true },
      { key: "Service Line", type: "select", options: SERVICE_LINE_OPTIONS, required: true },
      { key: "Phases", type: "textarea", required: true },
      { key: "Total Duration", type: "text" },
      { key: "Notes", type: "textarea" },
    ],
    displayField: "Template Name",
    subtitleField: "Service Line",
    badgeField: "Service Line",
  },
};

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const config = tableConfig[params.table];

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = list view, "new" = new record, record id = editing
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Auth check
  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("admin_auth") !== "true") {
      router.push("/admin");
    }
  }, [router]);

  // Fetch records
  useEffect(() => {
    fetchRecords();
  }, [params.table]);

  async function fetchRecords() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/${params.table}`, { cache: "no-store" });
      const data = await res.json();
      setRecords(data.records || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    const empty = {};
    config.fields.forEach((f) => {
      empty[f.key] = f.type === "multiselect" ? [] : "";
    });
    setForm(empty);
    setEditing("new");
  }

  function startEdit(record) {
    const formData = {};
    config.fields.forEach((f) => {
      formData[f.key] = record[f.key] || (f.type === "multiselect" ? [] : "");
    });
    setForm(formData);
    setEditing(record.id);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const cleanFields = {};
      for (const [key, value] of Object.entries(form)) {
        if (value !== "" && value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) {
          cleanFields[key] = value;
        }
      }

      // Convert Images / Links text to Airtable attachment format
      if (cleanFields["Images / Links"] && typeof cleanFields["Images / Links"] === "string") {
        cleanFields["Images / Links"] = cleanFields["Images / Links"]
          .split(",")
          .map(url => ({ url: url.trim() }))
          .filter(a => a.url);
      }

      if (editing === "new") {
        await fetch(`/api/admin/${params.table}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: cleanFields }),
        });
      } else {
        await fetch(`/api/admin/${params.table}/${editing}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: cleanFields }),
        });
      }
      setEditing(null);
      fetchRecords();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await fetch(`/api/admin/${params.table}/${id}`, { method: "DELETE" });
      fetchRecords();
    } catch (err) {
      console.error(err);
    }
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMultiselect(key, option) {
    setForm((prev) => {
      const current = Array.isArray(prev[key]) ? prev[key] : [];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [key]: updated };
    });
  }

  if (!config) {
    return <div className="max-w-3xl mx-auto px-6 py-12">Unknown table</div>;
  }

  // ── FORM VIEW ──
  if (editing) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button
          onClick={() => setEditing(null)}
          className="text-sm text-teal-600 font-medium mb-6 bg-transparent border-none cursor-pointer p-0 hover:opacity-80"
        >
          ← Back to {config.label}
        </button>
        <h1 className="text-xl font-bold text-gray-900 mb-6">
          {editing === "new" ? `New ${config.label.replace(/s$/, "")}` : `Edit ${config.label.replace(/s$/, "")}`}
        </h1>
        <div className="space-y-5">
          {config.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {f.key} {f.required && <span className="text-red-400">*</span>}
              </label>
              {f.type === "text" && (
                <input
                  type="text"
                  value={form[f.key] || ""}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-teal-500"
                />
              )}
              {f.type === "textarea" && (
                <textarea
                  value={form[f.key] || ""}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  rows={5}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-teal-500 resize-vertical"
                />
              )}
              {f.type === "select" && (
                <select
                  value={form[f.key] || ""}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-teal-500 bg-white"
                >
                  <option value="">Select...</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}
              {f.type === "multiselect" && (
                <div className="flex gap-2 flex-wrap">
                  {f.options.map((o) => {
                    const selected = Array.isArray(form[f.key]) && form[f.key].includes(o);
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => toggleMultiselect(f.key, o)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          selected
                            ? "bg-teal-50 border-teal-400 text-teal-700"
                            : "bg-white border-gray-300 text-gray-500 hover:border-gray-400"
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setEditing(null)}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <button
        onClick={() => router.push("/admin")}
        className="text-sm text-teal-600 font-medium mb-6 bg-transparent border-none cursor-pointer p-0 hover:opacity-80"
      >
        ← Back to Content Manager
      </button>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{config.label}</h1>
          <p className="text-sm text-gray-500 mt-1">{records.length} records</p>
        </div>
        <button
          onClick={startNew}
          className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:opacity-90"
        >
          + Add New
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : records.length === 0 ? (
        <p className="text-gray-400 text-sm">No records yet. Click "Add New" to create one.</p>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {r[config.displayField] || "Untitled"}
                  </span>
                  {config.badgeField && r[config.badgeField] && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-teal/10 text-brand-teal border border-brand-teal/20">
                      {r[config.badgeField]}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 truncate">
                  {Array.isArray(r[config.subtitleField])
                    ? r[config.subtitleField].join(", ")
                    : r[config.subtitleField] || ""}
                </div>
                {/* Service line tags */}
                {(r["Service Lines"] || r["Service Line"] || r["Service Type"]) && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {(Array.isArray(r["Service Lines"] || r["Service Line"] || r["Service Type"])
                      ? (r["Service Lines"] || r["Service Line"] || r["Service Type"])
                      : [(r["Service Lines"] || r["Service Line"] || r["Service Type"])]
                    ).filter(Boolean).map((sl) => (
                      <span
                        key={sl}
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          sl === "Design Only"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : sl === "Design + Fabrication"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {sl}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => startEdit(r)}
                  className="px-3 py-1.5 text-xs font-medium text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
