import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/apiClient";
import {
    Pill,
    Plus,
    Search,
    Upload,
    Trash2,
    Edit2,
    Check,
    AlertCircle,
    Loader2,
    Calendar,
    Clock,
    FileText,
    Activity,
    Layers,
    ChevronDown
} from "lucide-react";

export default function ExistingMedsPage({ onOpenUploadModal }) {
    const [medications, setMedications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showResultsDropdown, setShowResultsDropdown] = useState(false);

    // Form inputs
    const [name, setName] = useState("");
    const [genericName, setGenericName] = useState("");
    const [strength, setStrength] = useState("");
    const [dosage, setDosage] = useState("");
    const [frequency, setFrequency] = useState("Once daily");
    const [duration, setDuration] = useState("Ongoing");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Editing modal state
    const [editingMed, setEditingMed] = useState(null);

    const loadMedications = async () => {
        setLoading(true);
        try {
            const res = await apiRequest("/medications?section=existing");
            if (res.success) {
                setMedications(res.medications || []);
            }
        } catch (err) {
            setErrorMessage(err.message || "Failed to load existing medications.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMedications();
    }, []);

    // Autocomplete search
    useEffect(() => {
        if (!searchQuery || searchQuery.trim().length < 2) {
            setSearchResults([]);
            setShowResultsDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const res = await apiRequest(`/medications/search?q=${encodeURIComponent(searchQuery)}`);
                if (res.success) {
                    setSearchResults(res.results || []);
                    setShowResultsDropdown(true);
                }
            } catch (e) {
                console.error("Search error:", e);
            } finally {
                setSearchLoading(false);
            }
        }, 250);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectSearchResult = (result) => {
        setName(result.name);
        setGenericName(result.generic_name || "");
        if (result.standard_strength) setStrength(result.standard_strength);
        setShowResultsDropdown(false);
        setSearchQuery("");
    };

    const handleAddMedication = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            setErrorMessage("Please enter a medicine name.");
            return;
        }

        setSaving(true);
        setErrorMessage("");
        setSuccessMessage("");

        try {
            const res = await apiRequest("/medications", {
                method: "POST",
                body: JSON.stringify({
                    section_type: "existing",
                    medicine_name: name.trim(),
                    generic_name: genericName.trim() || null,
                    strength: strength.trim() || null,
                    dosage: dosage.trim() || null,
                    frequency: frequency.trim() || null,
                    duration: duration.trim() || null,
                    notes: notes.trim() || null
                })
            });

            if (res.success) {
                setSuccessMessage(`Added '${name}' to Previous/Current Medications.`);
                setName("");
                setGenericName("");
                setStrength("");
                setDosage("");
                setFrequency("Once daily");
                setDuration("Ongoing");
                setNotes("");
                loadMedications();
            }
        } catch (err) {
            setErrorMessage(err.message || "Failed to add medication.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, medName) => {
        if (!window.confirm(`Are you sure you want to remove '${medName}' from Section A?`)) return;

        try {
            await apiRequest(`/medications/${id}`, { method: "DELETE" });
            loadMedications();
        } catch (err) {
            setErrorMessage(err.message || "Failed to delete medication.");
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editingMed) return;

        try {
            await apiRequest(`/medications/${editingMed.id}`, {
                method: "PUT",
                body: JSON.stringify(editingMed)
            });
            setEditingMed(null);
            loadMedications();
        } catch (err) {
            setErrorMessage(err.message || "Failed to update medication.");
        }
    };

    const handleClearSection = async () => {
        if (!window.confirm("Are you sure you want to clear ALL medications in Section A?")) return;
        try {
            await apiRequest("/medications/clear/existing", { method: "DELETE" });
            loadMedications();
        } catch (err) {
            setErrorMessage(err.message || "Failed to clear Section A.");
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-900 to-slate-900 text-white shadow-xl">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-bold border border-blue-400/30">
                        Section A • Long-Term & Current Regimen
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                        Previous / Current Medications
                    </h1>
                    <p className="text-xs sm:text-sm text-blue-200/80 max-w-xl">
                        Register all medications you are currently taking on a regular or ongoing basis. These will be checked against any new medicines you intend to take.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onOpenUploadModal("existing")}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                    >
                        <Upload className="w-4 h-4" />
                        Upload Existing Rx (OCR)
                    </button>
                    {medications.length > 0 && (
                        <button
                            onClick={handleClearSection}
                            className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-rose-600/30 text-rose-200 text-xs font-semibold border border-rose-300/20 transition-colors"
                        >
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            {errorMessage && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {successMessage && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{successMessage}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Manual Entry & Live DB Search Form */}
                <div className="lg:col-span-1 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
                    <div>
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Plus className="w-4 h-4 text-blue-600" />
                            Add Current Medication
                        </h3>
                        <p className="text-xs text-slate-500">
                            Search from database or type custom details
                        </p>
                    </div>

                    {/* Live Database Search Bar */}
                    <div className="relative">
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Search Medicine Database
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Search className="w-4 h-4" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="e.g. Warfarin, Coumadin, Paracetamol..."
                                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                            />
                            {searchLoading && (
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                </div>
                            )}
                        </div>

                        {/* Search Dropdown Results */}
                        {showResultsDropdown && searchResults.length > 0 && (
                            <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl bg-white shadow-xl border border-slate-200 py-1 z-30 divide-y divide-slate-100">
                                {searchResults.map((res, i) => (
                                    <div
                                        key={i}
                                        onClick={() => handleSelectSearchResult(res)}
                                        className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs transition-colors"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-900">{res.name}</span>
                                            {res.dosage_form && (
                                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                                                    {res.dosage_form}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate">
                                            Generic: {res.generic_name} {res.standard_strength ? `• ${res.standard_strength}` : ""}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleAddMedication} className="space-y-3.5 pt-1">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Medicine Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Brand or generic name"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Generic Name / Active Ingredient
                            </label>
                            <input
                                type="text"
                                value={genericName}
                                onChange={(e) => setGenericName(e.target.value)}
                                placeholder="e.g. Warfarin Sodium"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Strength
                                </label>
                                <input
                                    type="text"
                                    value={strength}
                                    onChange={(e) => setStrength(e.target.value)}
                                    placeholder="e.g. 5 mg"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Dosage
                                </label>
                                <input
                                    type="text"
                                    value={dosage}
                                    onChange={(e) => setDosage(e.target.value)}
                                    placeholder="e.g. 1 tablet"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Frequency
                                </label>
                                <select
                                    value={frequency}
                                    onChange={(e) => setFrequency(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                                >
                                    <option value="Once daily">Once daily (OD)</option>
                                    <option value="Twice daily">Twice daily (BD/BID)</option>
                                    <option value="Three times daily">Three times daily (TID)</option>
                                    <option value="Four times daily">Four times daily (QID)</option>
                                    <option value="Every 8 hours">Every 8 hours</option>
                                    <option value="As needed (PRN)">As needed (PRN)</option>
                                    <option value="Once weekly">Once weekly</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">
                                    Duration
                                </label>
                                <input
                                    type="text"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    placeholder="e.g. Ongoing, 6 months"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 disabled:opacity-60 transition-all flex items-center justify-center gap-1.5"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Add to Section A
                        </button>
                    </form>
                </div>

                {/* Right Column: Confirmed Section A Medicines List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                                A
                            </span>
                            Registered Current Medications ({medications.length})
                        </h3>
                        <span className="text-xs text-slate-500">
                            Verified for Safety Interaction Checks
                        </span>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                            <p className="text-xs text-slate-500">Loading Section A medications...</p>
                        </div>
                    ) : medications.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                                <Pill className="w-6 h-6" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">No Current Medications Added</h4>
                            <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                Use the form on the left to add your existing medicines manually, or click "Upload Existing Rx" to scan your paper prescription with OCR.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {medications.map((med) => (
                                <div
                                    key={med.id}
                                    className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <h4 className="text-base font-bold text-slate-900">
                                                    {med.medicine_name}
                                                </h4>
                                                {med.generic_name && (
                                                    <span className="text-xs text-slate-500 italic">
                                                        ({med.generic_name})
                                                    </span>
                                                )}
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                                                    Section A
                                                </span>
                                                {med.source === "ocr" && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                                                        OCR Extracted
                                                    </span>
                                                )}
                                            </div>

                                            {/* Details Badges */}
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                                {med.strength && (
                                                    <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                                                        {med.strength}
                                                    </span>
                                                )}
                                                {med.dosage && (
                                                    <span>Dosage: {med.dosage}</span>
                                                )}
                                                {med.frequency && (
                                                    <span className="flex items-center gap-1 text-slate-500">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {med.frequency}
                                                    </span>
                                                )}
                                                {med.duration && (
                                                    <span className="flex items-center gap-1 text-slate-500">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        {med.duration}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Active Ingredients Resolution */}
                                            {med.active_ingredients && med.active_ingredients.length > 0 && (
                                                <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">
                                                        Active Substances:
                                                    </span>
                                                    {med.active_ingredients.map((ing, iIdx) => (
                                                        <span
                                                            key={iIdx}
                                                            className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium"
                                                        >
                                                            {ing.name} {ing.ingredient_strength ? `(${ing.ingredient_strength})` : ""}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={() => setEditingMed({ ...med })}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(med.id, med.medicine_name)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Medication Modal */}
            {editingMed && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
                        <h3 className="text-base font-bold text-slate-900">Edit Medication Details</h3>
                        <form onSubmit={handleUpdate} className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Medicine Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editingMed.medicine_name}
                                    onChange={(e) => setEditingMed({ ...editingMed, medicine_name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 mb-1">Generic Name</label>
                                <input
                                    type="text"
                                    value={editingMed.generic_name || ""}
                                    onChange={(e) => setEditingMed({ ...editingMed, generic_name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Strength</label>
                                    <input
                                        type="text"
                                        value={editingMed.strength || ""}
                                        onChange={(e) => setEditingMed({ ...editingMed, strength: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Dosage</label>
                                    <input
                                        type="text"
                                        value={editingMed.dosage || ""}
                                        onChange={(e) => setEditingMed({ ...editingMed, dosage: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency</label>
                                    <input
                                        type="text"
                                        value={editingMed.frequency || ""}
                                        onChange={(e) => setEditingMed({ ...editingMed, frequency: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 mb-1">Duration</label>
                                    <input
                                        type="text"
                                        value={editingMed.duration || ""}
                                        onChange={(e) => setEditingMed({ ...editingMed, duration: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingMed(null)}
                                    className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
