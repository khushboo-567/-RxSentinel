import React from "react";
import { ShieldCheck, AlertCircle, Heart } from "lucide-react";

export default function Footer() {
    return (
        <footer className="bg-slate-900 text-slate-400 text-sm border-t border-slate-800 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                    <div>
                        <div className="flex items-center gap-2 text-white font-bold text-lg mb-3">
                            <ShieldCheck className="w-5 h-5 text-teal-400" />
                            RxSentinel Safety Engine
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Clinical decision support powered by medical interaction pharmacology, dual-mode OCR (Tesseract + TrOCR), and allergy cross-reactivity checking.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Verified Medical Sources</h4>
                        <ul className="text-xs space-y-1.5 text-slate-400">
                            <li>• FDA Structured Product Labeling & Black Box Warnings</li>
                            <li>• British National Formulary (BNF) Interaction Guides</li>
                            <li>• National List of Essential Medicines (NLEM)</li>
                            <li>• ACC / AHA Clinical Pharmacotherapy Guidelines</li>
                        </ul>
                    </div>

                    <div>
                        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs mb-1.5">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                Mandatory Medical Disclaimer
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                                RxSentinel is an informational safety screening tool. A green indicator denotes that no documented interaction was identified in the available database; it does NOT constitute proof that a medicine combination is clinically safe. Always consult a physician or pharmacist.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                    <p>© {new Date().getFullYear()} RxSentinel – AI-Powered Medication Safety Checker. All rights reserved.</p>
                    <p className="flex items-center gap-1 text-slate-500">
                        Engineered with <Heart className="w-3.5 h-3.5 text-rose-500" /> for patient safety.
                    </p>
                </div>
            </div>
        </footer>
    );
}
