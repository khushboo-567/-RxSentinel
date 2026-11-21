import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import {
    HeartPulse,
    Pill,
    PlusCircle,
    ShieldAlert,
    History,
    AlertTriangle,
    CheckCircle2,
    ArrowRight,
    Upload,
    Calendar,
    ChevronRight,
    Loader2,
    AlertOctagon,
    Info,
    RefreshCw
} from "lucide-react";

export default function DashboardPage({ onNavigate, onOpenUploadModal }) {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [existingMeds, setExistingMeds] = useState([]);
    const [newMeds, setNewMeds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState("");

    const loadDashboardData = async () => {
        setLoading(true);
        setError("");
        try {
            const [statsRes, existingRes, newRes] = await Promise.all([
                apiRequest("/analysis/stats"),
                apiRequest("/medications?section=existing"),
                apiRequest("/medications?section=new")
            ]);

            if (statsRes.success) setStats(statsRes.stats);
            if (existingRes.success) setExistingMeds(existingRes.medications || []);
            if (newRes.success) setNewMeds(newRes.medications || []);
        } catch (err) {
            setError(err.message || "Failed to load dashboard data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const handleQuickAnalyze = async () => {
        setAnalyzing(true);
        try {
            const res = await apiRequest("/analysis/run", {
                method: "POST",
                body: JSON.stringify({
                    title: `Medication Safety Check – ${new Date().toLocaleDateString()}`
                })
            });

            if (res.success && res.report) {
                onNavigate("report-view", { reportId: res.report.reportId, reportData: res.report });
            }
        } catch (err) {
            setError(err.message || "Failed to run safety analysis.");
        } finally {
            setAnalyzing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                <p className="text-sm font-medium text-slate-500">Loading your medication dashboard...</p>
            </div>
        );
    }

    const lastReport = stats?.lastReport;
    const hasMajorDanger = lastReport?.summary_status === "major_danger" || (lastReport?.major_count > 0);
    const hasModerateWarning = lastReport?.summary_status === "moderate_warning" || (lastReport?.moderate_count > 0);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Header Greeting */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                        Hello, {user?.name || "Patient"} 👋
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        RxSentinel Medication Safety Overview & Interaction Monitoring
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadDashboardData}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        title="Refresh Dashboard"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onNavigate("safety-check")}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md shadow-teal-600/20 transition-all hover:-translate-y-0.5"
                    >
                        <HeartPulse className="w-4 h-4" />
                        Run Safety Analysis
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Safety Alert Banner */}
            {lastReport && (
                <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                    hasMajorDanger
                        ? "bg-rose-50 border-rose-200 text-rose-900"
                        : hasModerateWarning
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}>
                    <div className="flex items-start gap-3.5">
                        <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${
                            hasMajorDanger
                                ? "bg-rose-200 text-rose-800"
                                : hasModerateWarning
                                    ? "bg-amber-200 text-amber-800"
                                    : "bg-emerald-200 text-emerald-800"
                        }`}>
                            {hasMajorDanger ? <AlertOctagon className="w-6 h-6" /> : hasModerateWarning ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold">
                                    {hasMajorDanger
                                        ? "Major Clinical Interactions Detected in Last Analysis"
                                        : hasModerateWarning
                                            ? "Moderate Safety Warnings Identified"
                                            : "No Documented Interactions Found in Last Report"}
                                </h3>
                                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/70">
                                    {new Date(lastReport.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-xs mt-1 opacity-90 leading-relaxed max-w-2xl">
                                {hasMajorDanger
                                    ? `Identified ${lastReport.major_count} major potential adverse interaction(s) requiring immediate medical review.`
                                    : hasModerateWarning
                                        ? `Identified ${lastReport.moderate_count} moderate interaction(s) or duplicate exposures to monitor.`
                                        : "Your current combinations did not trigger known documented warnings in the verified database. Always consult your doctor."}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => onNavigate("report-view", { reportId: lastReport.id })}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-white shadow-xs border border-slate-200/60 hover:bg-slate-50 transition-colors shrink-0 flex items-center gap-1.5"
                    >
                        View Full Report
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Metric Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Section A Card */}
                <div
                    onClick={() => onNavigate("existing-meds")}
                    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                            Section A
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <Pill className="w-5 h-5" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">{stats?.existingMedsCount || 0}</h3>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">Current/Existing Medicines</p>
                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                        Manage Section A <ChevronRight className="w-3.5 h-3.5 text-blue-600" />
                    </p>
                </div>

                {/* Section B Card */}
                <div
                    onClick={() => onNavigate("new-meds")}
                    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                            Section B
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <PlusCircle className="w-5 h-5" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">{stats?.newMedsCount || 0}</h3>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">Newly Prescribed Medicines</p>
                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                        Manage Section B <ChevronRight className="w-3.5 h-3.5 text-teal-600" />
                    </p>
                </div>

                {/* Allergies Card */}
                <div
                    onClick={() => onNavigate("allergies")}
                    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                            Allergies
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">{stats?.allergiesCount || 0}</h3>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">Known Drug Allergies</p>
                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                        Update Allergies <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
                    </p>
                </div>

                {/* Past Reports Card */}
                <div
                    onClick={() => onNavigate("reports")}
                    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-cyan-400 hover:shadow-md transition-all cursor-pointer group"
                >
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
                            Analyses
                        </span>
                        <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                            <History className="w-5 h-5" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">{stats?.reportsCount || 0}</h3>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">Saved Safety Reports</p>
                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                        View Report History <ChevronRight className="w-3.5 h-3.5 text-cyan-600" />
                    </p>
                </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Quick Actions</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                        onClick={() => onNavigate("safety-check")}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-teal-200 bg-teal-50/50 hover:bg-teal-100/60 text-teal-800 text-left transition-all"
                    >
                        <HeartPulse className="w-5 h-5 text-teal-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold">5-Step Safety Wizard</p>
                            <p className="text-[10px] text-teal-600">Guided verification flow</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onOpenUploadModal("existing")}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 text-blue-800 text-left transition-all"
                    >
                        <Upload className="w-5 h-5 text-blue-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold">Upload Current Rx (OCR)</p>
                            <p className="text-[10px] text-blue-600">Extract into Section A</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onOpenUploadModal("new")}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-teal-200 bg-teal-50/50 hover:bg-teal-100/60 text-teal-800 text-left transition-all"
                    >
                        <Upload className="w-5 h-5 text-teal-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold">Upload New Rx (OCR)</p>
                            <p className="text-[10px] text-teal-600">Extract into Section B</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onNavigate("allergies")}
                        className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 text-amber-800 text-left transition-all"
                    >
                        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                            <p className="text-xs font-bold">Manage Allergies</p>
                            <p className="text-[10px] text-amber-600">Add substances & severity</p>
                        </div>
                    </button>
                </div>
            </div>

            {/* Split Section Previews: Section A vs Section B */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Section A: Current Medications */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                                A
                            </span>
                            <h3 className="text-base font-bold text-slate-900">Current Medications</h3>
                        </div>
                        <button
                            onClick={() => onNavigate("existing-meds")}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                            Open Section A <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {existingMeds.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
                            <p>No existing medications registered yet.</p>
                            <button
                                onClick={() => onNavigate("existing-meds")}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs"
                            >
                                + Add Existing Medicine
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {existingMeds.map((med) => (
                                <div key={med.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="font-bold text-slate-900">{med.medicine_name}</p>
                                        <p className="text-[11px] text-slate-500">
                                            {med.strength || "Standard"} • {med.frequency || "Daily"}
                                        </p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                                        Section A
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section B: New Medications */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <span className="w-6 h-6 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
                                B
                            </span>
                            <h3 className="text-base font-bold text-slate-900">New Medications Intended</h3>
                        </div>
                        <button
                            onClick={() => onNavigate("new-meds")}
                            className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                        >
                            Open Section B <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {newMeds.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 space-y-2">
                            <p>No new medications pending analysis.</p>
                            <button
                                onClick={() => onNavigate("new-meds")}
                                className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-semibold text-xs"
                            >
                                + Add New Medicine
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {newMeds.map((med) => (
                                <div key={med.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="font-bold text-slate-900">{med.medicine_name}</p>
                                        <p className="text-[11px] text-slate-500">
                                            {med.strength || "Standard"} • {med.frequency || "Daily"}
                                        </p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800">
                                        Section B
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Safety Reports Table */}
            {stats?.recentReports && stats.recentReports.length > 0 && (
                <div className="p-6 rounded-2xl bg-white border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <History className="w-5 h-5 text-teal-600" />
                            Recent Safety Analyses
                        </h3>
                        <button
                            onClick={() => onNavigate("reports")}
                            className="text-xs font-bold text-teal-600 hover:text-teal-700"
                        >
                            View All Reports
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold text-[10px] border-b border-slate-200">
                                <tr>
                                    <th className="py-3 px-4">Report Title</th>
                                    <th className="py-3 px-4">Date Run</th>
                                    <th className="py-3 px-4">Safety Status</th>
                                    <th className="py-3 px-4">Risks Found</th>
                                    <th className="py-3 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {stats.recentReports.map((rep) => {
                                    const isMajor = rep.summary_status === "major_danger" || rep.major_count > 0;
                                    const isMod = rep.summary_status === "moderate_warning" || rep.moderate_count > 0;
                                    return (
                                        <tr key={rep.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3.5 px-4 font-bold text-slate-900">{rep.report_title}</td>
                                            <td className="py-3.5 px-4 text-slate-500">
                                                {new Date(rep.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                    isMajor
                                                        ? "bg-rose-100 text-rose-800"
                                                        : isMod
                                                            ? "bg-amber-100 text-amber-800"
                                                            : "bg-emerald-100 text-emerald-800"
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        isMajor ? "bg-rose-600" : isMod ? "bg-amber-600" : "bg-emerald-600"
                                                    }`} />
                                                    {isMajor ? "Major Risk" : isMod ? "Moderate Risk" : "No Documented Conflict"}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-slate-600">
                                                {rep.major_count > 0 && <span className="text-rose-600 font-semibold mr-2">{rep.major_count} Major</span>}
                                                {rep.moderate_count > 0 && <span className="text-amber-600 font-semibold">{rep.moderate_count} Moderate</span>}
                                                {rep.major_count === 0 && rep.moderate_count === 0 && <span className="text-slate-400">0 documented risks</span>}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <button
                                                    onClick={() => onNavigate("report-view", { reportId: rep.id })}
                                                    className="font-bold text-teal-600 hover:text-teal-700"
                                                >
                                                    View Details →
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
