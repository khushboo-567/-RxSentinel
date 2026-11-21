import React from "react";
import { useAuth } from "../context/AuthContext";
import {
    ShieldCheck,
    Pill,
    Cpu,
    HeartPulse,
    ArrowRight,
    CheckCircle2,
    Sparkles,
    FileSearch,
    Users,
    Layers,
    AlertTriangle,
    FileText,
    Activity,
    ShieldAlert,
    ChevronDown,
    Stethoscope,
    Lock,
    Zap,
    Check,
    Clock
} from "lucide-react";

export default function HomePage({ onNavigate }) {
    const { isAuthenticated, user } = useAuth();

    const handleStartSafetyCheck = () => {
        if (isAuthenticated) {
            onNavigate("safety-check");
        } else {
            onNavigate("register");
        }
    };

    const handleLearnMore = () => {
        const el = document.getElementById("how-it-works");
        if (el) {
            el.scrollIntoView({ behavior: "smooth" });
        }
    };

    const features = [
        {
            icon: Cpu,
            title: "AI Prescription OCR",
            badge: "Dual-Engine Pipeline",
            description:
                "Extracts printed prescriptions with Tesseract and handwritten doctor notes using TrOCR deep learning models after OpenCV contrast and perspective enhancement."
        },
        {
            icon: HeartPulse,
            title: "Drug Interaction Detection",
            badge: "Multi-Drug Analysis",
            description:
                "Cross-examines active pharmaceutical compounds simultaneously to uncover Major, Moderate, and Minor drug-drug interactions with scientific citations."
        },
        {
            icon: ShieldAlert,
            title: "Allergy Checking",
            badge: "Hypersensitivity Defense",
            description:
                "Compares resolved chemical ingredients against known drug allergies and pharmacologic classes (Penicillins, Sulfonamides, NSAIDs) to prevent allergic reactions."
        },
        {
            icon: Pill,
            title: "Active Ingredient Recognition",
            badge: "Smart Compound Mapping",
            description:
                "Resolves brand names to standardized active chemical substances and unbundles combination formulations (e.g. Paracetamol + Ibuprofen) automatically."
        },
        {
            icon: Layers,
            title: "Dosage & Duplicate Checking",
            badge: "Overdose Prevention",
            description:
                "Detects identical active ingredients across differently branded medicines and validates cumulative daily quantities against established clinical ceilings."
        },
        {
            icon: FileText,
            title: "Detailed Safety Reports",
            badge: "Clinical Documentation",
            description:
                "Generates clear, structured safety reports with severity flags, clinical rationale, and guidance tailored to assist conversations with doctors and pharmacists."
        }
    ];

    const howItWorksSteps = [
        {
            number: "01",
            title: "Add Existing & New Medications",
            subtitle: "Section A & Section B",
            desc: "Manually enter medicines or upload prescriptions. RxSentinel automatically extracts active ingredients with dual AI OCR and categorizes your current vs new regimen.",
            color: "from-blue-600 to-indigo-600",
            lightBg: "bg-blue-50/70 border-blue-200"
        },
        {
            number: "02",
            title: "Provide Allergy Information",
            subtitle: "Optional Cross-Check",
            desc: "Optionally add known drug allergies or upload medical allergy records. We cross-reference active substances to identify direct and class-wide sensitivity conflicts.",
            color: "from-teal-600 to-emerald-600",
            lightBg: "bg-teal-50/70 border-teal-200"
        },
        {
            number: "03",
            title: "Analyze & Understand",
            subtitle: "Comprehensive Clinical Report",
            desc: "Identify potential interactions, duplicate doses, and contraindications. Receive an interactive, color-coded safety report to share with your healthcare provider.",
            color: "from-cyan-600 to-blue-600",
            lightBg: "bg-cyan-50/70 border-cyan-200"
        }
    ];

    const problemPoints = [
        {
            icon: AlertTriangle,
            title: "Complex Multi-Drug Regimens",
            description:
                "Patients managing multiple acute or chronic conditions frequently receive prescriptions from different doctors who may not have visibility into their full medication history."
        },
        {
            icon: Layers,
            title: "Hidden Duplicate Ingredients",
            description:
                "Different commercial brand names often contain identical chemical compounds. Taking multiple combination products simultaneously can lead to accidental toxic overdoses."
        },
        {
            icon: ShieldAlert,
            title: "Allergy & Class Cross-Reactivity",
            description:
                "Allergies are not just brand-specific; active pharmaceutical classes like cephalosporins, beta-lactams, and sulfas carry dangerous cross-reactivity that easily goes unnoticed."
        },
        {
            icon: Activity,
            title: "Adverse Drug Interactions",
            description:
                "Drug pairs can alter absorption, metabolism, or organ excretion, nullifying therapeutic effects or dramatically elevating concentrations to dangerous levels."
        }
    ];

    return (
        <div className="space-y-24 pb-20 overflow-hidden bg-slate-50/50">
            {/* HERO SECTION */}
            <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-teal-50/60 via-white to-slate-50 border-b border-slate-200/60">
                {/* Background Decorative Blobs */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-teal-200/30 via-cyan-100/40 to-blue-200/20 blur-3xl rounded-full -z-10 pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                        {/* Hero Text */}
                        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-100/80 text-teal-800 text-xs font-bold border border-teal-200/80 shadow-xs">
                                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                                <span>Intelligent Clinical Medication Safety</span>
                            </div>

                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                                RxSentinel – Your Intelligent{" "}
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-700">
                                    Medication Safety
                                </span>{" "}
                                Companion
                            </h1>

                            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                                Taking multiple medications? Understand their potential interactions before combining them. RxSentinel helps identify drug interactions, allergy conflicts, and medication-related risks.
                            </p>

                            {/* CTA Action Buttons */}
                            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                                <button
                                    onClick={handleStartSafetyCheck}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 shadow-lg shadow-teal-600/25 transition-all text-base hover:-translate-y-0.5 cursor-pointer"
                                >
                                    <span>Check Medication Safety</span>
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleLearnMore}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition-all text-base cursor-pointer"
                                >
                                    <span>Learn How It Works</span>
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                </button>
                                {isAuthenticated && (
                                    <button
                                        onClick={() => onNavigate("dashboard")}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 shadow-xs transition-all text-base cursor-pointer"
                                    >
                                        <Activity className="w-4 h-4 text-teal-600" />
                                        <span>View Dashboard</span>
                                    </button>
                                )}
                            </div>

                            {/* Trust badges */}
                            <div className="pt-6 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs font-semibold text-slate-500">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                    <span>Verified Pharmacological Database</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                    <span>Dual Tesseract & TrOCR OCR</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                    <span>Zero Fabricated Clinical Evidence</span>
                                </div>
                            </div>
                        </div>

                        {/* Hero Illustration / Health-tech Card Mockup */}
                        <div className="lg:col-span-5 relative flex items-center justify-center">
                            <div className="relative w-full max-w-lg p-6 bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200 shadow-2xl space-y-5">
                                {/* Header of mockup */}
                                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
                                            <ShieldCheck className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900">Safety Analysis Engine</h3>
                                            <p className="text-[11px] text-teal-600 font-semibold">Active Monitoring • Live Matrix</p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                                        Live Guard
                                    </span>
                                </div>

                                {/* Mockup Content: Section A vs Section B */}
                                <div className="space-y-3">
                                    {/* Section A Card */}
                                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                                                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">A</span>
                                                Current Prescription
                                            </span>
                                            <span className="text-[10px] text-blue-700 font-mono">Warfarin 5mg</span>
                                        </div>
                                        <p className="text-[11px] text-slate-600">Active Ingredient: Warfarin Sodium (Anticoagulant)</p>
                                    </div>

                                    {/* Connector with Alert */}
                                    <div className="flex items-center justify-center gap-2 py-0.5">
                                        <div className="h-px bg-slate-200 flex-1" />
                                        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold shadow-xs">
                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                                            <span>Major Interaction Detected</span>
                                        </div>
                                        <div className="h-px bg-slate-200 flex-1" />
                                    </div>

                                    {/* Section B Card */}
                                    <div className="p-3.5 rounded-xl bg-teal-50/70 border border-teal-200 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-teal-900 flex items-center gap-1.5">
                                                <span className="w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px]">B</span>
                                                Newly Prescribed Medicine
                                            </span>
                                            <span className="text-[10px] text-teal-700 font-mono">Aspirin 81mg</span>
                                        </div>
                                        <p className="text-[11px] text-slate-600">Active Ingredient: Acetylsalicylic acid (Antiplatelet)</p>
                                    </div>

                                    {/* Result Banner */}
                                    <div className="p-3 rounded-xl bg-slate-900 text-white flex items-start gap-2.5">
                                        <div className="p-1 rounded-md bg-rose-500/20 text-rose-400 mt-0.5">
                                            <HeartPulse className="w-4 h-4" />
                                        </div>
                                        <div className="text-[11px] space-y-0.5">
                                            <p className="font-bold text-rose-300">Severe Gastrointestinal & Bleeding Risk</p>
                                            <p className="text-slate-300 text-[10px] leading-relaxed">
                                                Concomitant use substantially elevates bleeding events. Immediate clinical review advised.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* THE PROBLEM SECTION */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
                        The Polypharmacy Challenge
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                        Why Combining Multiple Medications Can Be Dangerous
                    </h2>
                    <p className="text-base text-slate-600 leading-relaxed">
                        Modern healthcare often treats complex conditions individually. When multiple physicians prescribe treatments independently, patients face serious unmonitored hazards.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {problemPoints.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={idx}
                                className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-teal-300 hover:shadow-md transition-all space-y-3"
                            >
                                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                                    <Icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                                <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* HOW IT WORKS SECTION */}
            <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24">
                <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-b from-teal-900/5 via-slate-50 to-white border border-slate-200">
                    <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200">
                            Transparent & Rigorous
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                            How RxSentinel Works
                        </h2>
                        <p className="text-base text-slate-600">
                            A seamless three-step clinical pathway ensuring no medication combination goes unexamined.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                        {howItWorksSteps.map((step, idx) => (
                            <div
                                key={idx}
                                className={`relative p-8 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-lg hover:border-teal-300 transition-all flex flex-col justify-between space-y-6 group`}
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-4xl font-black font-mono text-teal-200 group-hover:text-teal-400 transition-colors">
                                            {step.number}
                                        </span>
                                        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                                            {step.subtitle}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 leading-snug">
                                        {step.title}
                                    </h3>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        {step.desc}
                                    </p>
                                </div>

                                <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-teal-700">
                                    <span>Step {idx + 1} of 3</span>
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* KEY FEATURES SECTION */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200">
                        Comprehensive Capabilities
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                        Built for Total Patient Safety
                    </h2>
                    <p className="text-base text-slate-600">
                        Engineered to meet rigorous clinical pharmacology standards with zero made-up data.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feat, idx) => {
                        const Icon = feat.icon;
                        return (
                            <div
                                key={idx}
                                className="p-7 rounded-2xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-xl transition-all group flex flex-col justify-between space-y-4"
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 group-hover:bg-teal-600 group-hover:text-white flex items-center justify-center transition-all shadow-xs">
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                            {feat.badge}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">{feat.title}</h3>
                                    <p className="text-xs text-slate-600 leading-relaxed">{feat.description}</p>
                                </div>

                                <div className="pt-2 flex items-center gap-1.5 text-[11px] font-semibold text-teal-700">
                                    <Check className="w-3.5 h-3.5 text-teal-600" />
                                    <span>Validated Pharmacological Rule</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* FINAL CALL TO ACTION */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="p-10 sm:p-16 rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white text-center space-y-6 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="max-w-2xl mx-auto space-y-4 relative z-10">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 text-xs font-bold border border-teal-400/30">
                            Immediate & Accurate Protection
                        </div>

                        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                            Make Informed Medication Decisions.
                        </h2>

                        <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                            Organize your current medications, scan your latest prescriptions, and verify critical interactions before taking a single pill.
                        </p>

                        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                                onClick={handleStartSafetyCheck}
                                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold bg-teal-500 hover:bg-teal-400 text-slate-950 transition-all text-sm shadow-xl shadow-teal-500/25 flex items-center justify-center gap-2 cursor-pointer hover:scale-105"
                            >
                                <span>Start Your Safety Check</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            {isAuthenticated ? (
                                <button
                                    onClick={() => onNavigate("dashboard")}
                                    className="w-full sm:w-auto px-7 py-4 rounded-xl font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all text-sm cursor-pointer"
                                >
                                    Go to Clinical Dashboard
                                </button>
                            ) : (
                                <button
                                    onClick={() => onNavigate("login")}
                                    className="w-full sm:w-auto px-7 py-4 rounded-xl font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all text-sm cursor-pointer"
                                >
                                    Sign In to Your Account
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}