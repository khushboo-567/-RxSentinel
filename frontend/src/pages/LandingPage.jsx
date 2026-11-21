import React from "react";
import {
    ShieldCheck,
    Pill,
    Cpu,
    AlertOctagon,
    HeartPulse,
    ArrowRight,
    CheckCircle2,
    Sparkles,
    FileSearch,
    Users,
    Layers
} from "lucide-react";

export default function LandingPage({ onNavigate }) {
    const features = [
        {
            icon: HeartPulse,
            title: "Multi-Drug Interaction Analysis",
            description: "Deep pharmacological cross-checking between existing long-term prescriptions and newly prescribed medicines across verified FDA and BNF literature."
        },
        {
            icon: Cpu,
            title: "Dual AI OCR Pipeline",
            description: "Combines OpenCV image enhancement, Tesseract for printed prescriptions, and Microsoft TrOCR for handwritten doctor prescriptions."
        },
        {
            icon: ShieldCheck,
            title: "Allergy Cross-Reactivity",
            description: "Detects drug-class allergies (such as Penicillins, Sulfas, and NSAIDs) matching active ingredients to prevent hypersensitivity reactions."
        },
        {
            icon: Layers,
            title: "Duplicate Ingredient Detection",
            description: "Identifies different brand names sharing identical active ingredients (e.g. Paracetamol in Dolo and Combiflam) to prevent accidental overdose."
        },
        {
            icon: FileSearch,
            title: "Dosage Ceiling Validation",
            description: "Calculates cumulative daily doses against validated clinical maximums, flagging incomplete or excessive regimens."
        },
        {
            icon: Users,
            title: "Doctor & Pharmacist Reports",
            description: "Generates clear, structured medication safety reports with evidence citations ready for healthcare consultations."
        }
    ];

    const steps = [
        {
            num: "01",
            title: "Section A: Existing Medications",
            desc: "Add your current or long-term medicines manually or by uploading your existing prescription."
        },
        {
            num: "02",
            title: "Section B: New Medications",
            desc: "Input medicines you intend to take now or upload your newly received prescription."
        },
        {
            num: "03",
            title: "Allergy Information",
            desc: "Optionally specify known drug allergies or upload medical records for OCR extraction."
        },
        {
            num: "04",
            title: "Safety Analysis Report",
            desc: "Review categorized interactions (Major, Moderate, Minor), duplicate exposures, and clinical recommendations."
        }
    ];

    return (
        <div className="space-y-20 pb-16">
            {/* Hero Section */}
            <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-teal-50/70 via-white to-slate-50 -z-10" />
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-100/70 text-teal-800 text-xs font-semibold border border-teal-200 shadow-xs">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        Next-Generation Clinical Drug Interaction Intelligence
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-4xl mx-auto leading-[1.15]">
                        Safe Medications Through <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-600">
                            AI-Powered Interaction Intelligence
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                        RxSentinel shields patients by comparing current medications with newly prescribed medicines, extracting prescriptions with dual-mode OCR, and identifying harmful interactions, allergy conflicts, and duplicate doses.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                        <button
                            onClick={() => onNavigate("register")}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/25 transition-all text-base hover:-translate-y-0.5"
                        >
                            Start Safety Check Free
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => onNavigate("login")}
                            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition-all text-base"
                        >
                            Sign In to Account
                        </button>
                    </div>

                    {/* Trust Indicators */}
                    <div className="pt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-xs font-medium text-slate-500">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-teal-600" />
                            FDA Label & BNF Clinical Evidence
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-teal-600" />
                            Printed & Handwritten Prescription OCR
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-teal-600" />
                            Zero Fabricated Medical Data
                        </div>
                    </div>
                </div>
            </section>

            {/* Workflow Progression */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
                    <h2 className="text-xs font-bold text-teal-600 uppercase tracking-widest">Simple & Rigorous</h2>
                    <p className="text-3xl font-extrabold text-slate-900 tracking-tight">How RxSentinel Safeguards Your Health</p>
                    <p className="text-slate-600 text-sm">A seamless four-step clinical pathway ensuring no medication combination goes unexamined.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
                    {steps.map((st, i) => (
                        <div key={i} className="relative p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-teal-300 transition-all">
                            <span className="text-3xl font-black text-teal-100 font-mono block mb-2">{st.num}</span>
                            <h3 className="text-base font-bold text-slate-900 mb-2">{st.title}</h3>
                            <p className="text-xs text-slate-600 leading-relaxed">{st.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Grid */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
                    <h2 className="text-xs font-bold text-teal-600 uppercase tracking-widest">Comprehensive Protection</h2>
                    <p className="text-3xl font-extrabold text-slate-900 tracking-tight">Clinical-Grade Safety Checks</p>
                    <p className="text-slate-600 text-sm">Engineered according to international pharmacotherapy guidelines.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {features.map((feat, idx) => {
                        const Icon = feat.icon;
                        return (
                            <div key={idx} className="p-7 rounded-2xl bg-white border border-slate-200/80 hover:shadow-lg hover:border-teal-300 transition-all group">
                                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white flex items-center justify-center transition-colors mb-5 shadow-xs">
                                    <Icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2.5">{feat.title}</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">{feat.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Call To Action Banner */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white text-center space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="max-w-2xl mx-auto space-y-4">
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                            Protect Yourself and Your Loved Ones Today
                        </h2>
                        <p className="text-slate-300 text-sm leading-relaxed">
                            Create your free profile to organize your current medications, upload new prescriptions, and get comprehensive safety checks in seconds.
                        </p>
                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                                onClick={() => onNavigate("register")}
                                className="px-8 py-3.5 rounded-xl font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all text-sm shadow-lg shadow-teal-500/20"
                            >
                                Create Free Patient Account
                            </button>
                            <button
                                onClick={() => onNavigate("login")}
                                className="px-8 py-3.5 rounded-xl font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all text-sm"
                            >
                                Sign In
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
