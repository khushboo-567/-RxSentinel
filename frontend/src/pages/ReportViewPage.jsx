import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/apiClient";
import {
    ShieldAlert,
    AlertOctagon,
    AlertTriangle,
    CheckCircle2,
    HelpCircle,
    Printer,
    ArrowLeft,
    Clock,
    FileText,
    Pill,
    Layers,
    UserCheck,
    ExternalLink,
    Info,
    Calendar,
    ChevronDown,
    ChevronUp
} from "lucide-react";

export default function ReportViewPage({ reportId, reportData, onNavigate }) {
    const [report, setReport] = useState(reportData || null);
    const [loading, setLoading] = useState(!reportData && Boolean(reportId));
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("all"); // 'all', 'interactions', 'allergies', 'duplicates', 'dosage'

    useEffect(() => {
        if (!report && reportId) {
            setLoading(true);
            apiRequest(`/analysis/reports/${reportId}`)
                .then(res => {
                    if (res.success && res.report) {
                        setReport(res.report);
                    }
                })
                .catch(err => {
                    setError(err.message || "Failed to load report.");
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [reportId, report]);

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium text-slate-500">Retrieving safety analysis report...</p>
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="max-w-3xl mx-auto py-16 px-4 text-center space-y-4">
                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
                <h2 className="text-xl font-bold text-slate-900">Unable to Display Report</h2>
                <p className="text-sm text-slate-500">{error || "Report not found."}</p>
                <button
                    onClick={() => onNavigate("dashboard")}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    // Extract findings & snapshot data
    const snapshot = report.snapshot || {};
    const findings = report.findings || snapshot.findings || [];
    const counts = report.counts || snapshot.counts || {
        majorCount: report.major_count || 0,
        moderateCount: report.moderate_count || 0,
        minorCount: report.minor_count || 0,
        unknownCount: report.unassessed_count || 0,
        duplicateCount: report.duplicate_count || 0,
        allergyConflictCount: report.allergy_conflict_count || 0,
        dosageWarningCount: report.dosage_warning_count || 0
    };

    const existingMeds = report.existingMedications || snapshot.existingMedications || [];
    const newMeds = report.newMedications || snapshot.newMedications || [];
    const unassessedPairs = report.unassessedPairs || snapshot.unassessedPairs || [];
    const unrecognizedMeds = report.unrecognizedMedicines || snapshot.unrecognizedMedicines || [];

    const isMajor = counts.majorCount > 0;
    const isModerate = !isMajor && (counts.moderateCount > 0 || counts.duplicateCount > 0);
    const isUnassessed = !isMajor && !isModerate && (counts.unknownCount > 0 || unrecognizedMeds.length > 0);
    const isNoDocumented = !isMajor && !isModerate && !isUnassessed;

    const handlePrint = () => {
        window.print();
    };

    // Filter findings
    const filteredFindings = findings.filter(f => {
        if (activeTab === "all") return true;
        if (activeTab === "interactions") return f.finding_type === "drug_interaction";
        if (activeTab === "allergies") return f.finding_type === "allergy_conflict";
        if (activeTab === "duplicates") return f.finding_type === "duplicate_ingredient";
        if (activeTab === "dosage") return f.finding_type === "dosage_warning";
        return true;
    });

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:py-2 print:px-0">
            {/* Top Bar with Back and Print */}
            <div className="flex items-center justify-between print:hidden">
                <button
                    onClick={() => onNavigate("dashboard")}
                    className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Dashboard
                </button>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-xs"
                    >
                        <Printer className="w-4 h-4 text-slate-500" />
                        Print / Save as PDF
                    </button>
                    <button
                        onClick={() => onNavigate("safety-check")}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
                    >
                        New Safety Check
                    </button>
                </div>
            </div>

            {/* Executive Status Banner */}
            <div className={`p-6 sm:p-8 rounded-3xl border shadow-md transition-all ${
                isMajor
                    ? "bg-rose-50 border-rose-200 text-rose-950"
                    : isModerate
                        ? "bg-amber-50 border-amber-200 text-amber-950"
                        : isUnassessed
                            ? "bg-slate-100 border-slate-300 text-slate-900"
                            : "bg-emerald-50 border-emerald-200 text-emerald-950"
            }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                            isMajor
                                ? "bg-rose-600 text-white"
                                : isModerate
                                    ? "bg-amber-500 text-white"
                                    : isUnassessed
                                        ? "bg-slate-500 text-white"
                                        : "bg-emerald-600 text-white"
                        }`}>
                            {isMajor ? (
                                <AlertOctagon className="w-8 h-8" />
                            ) : isModerate ? (
                                <AlertTriangle className="w-8 h-8" />
                            ) : isUnassessed ? (
                                <HelpCircle className="w-8 h-8" />
                            ) : (
                                <CheckCircle2 className="w-8 h-8" />
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                                    isMajor
                                        ? "bg-rose-200 text-rose-900"
                                        : isModerate
                                            ? "bg-amber-200 text-amber-900"
                                            : isUnassessed
                                                ? "bg-slate-200 text-slate-800"
                                                : "bg-emerald-200 text-emerald-900"
                                }`}>
                                    {isMajor ? "Red: Major Risk" : isModerate ? "Orange: Moderate Risk" : isUnassessed ? "Grey: Information Unassessed" : "Green: Informational"}
                                </span>
                                <span className="text-xs text-slate-500 font-medium">
                                    Generated: {new Date(report.created_at || Date.now()).toLocaleString()}
                                </span>
                            </div>

                            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                                {isMajor
                                    ? "Major Potential Drug Safety Risks Identified"
                                    : isModerate
                                        ? "Moderate Interactions or Duplicate Exposures Detected"
                                        : isUnassessed
                                            ? "Information Could Not Be Fully Assessed"
                                            : "No Documented Interactions Found in Database"}
                            </h1>

                            <p className="text-xs sm:text-sm opacity-90 max-w-3xl leading-relaxed">
                                {isMajor
                                    ? "Critical interactions or severe allergy conflicts were detected between your existing and newly added medications. Immediate consultation with your prescribing doctor or clinical pharmacist is strongly advised."
                                    : isModerate
                                        ? "Identified moderate drug interactions, duplicate ingredient intake, or dosage parameters that warrant review by your healthcare provider."
                                        : isUnassessed
                                            ? "One or more medications could not be verified in the medical knowledge database or have incomplete dosage data. We cannot confirm their compatibility."
                                            : "No documented drug-drug interactions or allergy conflicts were found in the current medical interaction database for this specific set of confirmed medications."}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Prominent Mandatory Medical Disclaimer */}
                <div className="mt-6 pt-4 border-t border-black/10 flex items-start gap-2.5 text-xs">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="leading-relaxed opacity-95">
                        <strong className="font-bold">Clinical Disclaimer:</strong> A green indicator does NOT prove that a medicine combination is clinically safe. An interaction not found in the database cannot be assumed safe. Always verify all medication adjustments with your licensed physician or pharmacist.
                    </p>
                </div>
            </div>

            {/* Metric Counter Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <div className={`p-3.5 rounded-2xl border text-center transition-all ${
                    counts.majorCount > 0 ? "bg-rose-50 border-rose-200 text-rose-900" : "bg-white border-slate-200 text-slate-600"
                }`}>
                    <span className="block text-xl font-black">{counts.majorCount || 0}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Major Risks</span>
                </div>

                <div className={`p-3.5 rounded-2xl border text-center transition-all ${
                    counts.moderateCount > 0 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-white border-slate-200 text-slate-600"
                }`}>
                    <span className="block text-xl font-black">{counts.moderateCount || 0}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Moderate</span>
                </div>

                <div className="p-3.5 rounded-2xl border bg-white border-slate-200 text-slate-600 text-center">
                    <span className="block text-xl font-black">{counts.minorCount || 0}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Minor</span>
                </div>

                <div className={`p-3.5 rounded-2xl border text-center transition-all ${
                    counts.allergyConflictCount > 0 ? "bg-rose-50 border-rose-200 text-rose-900" : "bg-white border-slate-200 text-slate-600"
                }`}>
                    <span className="block text-xl font-black">{counts.allergyConflictCount || 0}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Allergies</span>
                </div>

                <div className={`p-3.5 rounded-2xl border text-center transition-all ${
                    counts.duplicateCount > 0 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-white border-slate-200 text-slate-600"
                }`}>
                    <span className="block text-xl font-black">{counts.duplicateCount || 0}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Duplicates</span>
                </div>

                <div className={`p-3.5 rounded-2xl border text-center transition-all ${
                    counts.dosageWarningCount > 0 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-white border-slate-200 text-slate-600"
                }`}>
                    <span className="block text-xl font-black">{counts.dosageWarningCount || 0}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Dosage Flags</span>
                </div>

                <div className="p-3.5 rounded-2xl border bg-white border-slate-200 text-slate-600 text-center col-span-2 sm:col-span-1">
                    <span className="block text-xl font-black">{counts.unknownCount || 0}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Unassessed</span>
                </div>
            </div>

            {/* Split Breakdown: Section A Existing vs Section B New */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Pill className="w-5 h-5 text-teal-600" />
                    Medications Evaluated in This Safety Analysis
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
                    {/* Section A */}
                    <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-blue-200">
                            <span className="font-bold text-xs text-blue-900 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">A</span>
                                Section A: Current / Existing Medications ({existingMeds.length})
                            </span>
                            <span className="text-[10px] text-blue-700 font-semibold uppercase">Baseline</span>
                        </div>
                        {existingMeds.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No existing medications registered</p>
                        ) : (
                            <div className="space-y-2">
                                {existingMeds.map((med, i) => (
                                    <div key={i} className="p-2.5 rounded-xl bg-white border border-blue-100 text-xs">
                                        <p className="font-bold text-slate-900">{med.medicine_name}</p>
                                        <p className="text-[11px] text-slate-500">
                                            {med.generic_name ? `Generic: ${med.generic_name} • ` : ""}{med.strength || "Standard"} • {med.frequency || "Daily"}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Section B */}
                    <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-teal-200">
                            <span className="font-bold text-xs text-teal-900 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">B</span>
                                Section B: Newly Added Medications ({newMeds.length})
                            </span>
                            <span className="text-[10px] text-teal-700 font-semibold uppercase">New Intakes</span>
                        </div>
                        {newMeds.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No new medications entered</p>
                        ) : (
                            <div className="space-y-2">
                                {newMeds.map((med, i) => (
                                    <div key={i} className="p-2.5 rounded-xl bg-white border border-teal-100 text-xs">
                                        <p className="font-bold text-slate-900">{med.medicine_name}</p>
                                        <p className="text-[11px] text-slate-500">
                                            {med.generic_name ? `Generic: ${med.generic_name} • ` : ""}{med.strength || "Standard"} • {med.frequency || "Daily"}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Categorized Findings Section */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-teal-600" />
                        Clinical Findings & Interaction Breakdown ({findings.length})
                    </h3>

                    {/* Filter tabs */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                        <button
                            onClick={() => setActiveTab("all")}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === "all" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
                        >
                            All ({findings.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("interactions")}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === "interactions" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
                        >
                            Drug-Drug
                        </button>
                        <button
                            onClick={() => setActiveTab("allergies")}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === "allergies" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
                        >
                            Allergies
                        </button>
                        <button
                            onClick={() => setActiveTab("duplicates")}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === "duplicates" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
                        >
                            Duplicates
                        </button>
                        <button
                            onClick={() => setActiveTab("dosage")}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === "dosage" ? "bg-white text-slate-900 shadow-xs" : "hover:text-slate-900"}`}
                        >
                            Dosage
                        </button>
                    </div>
                </div>

                {filteredFindings.length === 0 ? (
                    <div className="p-10 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 space-y-1">
                        <p className="font-bold text-slate-700">No findings in this category</p>
                        <p>Select another filter or review the full report tabs.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredFindings.map((finding, idx) => {
                            const isMajorSeverity = finding.severity === "major";
                            const isModSeverity = finding.severity === "moderate";
                            const isUnknownSeverity = finding.severity === "unknown";

                            return (
                                <div
                                    key={idx}
                                    className={`p-6 rounded-2xl border transition-all ${
                                        isMajorSeverity
                                            ? "bg-white border-rose-300 shadow-sm ring-1 ring-rose-500/10"
                                            : isModSeverity
                                                ? "bg-white border-amber-300 shadow-sm ring-1 ring-amber-500/10"
                                                : isUnknownSeverity
                                                    ? "bg-white border-slate-300 shadow-xs"
                                                    : "bg-white border-slate-200 shadow-xs"
                                    }`}
                                >
                                    <div className="space-y-3">
                                        {/* Finding Header */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                    isMajorSeverity
                                                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                                                        : isModSeverity
                                                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                            : isUnknownSeverity
                                                                ? "bg-slate-100 text-slate-700 border border-slate-200"
                                                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                }`}>
                                                    {finding.severity} Severity
                                                </span>

                                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                                    {finding.finding_type.replace(/_/g, " ")}
                                                </span>
                                            </div>

                                            {finding.pair_context && (
                                                <span className="text-[11px] font-medium text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                                                    {finding.pair_context}
                                                </span>
                                            )}
                                        </div>

                                        {/* Title */}
                                        <h4 className="text-base sm:text-lg font-bold text-slate-900">
                                            {finding.title}
                                        </h4>

                                        {/* Medicine & Ingredient Involved */}
                                        {(finding.medicine_1_name || finding.ingredient_1_name) && (
                                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                                <span className="font-semibold text-slate-700">Drugs Involved:</span>
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium">
                                                    {finding.medicine_1_name} {finding.ingredient_1_name ? `(${finding.ingredient_1_name})` : ""}
                                                </span>
                                                {finding.medicine_2_name && (
                                                    <>
                                                        <span className="text-slate-400">+</span>
                                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-medium">
                                                            {finding.medicine_2_name} {finding.ingredient_2_name ? `(${finding.ingredient_2_name})` : ""}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Description */}
                                        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                                            {finding.description}
                                        </p>

                                        {/* Clinical Implication / Effect */}
                                        {finding.clinical_implication && (
                                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-1">
                                                <span className="font-bold text-slate-900 block">Potential Clinical Risks & Effects:</span>
                                                <p className="text-slate-600 leading-relaxed">{finding.clinical_implication}</p>
                                            </div>
                                        )}

                                        {/* Biological Mechanism */}
                                        {finding.mechanism && (
                                            <p className="text-xs text-slate-500">
                                                <span className="font-semibold text-slate-700">Mechanism: </span>
                                                {finding.mechanism}
                                            </p>
                                        )}

                                        {/* Concrete Recommendation */}
                                        {finding.recommendation && (
                                            <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                                                isMajorSeverity
                                                    ? "bg-rose-50/60 border-rose-200 text-rose-950"
                                                    : "bg-teal-50/60 border-teal-200 text-teal-950"
                                            }`}>
                                                <span className="font-bold block">Physician & Patient Recommendation:</span>
                                                <p className="leading-relaxed">{finding.recommendation}</p>
                                            </div>
                                        )}

                                        {/* Evidence Source Citation */}
                                        {finding.evidence_source && (
                                            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
                                                <span>Source: {finding.evidence_source}</span>
                                                {finding.source_url && (
                                                    <a
                                                        href={finding.source_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-teal-600 hover:underline flex items-center gap-1"
                                                    >
                                                        Clinical Evidence Reference <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Unrecognized Medicines Section */}
            {unrecognizedMeds.length > 0 && (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-slate-500" />
                        Unrecognized Medicines – Could Not Be Assessed ({unrecognizedMeds.length})
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        The following items could not be confidently identified in the structured active ingredient database. Interaction checks could NOT be executed for these entries:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {unrecognizedMeds.map((u, i) => (
                            <div key={i} className="p-3 rounded-xl bg-white border border-slate-200 text-xs">
                                <p className="font-bold text-slate-900">{u.medicine_name}</p>
                                <p className="text-[11px] text-slate-500">Status: Unrecognized in database</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Doctor Consultation Checklist */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-teal-950 text-white space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-bold">
                        <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-base sm:text-lg font-bold">Doctor & Pharmacist Consultation Checklist</h4>
                        <p className="text-xs text-slate-300">Share this report during your next clinical appointment</p>
                    </div>
                </div>

                <ul className="text-xs text-slate-300 space-y-2 pl-4 list-disc">
                    <li>Show your doctor the exact active ingredients and interaction severity ratings flagged in this report.</li>
                    <li>Verify whether your new medication doses need titration or timing separation (e.g. separating antacids/chelation by 2-4 hours).</li>
                    <li>If duplicate ingredients were identified, ask the physician to verify whether you should discontinue the older formulation.</li>
                    <li>Notify your pharmacist of all non-prescription OTC drugs and herbal supplements you take concurrently.</li>
                </ul>
            </div>
        </div>
    );
}
