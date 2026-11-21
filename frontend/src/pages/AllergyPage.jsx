import React, { useState, useEffect, useRef } from "react";
import { apiRequest } from "../api/apiClient";
import {
    ShieldAlert,
    Plus,
    Trash2,
    Upload,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    FileText,
    HelpCircle,
    Info
} from "lucide-react";

export default function AllergyPage() {
    const fileInputRef = useRef(null);
    const [allergies, setAllergies] = useState([]);
    const [loading, setLoading] = useState(true);

    // Form fields
    const [allergenName, setAllergenName] = useState("");
    const [reaction, setReaction] = useState("");
    const [severity, setSeverity] = useState("severe");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // OCR Document Upload state
    const [ocrUploading, setOcrUploading] = useState(false);
    const [ocrExtractedAllergens, setOcrExtractedAllergens] = useState([]);
    const [showOcrReview, setShowOcrReview] = useState(false);

    const loadAllergies = async () => {
        setLoading(true);
        try {
            const res = await apiRequest("/allergies");
            if (res.success) {
                setAllergies(res.allergies || []);
            }
        } catch (err) {
            setErrorMessage(err.message || "Failed to load allergies.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllergies();
    }, []);

    const handleAddAllergy = async (e) => {
        e.preventDefault();
        if (!allergenName.trim()) {
            setErrorMessage("Please enter an allergen substance.");
            return;
        }

        setSaving(true);
        setErrorMessage("");
        setSuccessMessage("");

        try {
            const res = await apiRequest("/allergies", {
                method: "POST",
                body: JSON.stringify({
                    allergen_name: allergenName.trim(),
                    reaction: reaction.trim() || null,
                    severity,
                    notes: notes.trim() || null
                })
            });

            if (res.success) {
                setSuccessMessage(`Allergy to '${allergenName}' added successfully.`);
                setAllergenName("");
                setReaction("");
                setSeverity("severe");
                setNotes("");
                loadAllergies();
            }
        } catch (err) {
            setErrorMessage(err.message || "Failed to add allergy.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAllergy = async (id, name) => {
        if (!window.confirm(`Are you sure you want to remove allergy '${name}'?`)) return;

        try {
            await apiRequest(`/allergies/${id}`, { method: "DELETE" });
            loadAllergies();
        } catch (err) {
            setErrorMessage(err.message || "Failed to delete allergy.");
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setOcrUploading(true);
        setErrorMessage("");
        try {
            // Upload to OCR service
            const formData = new FormData();
            formData.append("prescription", file);
            formData.append("prescriptionType", "printed");
            formData.append("sectionType", "allergy_record");

            const res = await apiRequest("/prescriptions/upload", {
                method: "POST",
                body: formData
            });

            if (res.success) {
                const text = (res.extractedText || "").toLowerCase();
                // Common drug allergy keywords detector
                const commonAllergens = [
                    { name: "Penicillin", keywords: ["penicillin", "amoxicillin", "ampicillin"], reaction: "Rash / Anaphylaxis", severity: "severe" },
                    { name: "Sulfa / Sulfonamides", keywords: ["sulfa", "sulfamethoxazole", "bactrim", "septra"], reaction: "Skin rash / Stevens-Johnson risk", severity: "severe" },
                    { name: "Aspirin & NSAIDs", keywords: ["aspirin", "ibuprofen", "nsaid", "diclofenac"], reaction: "Bronchospasm / Angioedema", severity: "moderate" },
                    { name: "Codeine / Opioids", keywords: ["codeine", "morphine", "tramadol"], reaction: "Nausea / Pruritus / Urticaria", severity: "moderate" },
                    { name: "Ciprofloxacin / Fluoroquinolones", keywords: ["ciprofloxacin", "quinolone", "cipro"], reaction: "Urticaria / Photosensitivity", severity: "moderate" },
                    { name: "Cephalosporins", keywords: ["cephalosporin", "cefixime", "cephalexin"], reaction: "Cross-sensitivity rash", severity: "moderate" }
                ];

                const detected = [];
                for (const item of commonAllergens) {
                    if (item.keywords.some(k => text.includes(k))) {
                        detected.push(item);
                    }
                }

                if (detected.length > 0) {
                    setOcrExtractedAllergens(detected);
                    setShowOcrReview(true);
                } else {
                    setErrorMessage("OCR completed, but no common drug allergy keywords were detected. You can add your allergy manually.");
                }
            }
        } catch (err) {
            setErrorMessage(err.message || "Failed to parse allergy document.");
        } finally {
            setOcrUploading(false);
        }
    };

    const handleConfirmOcrAllergen = async (item) => {
        try {
            await apiRequest("/allergies", {
                method: "POST",
                body: JSON.stringify({
                    allergen_name: item.name,
                    reaction: item.reaction,
                    severity: item.severity,
                    source: "ocr"
                })
            });
            setOcrExtractedAllergens(prev => prev.filter(x => x.name !== item.name));
            loadAllergies();
        } catch (err) {
            setErrorMessage(err.message || "Failed to confirm allergy.");
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-amber-900 to-slate-900 text-white shadow-xl">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 text-xs font-bold border border-amber-400/30">
                        Optional Clinical Safety Section
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                        Drug Allergies & Hypersensitivity Profile
                    </h1>
                    <p className="text-xs sm:text-sm text-amber-200/80 max-w-xl">
                        Document known drug allergies. RxSentinel automatically compares newly added medications against these records to flag hypersensitivity and cross-reactivity conflicts.
                    </p>
                </div>

                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/jpg,application/pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={ocrUploading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
                    >
                        {ocrUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Scan Allergy Record (OCR)
                    </button>
                </div>
            </div>

            {errorMessage && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {successMessage && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* OCR Extracted Allergies Banner for Review */}
            {showOcrReview && ocrExtractedAllergens.length > 0 && (
                <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                    <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-700" />
                        Allergies Detected via OCR in Uploaded Document ({ocrExtractedAllergens.length})
                    </h3>
                    <p className="text-xs text-amber-800">
                        Review the detected allergic substances below and click confirm to save them to your profile:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {ocrExtractedAllergens.map((item, idx) => (
                            <div key={idx} className="p-3.5 rounded-xl bg-white border border-amber-200 flex items-center justify-between text-xs">
                                <div>
                                    <p className="font-bold text-slate-900">{item.name}</p>
                                    <p className="text-slate-500 text-[11px]">{item.reaction} • {item.severity}</p>
                                </div>
                                <button
                                    onClick={() => handleConfirmOcrAllergen(item)}
                                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                                >
                                    Confirm
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Manual Add Form */}
                <div className="lg:col-span-1 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                    <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-amber-600" />
                            Add Known Drug Allergy
                        </h3>
                        <p className="text-xs text-slate-500">
                            Specify substance, typical reaction, and severity
                        </p>
                    </div>

                    <form onSubmit={handleAddAllergy} className="space-y-3.5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Allergic Substance / Drug Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={allergenName}
                                onChange={(e) => setAllergenName(e.target.value)}
                                placeholder="e.g. Penicillin, Sulfa, Aspirin..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Reaction Experienced
                            </label>
                            <input
                                type="text"
                                value={reaction}
                                onChange={(e) => setReaction(e.target.value)}
                                placeholder="e.g. Hives, facial swelling, difficulty breathing..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Allergy Severity
                            </label>
                            <select
                                value={severity}
                                onChange={(e) => setSeverity(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                            >
                                <option value="severe">Severe / Anaphylactic</option>
                                <option value="moderate">Moderate (Hives, Angioedema)</option>
                                <option value="mild">Mild (Localized itching / rash)</option>
                                <option value="unknown">Unknown</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Additional Notes
                            </label>
                            <textarea
                                rows={2}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g. Diagnosed in 2021 by hospital allergist"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/20 disabled:opacity-60 transition-all flex items-center justify-center gap-1.5"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Save Allergy Record
                        </button>
                    </form>
                </div>

                {/* Allergies List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-amber-600" />
                            Registered Allergies ({allergies.length})
                        </h3>
                        <span className="text-xs text-slate-500">
                            Active in Clinical Safety Checker
                        </span>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                            <Loader2 className="w-6 h-6 text-amber-600 animate-spin mx-auto mb-2" />
                            <p className="text-xs text-slate-500">Loading allergy profile...</p>
                        </div>
                    ) : allergies.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">No Drug Allergies on File</h4>
                            <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                If you have known drug allergies (e.g., to Penicillin or Sulfa), add them above to ensure you are alerted if a newly prescribed drug conflicts with them.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {allergies.map((all) => {
                                const isSevere = all.severity === "severe";
                                const isMod = all.severity === "moderate";
                                return (
                                    <div
                                        key={all.id}
                                        className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-amber-300 transition-all flex items-start justify-between gap-4"
                                    >
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <h4 className="text-base font-bold text-slate-900">
                                                    {all.allergen_name}
                                                </h4>
                                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                                                    isSevere
                                                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                                                        : isMod
                                                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                            : "bg-slate-100 text-slate-700 border border-slate-200"
                                                }`}>
                                                    {all.severity}
                                                </span>
                                            </div>

                                            {all.reaction && (
                                                <p className="text-xs text-slate-600">
                                                    <span className="font-semibold text-slate-700">Reaction:</span> {all.reaction}
                                                </p>
                                            )}

                                            {all.notes && (
                                                <p className="text-[11px] text-slate-500 italic">
                                                    Note: {all.notes}
                                                </p>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleDeleteAllergy(all.id, all.allergen_name)}
                                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                            title="Delete Allergy"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
