import React, { useState, useRef, useEffect } from "react";
import { apiRequest } from "../api/apiClient";
import {
    Upload,
    FileText,
    CheckCircle2,
    AlertTriangle,
    X,
    Loader2,
    Pill,
    Cpu,
    ArrowRight,
    HelpCircle,
    Check,
    Edit3
} from "lucide-react";

export default function PrescriptionUploadModal({
    isOpen,
    onClose,
    defaultSection = "existing", // 'existing' or 'new'
    onSuccess
}) {
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    // Section is strictly locked to the originating section (Section A or B)
    const sectionType = defaultSection || "existing";
    const [prescriptionType, setPrescriptionType] = useState("printed"); // 'printed' or 'handwritten'
    const [isUploading, setIsUploading] = useState(false);
    const [ocrResult, setOcrResult] = useState(null);
    const [extractedMedicines, setExtractedMedicines] = useState([]);
    const [confirming, setConfirming] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setFile(null);
            setPreviewUrl(null);
            setOcrResult(null);
            setExtractedMedicines([]);
            setErrorMessage("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleFileSelect = (e) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        setFile(selected);
        setErrorMessage("");
        setOcrResult(null);
        setExtractedMedicines([]);

        if (selected.type.startsWith("image/")) {
            setPreviewUrl(URL.createObjectURL(selected));
        } else {
            setPreviewUrl(null);
        }
    };

    const handleUploadAndOCR = async () => {
        if (!file) {
            setErrorMessage("Please select a prescription file first (JPG, PNG, or PDF).");
            return;
        }

        setIsUploading(true);
        setErrorMessage("");

        try {
            const formData = new FormData();
            formData.append("prescription", file);
            formData.append("prescriptionType", prescriptionType);
            formData.append("sectionType", sectionType);

            const res = await apiRequest("/prescriptions/upload", {
                method: "POST",
                body: formData
            });

            if (res.success) {
                setOcrResult(res);
                // Map extracted medicines for user review with default selection
                const meds = (res.detectedMedicines || []).map((m, index) => ({
                    index,
                    selected: true,
                    id: m.id || null,
                    medicine_name: m.matched_name || m.originalOcrName || "Unrecognized Medicine",
                    generic_name: m.generic_name || "",
                    strength: m.dosage && m.dosage.includes("mg") ? m.dosage : (m.strength || ""),
                    dosage: m.dosage || "1 tablet",
                    frequency: m.frequency || "Once daily",
                    duration: m.duration || "7 days",
                    recognitionStatus: m.recognitionStatus || "needs_review",
                    matchConfidence: m.matchConfidence || res.ocrConfidence || 70,
                    candidates: m.medicineCandidates || [],
                    isEditing: false
                }));
                setExtractedMedicines(meds);
            } else {
                setErrorMessage(res.message || "Prescription OCR processing failed.");
            }
        } catch (err) {
            setErrorMessage(err.message || "Failed to process prescription image.");
        } finally {
            setIsUploading(false);
        }
    };

    const toggleSelect = (index) => {
        setExtractedMedicines(prev => prev.map((m, i) => i === index ? { ...m, selected: !m.selected } : m));
    };

    const updateMedField = (index, field, value) => {
        setExtractedMedicines(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
    };

    const selectCandidate = (index, candidate) => {
        setExtractedMedicines(prev => prev.map((m, i) => i === index ? {
            ...m,
            id: candidate.id,
            medicine_name: candidate.name,
            generic_name: candidate.generic_name || candidate.name,
            recognitionStatus: "recognized",
            matchConfidence: 95
        } : m));
    };

    const handleConfirmToSection = async () => {
        const toConfirm = extractedMedicines.filter(m => m.selected);
        if (toConfirm.length === 0) {
            setErrorMessage("Please select at least one medicine to confirm.");
            return;
        }

        setConfirming(true);
        setErrorMessage("");

        try {
            const res = await apiRequest("/medications/batch-confirm", {
                method: "POST",
                body: JSON.stringify({
                    section_type: sectionType,
                    prescription_id: ocrResult?.prescriptionId || null,
                    medications: toConfirm
                })
            });

            if (res.success) {
                if (onSuccess) onSuccess(sectionType, res);
                onClose();
            } else {
                setErrorMessage(res.message || "Failed to confirm medications.");
            }
        } catch (err) {
            setErrorMessage(err.message || "Failed to confirm medications.");
        } finally {
            setConfirming(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                            <Upload className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Upload Prescription for AI OCR</h3>
                            <p className="text-xs text-slate-500">
                                Preprocesses via OpenCV and extracts medicine entries using Tesseract or TrOCR
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {errorMessage && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-700 text-sm">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {!ocrResult ? (
                        <>
                            {/* Auto-Targeted Section Indicator (Locked to Originating Section) */}
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                        sectionType === "existing" ? "bg-blue-600 text-white" : "bg-teal-600 text-white"
                                    }`}>
                                        {sectionType === "existing" ? "A" : "B"}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Section (Auto-assigned)</p>
                                        <p className="text-sm font-bold text-slate-800">
                                            {sectionType === "existing" ? "Section A: Current / Existing Medications" : "Section B: New Medications"}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    sectionType === "existing" ? "bg-blue-100 text-blue-800" : "bg-teal-100 text-teal-800"
                                }`}>
                                    Locked to Section {sectionType === "existing" ? "A" : "B"}
                                </span>
                            </div>

                            {/* OCR Engine / Type Toggle */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                                    Prescription Format & OCR Engine
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setPrescriptionType("printed")}
                                        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                                            prescriptionType === "printed"
                                                ? "border-teal-600 bg-teal-50/40 font-semibold text-teal-900 ring-2 ring-teal-500/20"
                                                : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        <FileText className="w-5 h-5 text-teal-600" />
                                        <div className="text-left">
                                            <p className="text-sm">Printed / Digital Prescription</p>
                                            <p className="text-[11px] text-slate-500 font-normal">Tesseract OCR engine</p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setPrescriptionType("handwritten")}
                                        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                                            prescriptionType === "handwritten"
                                                ? "border-teal-600 bg-teal-50/40 font-semibold text-teal-900 ring-2 ring-teal-500/20"
                                                : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        <Cpu className="w-5 h-5 text-cyan-600" />
                                        <div className="text-left">
                                            <p className="text-sm">Doctor Handwritten Rx</p>
                                            <p className="text-[11px] text-slate-500 font-normal">TrOCR Deep Learning model</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Drag & Drop File Upload Area */}
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-300 hover:border-teal-500 hover:bg-teal-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all group"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/jpg,application/pdf"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                {file ? (
                                    <div className="flex flex-col items-center gap-3">
                                        {previewUrl ? (
                                            <img
                                                src={previewUrl}
                                                alt="Preview"
                                                className="max-h-48 rounded-lg shadow-sm border border-slate-200 object-contain"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                                                <FileText className="w-8 h-8" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm font-bold text-slate-900">{file.name}</p>
                                            <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB • Click to replace file</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 group-hover:bg-teal-100 group-hover:text-teal-600 flex items-center justify-center transition-colors">
                                            <Upload className="w-7 h-7" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-800">
                                            Click to browse or drag and drop prescription file
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Supports JPG, PNG, and PDF (Up to 15MB)
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Step 2: OCR Extracted Medicines Review & Verification */
                        <div className="space-y-5">
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div>
                                    <span className="font-semibold text-slate-700">OCR Engine: </span>
                                    <span className="font-mono text-teal-700 font-bold">{ocrResult.ocrEngine}</span>
                                    <span className="mx-2 text-slate-300">•</span>
                                    <span className="font-semibold text-slate-700">Overall Confidence: </span>
                                    <span className="font-semibold text-slate-900">{ocrResult.ocrConfidence ? `${Math.round(ocrResult.ocrConfidence)}%` : "N/A"}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium text-[11px]">
                                        {ocrResult.recognizedCount || 0} Confident
                                    </span>
                                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-medium text-[11px]">
                                        {ocrResult.needsReviewCount || 0} Needs Review
                                    </span>
                                    <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700 font-medium text-[11px]">
                                        {ocrResult.unrecognizedCount || 0} Unrecognized
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                        <Pill className="w-4 h-4 text-teal-600" />
                                        Verify Extracted Medicines Before Adding to {sectionType === "existing" ? "Section A (Current)" : "Section B (New)"}
                                    </h4>
                                    <span className="text-xs text-slate-500">
                                        {extractedMedicines.filter(m => m.selected).length} of {extractedMedicines.length} selected
                                    </span>
                                </div>

                                {extractedMedicines.length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-sm">
                                        No distinct medicine names could be confidently recognized from this prescription. You can add them manually on the dashboard.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {extractedMedicines.map((med, idx) => (
                                            <div
                                                key={idx}
                                                className={`p-4 rounded-xl border transition-all ${
                                                    med.selected
                                                        ? "border-teal-300 bg-white shadow-xs"
                                                        : "border-slate-200 bg-slate-50/60 opacity-60"
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={med.selected}
                                                        onChange={() => toggleSelect(idx)}
                                                        className="mt-1 h-4 w-4 rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                                                    />

                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={med.medicine_name}
                                                                    onChange={(e) => updateMedField(idx, "medicine_name", e.target.value)}
                                                                    className="font-bold text-slate-900 text-sm border-b border-transparent hover:border-slate-300 focus:border-teal-500 focus:outline-hidden px-1 py-0.5"
                                                                />
                                                                {med.generic_name && (
                                                                    <span className="text-xs text-slate-500 italic">
                                                                        ({med.generic_name})
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Confidence Pill */}
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                                                                    med.matchConfidence >= 80
                                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                        : med.matchConfidence >= 60
                                                                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                                            : "bg-rose-50 text-rose-700 border border-rose-200"
                                                                }`}>
                                                                    {med.matchConfidence >= 80 ? "High Match" : "Review Needed"} ({Math.round(med.matchConfidence)}%)
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Dosage, Strength, Frequency, Duration row */}
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                                                            <div>
                                                                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Strength</span>
                                                                <input
                                                                    type="text"
                                                                    value={med.strength}
                                                                    onChange={(e) => updateMedField(idx, "strength", e.target.value)}
                                                                    placeholder="e.g. 500 mg"
                                                                    className="w-full px-2 py-1 rounded-md border border-slate-200 text-slate-700 focus:ring-1 focus:ring-teal-500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Dosage</span>
                                                                <input
                                                                    type="text"
                                                                    value={med.dosage}
                                                                    onChange={(e) => updateMedField(idx, "dosage", e.target.value)}
                                                                    placeholder="e.g. 1 tab"
                                                                    className="w-full px-2 py-1 rounded-md border border-slate-200 text-slate-700 focus:ring-1 focus:ring-teal-500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Frequency</span>
                                                                <input
                                                                    type="text"
                                                                    value={med.frequency}
                                                                    onChange={(e) => updateMedField(idx, "frequency", e.target.value)}
                                                                    placeholder="e.g. Twice daily"
                                                                    className="w-full px-2 py-1 rounded-md border border-slate-200 text-slate-700 focus:ring-1 focus:ring-teal-500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Duration</span>
                                                                <input
                                                                    type="text"
                                                                    value={med.duration}
                                                                    onChange={(e) => updateMedField(idx, "duration", e.target.value)}
                                                                    placeholder="e.g. 5 days"
                                                                    className="w-full px-2 py-1 rounded-md border border-slate-200 text-slate-700 focus:ring-1 focus:ring-teal-500"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Alternative Database Candidates */}
                                                        {med.candidates && med.candidates.length > 0 && (
                                                            <div className="pt-2">
                                                                <span className="text-[11px] text-slate-500 mr-2">Suggested match:</span>
                                                                {med.candidates.slice(0, 3).map((cand, cIdx) => (
                                                                    <button
                                                                        key={cIdx}
                                                                        type="button"
                                                                        onClick={() => selectCandidate(idx, cand)}
                                                                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 mr-1.5 transition-colors"
                                                                    >
                                                                        <Check className="w-3 h-3 text-teal-600" />
                                                                        {cand.name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors"
                    >
                        Cancel
                    </button>

                    {!ocrResult ? (
                        <button
                            onClick={handleUploadAndOCR}
                            disabled={!file || isUploading}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Running {prescriptionType === "printed" ? "Tesseract" : "TrOCR"}...
                                </>
                            ) : (
                                <>
                                    <Cpu className="w-4 h-4" />
                                    Preprocess & Extract OCR
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setOcrResult(null)}
                                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200/50"
                            >
                                Back to File
                            </button>
                            <button
                                onClick={handleConfirmToSection}
                                disabled={confirming || extractedMedicines.filter(m => m.selected).length === 0}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 shadow-sm transition-all"
                            >
                                {confirming ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        Confirm to {sectionType === "existing" ? "Section A (Current)" : "Section B (New)"}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
