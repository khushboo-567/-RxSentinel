import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/apiClient";
import {
    Pill,
    PlusCircle,
    ShieldAlert,
    CheckCircle2,
    HeartPulse,
    ArrowRight,
    ArrowLeft,
    Upload,
    AlertTriangle,
    Loader2,
    Clock,
    Plus,
    Trash2,
    Calendar,
    Layers,
    Info,
    Check
} from "lucide-react";

export default function SafetyCheckWizard({ onNavigate, onOpenUploadModal }) {
    const [step, setStep] = useState(1);
    const [existingMeds, setExistingMeds] = useState([]);
    const [newMeds, setNewMeds] = useState([]);
    const [allergies, setAllergies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState("");

    // Quick add state for Step 1 & Step 2
    const [quickName, setQuickName] = useState("");
    const [quickStrength, setQuickStrength] = useState("");
    const [quickFreq, setQuickFreq] = useState("Once daily");
    const [quickDosage, setQuickDosage] = useState("1 tablet");

    const loadWizardData = async () => {
        setLoading(true);
        setError("");
        try {
            const [exRes, newRes, allRes] = await Promise.all([
                apiRequest("/medications?section=existing"),
                apiRequest("/medications?section=new"),
                apiRequest("/allergies")
            ]);

            if (exRes.success) setExistingMeds(exRes.medications || []);
            if (newRes.success) setNewMeds(newRes.medications || []);
            if (allRes.success) setAllergies(allRes.allergies || []);
        } catch (err) {
            setError(err.message || "Failed to load medication records.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWizardData();
    }, []);

    const handleQuickAdd = async (sectionType) => {
        if (!quickName.trim()) return;

        try {
            await apiRequest("/medications", {
                method: "POST",
                body: JSON.stringify({
                    section_type: sectionType,
                    medicine_name: quickName.trim(),
                    strength: quickStrength.trim() || null,
                    dosage: quickDosage.trim() || null,
                    frequency: quickFreq.trim() || null
                })
            });

            setQuickName("");
            setQuickStrength("");
            setQuickDosage("1 tablet");
            loadWizardData();
        } catch (err) {
            setError(err.message || "Failed to add medication.");
        }
    };

    const handleDeleteMed = async (id) => {
        try {
            await apiRequest(`/medications/${id}`, { method: "DELETE" });
            loadWizardData();
        } catch (err) {
            setError(err.message || "Failed to remove medication.");
        }
    };

    const handleRunAnalysis = async () => {
        setAnalyzing(true);
        setError("");

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
            setError(err.message || "Failed to run analysis.");
            setAnalyzing(false);
        }
    };

    const steps = [
        { num: 1, label: "Current Medicines", desc: "Section A" },
        { num: 2, label: "New Medicines", desc: "Section B" },
        { num: 3, label: "Allergy Records", desc: "Hypersensitivity" },
        { num: 4, label: "Clinical Review", desc: "Verify Inputs" }
    ];

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                <p className="text-sm font-medium text-slate-500">Preparing Medication Safety Wizard...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Stepper Navigation */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {steps.map((st) => {
                        const isActive = step === st.num;
                        const isDone = step > st.num;
                        return (
                            <div
                                key={st.num}
                                onClick={() => st.num < step && setStep(st.num)}
                                className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${
                                    isActive
                                        ? "bg-teal-50 border border-teal-200"
                                        : isDone
                                            ? "bg-slate-50/80 cursor-pointer hover:bg-slate-100"
                                            : "opacity-60"
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center ${
                                    isActive
                                        ? "bg-teal-600 text-white shadow-sm"
                                        : isDone
                                            ? "bg-emerald-600 text-white"
                                            : "bg-slate-200 text-slate-600"
                                }`}>
                                    {isDone ? <Check className="w-4 h-4" /> : st.num}
                                </div>
                                <div className="text-left">
                                    <p className={`text-xs font-bold ${isActive ? "text-teal-900" : "text-slate-700"}`}>
                                        {st.label}
                                    </p>
                                    <p className="text-[10px] text-slate-400">{st.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* STEP 1: Current / Existing Medications */}
            {step === 1 && (
                <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">
                                Step 1 of 4 • Section A
                            </span>
                            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                                Confirm Your Current / Long-Term Medications
                            </h2>
                            <p className="text-xs text-slate-500">
                                Verify the medicines you take regularly. These act as the clinical baseline for interaction checks.
                            </p>
                        </div>
                        <button
                            onClick={() => onOpenUploadModal("existing")}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
                        >
                            <Upload className="w-4 h-4" />
                            Upload Existing Rx (OCR)
                        </button>
                    </div>

                    {/* Quick Add Form */}
                    <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-100 space-y-3">
                        <p className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                            <Plus className="w-4 h-4 text-blue-600" />
                            Quick Add Current Medicine
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                            <input
                                type="text"
                                placeholder="Medicine name (e.g. Coumadin, Metformin)"
                                value={quickName}
                                onChange={(e) => setQuickName(e.target.value)}
                                className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                            />
                            <input
                                type="text"
                                placeholder="Strength (e.g. 5 mg)"
                                value={quickStrength}
                                onChange={(e) => setQuickStrength(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                            />
                            <button
                                type="button"
                                onClick={() => handleQuickAdd("existing")}
                                className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                            >
                                + Add
                            </button>
                        </div>
                    </div>

                    {/* Existing Medicines List */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Current Registered Items ({existingMeds.length})
                        </h4>
                        {existingMeds.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                                No existing medications entered. You can add them above or proceed if you do not take any regular medicines.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                                {existingMeds.map((med) => (
                                    <div key={med.id} className="p-3.5 bg-white flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                                A
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{med.medicine_name}</p>
                                                <p className="text-[11px] text-slate-500">
                                                    {med.strength || "Standard"} • {med.frequency || "Daily"}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteMed(med.id)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Step 1 of 4</span>
                        <button
                            onClick={() => setStep(2)}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md"
                        >
                            Next: New Medications (Section B)
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 2: New Medications Intended */}
            {step === 2 && (
                <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 uppercase tracking-wider">
                                Step 2 of 4 • Section B
                            </span>
                            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                                Enter Newly Prescribed Medications
                            </h2>
                            <p className="text-xs text-slate-500">
                                Enter the medicines you intend to take now. We will check them against your existing prescriptions.
                            </p>
                        </div>
                        <button
                            onClick={() => onOpenUploadModal("new")}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
                        >
                            <Upload className="w-4 h-4" />
                            Upload New Rx (OCR)
                        </button>
                    </div>

                    {/* Quick Add Form */}
                    <div className="p-4 rounded-2xl bg-teal-50/40 border border-teal-100 space-y-3">
                        <p className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                            <Plus className="w-4 h-4 text-teal-600" />
                            Quick Add New Medicine
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                            <input
                                type="text"
                                placeholder="Medicine name (e.g. Disprin, Augmentin, Cipro)"
                                value={quickName}
                                onChange={(e) => setQuickName(e.target.value)}
                                className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                            />
                            <input
                                type="text"
                                placeholder="Strength (e.g. 350 mg)"
                                value={quickStrength}
                                onChange={(e) => setQuickStrength(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                            />
                            <button
                                type="button"
                                onClick={() => handleQuickAdd("new")}
                                className="py-2 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                            >
                                + Add
                            </button>
                        </div>
                    </div>

                    {/* New Medicines List */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            New Medications Pending Analysis ({newMeds.length})
                        </h4>
                        {newMeds.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500">
                                No new medicines added yet. Please add at least one new medicine to analyze safety.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                                {newMeds.map((med) => (
                                    <div key={med.id} className="p-3.5 bg-white flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                                                B
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{med.medicine_name}</p>
                                                <p className="text-[11px] text-slate-500">
                                                    {med.strength || "Standard"} • {med.frequency || "Daily"}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteMed(med.id)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <button
                            onClick={() => setStep(1)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Current Meds
                        </button>
                        <button
                            onClick={() => setStep(3)}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md"
                        >
                            Next: Allergy Records
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 3: Allergy Review */}
            {step === 3 && (
                <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
                    <div className="pb-4 border-b border-slate-100">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase tracking-wider">
                            Step 3 of 4 • Allergy Profile
                        </span>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                            Review Drug Allergies
                        </h2>
                        <p className="text-xs text-slate-500">
                            We cross-check all your active substances against these known allergies to alert you of potential hypersensitivity reactions.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {allergies.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                                <p className="text-xs text-slate-600 font-medium">No drug allergies logged on file.</p>
                                <button
                                    onClick={() => onNavigate("allergies")}
                                    className="text-xs font-bold text-amber-700 underline"
                                >
                                    Add Allergies in Allergy Manager →
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {allergies.map((all) => (
                                    <div key={all.id} className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 text-xs flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-slate-900">{all.allergen_name}</p>
                                            <p className="text-[11px] text-slate-500">{all.reaction || "Standard reaction"}</p>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                                            {all.severity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <button
                            onClick={() => setStep(2)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to New Meds
                        </button>
                        <button
                            onClick={() => setStep(4)}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md"
                        >
                            Next: Final Review
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 4: Clinical Review & Run Analysis */}
            {step === 4 && (
                <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
                    <div className="pb-4 border-b border-slate-100">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 uppercase tracking-wider">
                            Step 4 of 4 • Ready for Analysis
                        </span>
                        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1">
                            Review Medication Inputs Before Analysis
                        </h2>
                        <p className="text-xs text-slate-500">
                            Confirm your clinical data below. When you click Analyze, RxSentinel resolves active ingredients, expands combinations, checks drug interactions, verifies allergies, detects duplicates, and inspects dosage ceilings.
                        </p>
                    </div>

                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2 text-xs">
                            <span className="font-bold text-blue-900 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">A</span>
                                Section A: Current Medications ({existingMeds.length})
                            </span>
                            <ul className="space-y-1 text-slate-700 pl-6 list-disc">
                                {existingMeds.map(m => (
                                    <li key={m.id} className="font-semibold">{m.medicine_name} {m.strength ? `(${m.strength})` : ""}</li>
                                ))}
                                {existingMeds.length === 0 && <li className="text-slate-400 italic">No existing medicines</li>}
                            </ul>
                        </div>

                        <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-2 text-xs">
                            <span className="font-bold text-teal-900 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">B</span>
                                Section B: New Medications ({newMeds.length})
                            </span>
                            <ul className="space-y-1 text-slate-700 pl-6 list-disc">
                                {newMeds.map(m => (
                                    <li key={m.id} className="font-semibold">{m.medicine_name} {m.strength ? `(${m.strength})` : ""}</li>
                                ))}
                                {newMeds.length === 0 && <li className="text-slate-400 italic">No new medicines</li>}
                            </ul>
                        </div>
                    </div>

                    {/* Safety Guarantee / Evidence Notice */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                        <p className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-teal-600" />
                            Evidence-Based Clinical Engine Standards
                        </p>
                        <p className="text-[11px] leading-relaxed">
                            No medical facts are fabricated. An interaction not found in the database is never automatically classified as safe. You will receive a structured report detailing Major, Moderate, Minor, and Unassessed pairs.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <button
                            onClick={() => setStep(3)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Allergies
                        </button>

                        <button
                            onClick={handleRunAnalysis}
                            disabled={analyzing || (existingMeds.length === 0 && newMeds.length === 0)}
                            className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-lg shadow-teal-600/25 disabled:opacity-50 transition-all hover:-translate-y-0.5"
                        >
                            {analyzing ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Analyzing Pharmacology & Interactions...
                                </>
                            ) : (
                                <>
                                    <HeartPulse className="w-5 h-5" />
                                    Analyze Medication Safety
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
