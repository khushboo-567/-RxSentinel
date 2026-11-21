import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/apiClient";
import {
    History,
    Calendar,
    AlertOctagon,
    AlertTriangle,
    CheckCircle2,
    Trash2,
    ChevronRight,
    Loader2,
    FileText,
    ArrowRight
} from "lucide-react";

export default function PreviousReportsPage({ onNavigate }) {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadReports = async () => {
        setLoading(true);
        try {
            const res = await apiRequest("/analysis/reports");
            if (res.success) {
                setReports(res.reports || []);
            }
        } catch (err) {
            setError(err.message || "Failed to load reports archive.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReports();
    }, []);

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Are you sure you want to delete report '${title}'?`)) return;

        try {
            await apiRequest(`/analysis/reports/${id}`, { method: "DELETE" });
            loadReports();
        } catch (err) {
            setError(err.message || "Failed to delete report.");
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 text-white shadow-xl">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                        Previous Medication Safety Reports
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                        Historical archives of all drug interaction checks conducted on your profile. Snapshots are fully preserved even if you update your medication list.
                    </p>
                </div>
                <button
                    onClick={() => onNavigate("safety-check")}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-all self-start sm:self-auto cursor-pointer"
                >
                    + Run New Analysis
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
                    <Loader2 className="w-8 h-8 text-teal-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Loading analysis reports history...</p>
                </div>
            ) : reports.length === 0 ? (
                <div className="p-16 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-3">
                    <History className="w-10 h-10 text-slate-400 mx-auto" />
                    <h3 className="text-base font-bold text-slate-900">No Past Reports Generated</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Once you run a medication safety check, your detailed report and clinical findings will be archived here for easy future reference.
                    </p>
                    <button
                        onClick={() => onNavigate("safety-check")}
                        className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                    >
                        Start First Safety Check
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reports.map((rep) => {
                        const isMajor = rep.summary_status === "major_danger" || rep.major_count > 0;
                        const isMod = rep.summary_status === "moderate_warning" || rep.moderate_count > 0;

                        return (
                            <div
                                key={rep.id}
                                className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition-all flex flex-col justify-between gap-4"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="text-base font-bold text-slate-900">
                                            {rep.report_title}
                                        </h3>
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                                            isMajor
                                                ? "bg-rose-100 text-rose-800"
                                                : isMod
                                                    ? "bg-amber-100 text-amber-800"
                                                    : "bg-emerald-100 text-emerald-800"
                                        }`}>
                                            {isMajor ? "Major Risk" : isMod ? "Moderate" : "Informational"}
                                        </span>
                                    </div>

                                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {new Date(rep.created_at).toLocaleString()}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-medium">
                                            {rep.total_existing_meds || 0} Current Meds (A)
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-medium">
                                            {rep.total_new_meds || 0} New Meds (B)
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                                        {rep.major_count > 0 && (
                                            <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-sm">
                                                {rep.major_count} Major Interactions
                                            </span>
                                        )}
                                        {rep.moderate_count > 0 && (
                                            <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-sm">
                                                {rep.moderate_count} Moderate Warnings
                                            </span>
                                        )}
                                        {rep.duplicate_count > 0 && (
                                            <span className="text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-sm">
                                                {rep.duplicate_count} Duplicate Overdoses
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                                    <button
                                        onClick={() => handleDelete(rep.id, rep.report_title)}
                                        className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 p-1"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                    </button>

                                    <button
                                        onClick={() => onNavigate("report-view", { reportId: rep.id })}
                                        className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700 p-1"
                                    >
                                        View Full Report <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
