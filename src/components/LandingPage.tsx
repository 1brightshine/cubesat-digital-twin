import React, { useState } from 'react';
import {
  Rocket,
  Satellite,
  Compass,
  Radio,
  ExternalLink,
  Mail,
  Github,
  Linkedin,
  Instagram,
  ShieldCheck,
  Globe2,
  Calendar,
  Award,
  ChevronRight,
  Terminal,
  Activity,
  Layers,
  Sparkles,
  Info,
  Clock,
  Zap,
  PlusCircle,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import { INITIAL_FLIGHT_CREW, CrewMember } from '../data/flightCrewData';

interface LandingPageProps {
  onLaunchSimulator: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchSimulator }) => {
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>(INITIAL_FLIGHT_CREW);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [isAddCrewModalOpen, setIsAddCrewModalOpen] = useState<boolean>(false);
  const [newCrew, setNewCrew] = useState<Partial<CrewMember>>({
    name: '',
    role: '',
    specialization: '',
    email: '',
    githubUrl: '',
    linkedinUrl: '',
    instagramUrl: '',
    instagramHandle: '',
    callsign: '',
    bio: '',
  });

  const handleCopyEmail = (email?: string, e?: React.MouseEvent) => {
    if (!email) return;
    e?.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrew.name) return;
    const member: CrewMember = {
      id: `crew-${Date.now()}`,
      name: newCrew.name || 'Aerospace Engineer',
      role: newCrew.role || 'Flight Systems Engineer',
      specialization: newCrew.specialization || 'CubeSat Systems & Dynamics',
      email: newCrew.email || undefined,
      githubUrl: newCrew.githubUrl || undefined,
      linkedinUrl: newCrew.linkedinUrl || undefined,
      instagramUrl: newCrew.instagramUrl || undefined,
      instagramHandle: newCrew.instagramHandle || undefined,
      callsign: newCrew.callsign || 'PILOT-X',
      bio: newCrew.bio || 'Internship researcher in the inaugural Aerospace Engineering cohort at SSGI.',
    };
    setCrewMembers([...crewMembers, member]);
    setIsAddCrewModalOpen(false);
    setNewCrew({
      name: '',
      role: '',
      specialization: '',
      email: '',
      githubUrl: '',
      linkedinUrl: '',
      instagramUrl: '',
      instagramHandle: '',
      callsign: '',
      bio: '',
    });
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-200 font-sans selection:bg-cyan-500/30 selection:text-cyan-200 flex flex-col relative overflow-x-hidden">
      {/* Background Architectural Grid & Subtle Nebula Accents */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a15_1px,transparent_1px),linear-gradient(to_bottom,#0f172a15_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-[800px] right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[150px] rounded-full pointer-events-none" />

      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#030712]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Mark */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-950/40">
              <Satellite className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm sm:text-base tracking-tight font-mono">
                  SSGI CUBESAT
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                  DIGITAL TWIN
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Space Science &amp; Geospatial Institute &bull; Ethiopia
              </p>
            </div>
          </div>

          {/* Quick Nav Anchors */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-mono text-slate-400">
            <a href="#hero" className="hover:text-cyan-300 transition-colors">
              MISSION BRIEF
            </a>
            <a href="#history" className="hover:text-cyan-300 transition-colors">
              SSGI HERITAGE
            </a>
            <a href="#crew" className="hover:text-cyan-300 transition-colors">
              FLIGHT CREW
            </a>
            <a href="#telemetry" className="hover:text-cyan-300 transition-colors">
              SYSTEM CAPABILITIES
            </a>
          </nav>

          {/* Primary CTA */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400">CONSOLE READY</span>
            </div>

            <button
              id="top-nav-launch-btn"
              onClick={onLaunchSimulator}
              className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-mono text-xs font-bold shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>Launch Console</span>
              <Rocket className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. HERO SECTION */}
      {/* ========================================================================= */}
      <section id="hero" className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* Top Mission Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/40 text-cyan-300 text-xs font-mono mb-8 shadow-xl shadow-cyan-950/30">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>ETHIOPIAN AEROSPACE CAPSTONE INTERNSHIP &bull; 2026</span>
            </div>

            {/* Bold Technical Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
              <span className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                SSGI CubeSat
              </span>{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
                Digital Twin
              </span>
            </h1>

            {/* Prominent Historic Subheadline */}
            <p className="text-base sm:text-xl text-slate-300 leading-relaxed font-normal mb-10 max-w-3xl">
              Engineered by Ethiopia&apos;s first Aerospace Engineering student cohort at Bahir Dar University
              during our milestone capstone internship at the{' '}
              <span className="text-cyan-300 font-semibold">
                Space Science and Geospatial Institute (SSGI)
              </span>
              .
            </p>

            {/* High-visibility Glowing Neon Call-To-Action Button */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto justify-center mb-14">
              <button
                id="hero-launch-console-btn"
                onClick={onLaunchSimulator}
                className="w-full sm:w-auto relative group overflow-hidden px-8 py-4 rounded-2xl bg-cyan-400 text-slate-950 font-mono font-extrabold text-base tracking-wide shadow-[0_0_35px_rgba(6,182,212,0.55)] hover:shadow-[0_0_55px_rgba(6,182,212,0.85)] hover:bg-cyan-300 active:scale-[0.98] transition-all flex items-center justify-center gap-3 border border-cyan-200"
              >
                <Rocket className="w-5 h-5 text-slate-950 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
                <span>Launch Mission Control Console 🚀</span>
              </button>

              <a
                href="#history"
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700/80 text-slate-300 hover:text-white font-mono text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                <span>Read Institutional History</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </a>
            </div>

            {/* Live Astrodynamics Telemetry HUD Ticker */}
            <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/80 border border-slate-800/90 rounded-2xl p-4 font-mono text-left shadow-2xl">
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span>PROPAGATOR</span>
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-sm font-bold text-white">SGP4 / J2 Secular</div>
                <div className="text-[10px] text-cyan-300/80 mt-0.5">Nodal Precession Active</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span>ORBIT REGIME</span>
                  <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-sm font-bold text-white">LEO (500 km SSO)</div>
                <div className="text-[10px] text-emerald-400/80 mt-0.5">Sun-Synchronous 97.4°</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span>POWER SYSTEM</span>
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-sm font-bold text-white">NASA AM0 Model</div>
                <div className="text-[10px] text-amber-300/80 mt-0.5">1361 W/m² Irradiance</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span>GROUND TRACK</span>
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="text-sm font-bold text-white">6 Ground Stations</div>
                <div className="text-[10px] text-cyan-300/80 mt-0.5">Real NASA GIBS Imagery</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. INSTITUTIONAL HISTORY SECTION (Two-column layout) */}
      {/* ========================================================================= */}
      <section id="history" className="relative py-20 sm:py-28 border-b border-slate-800/80 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs mb-3">
            <Compass className="w-4 h-4" />
            <span>ETHIOPIA AEROSPACE HERITAGE &amp; MILESTONES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-12">
            Institutional Legacy &amp; Space Missions
          </h2>

          <div className="relative mb-10 overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900 shadow-2xl shadow-cyan-950/20">
            <img
              src="/publicimagescampus-gate.jpg.jpg"
              alt="Bahir Dar University campus gate"
              className="h-48 w-full object-cover sm:h-64 lg:h-72"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/35 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex max-w-xl flex-col justify-center px-5 sm:px-8">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-300">
                BAHIR DAR UNIVERSITY
              </span>
              <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">
                A home for Ethiopia&apos;s aerospace future
              </h3>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-200 sm:text-sm">
                A leading hub for engineering, technology, and the pioneering Aerospace Engineering Bachelor&apos;s cohort.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {/* LEFT COLUMN: Two sleek, grayscale logo placeholder slots that glow on hover */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Logo Slot 1: Space Science and Geospatial Institute (SSGI) */}
              <div
                id="logo-slot-ssgi"
                className="group relative p-6 rounded-2xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-cyan-500/60 transition-all duration-300 shadow-xl overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 group-hover:bg-cyan-500/15 rounded-full blur-2xl transition-all" />
                <div className="flex items-start gap-4">
                  {/* Aerospace Insignia Placeholder Badge */}
                  <div className="w-16 h-16 rounded-xl bg-slate-800/80 group-hover:bg-cyan-950/60 border border-slate-700 group-hover:border-cyan-400/80 flex items-center justify-center shrink-0 overflow-hidden transition-all group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                    <img src="/ssgi-logo.png.jpg" alt="SSGI logo" className="h-full w-full object-contain p-2" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 group-hover:text-cyan-400">
                        NATIONAL SPACE AGENCY
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        ADDIS ABABA
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-200 transition-colors">
                      Space Science and Geospatial Institute (SSGI)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Lead government body directing space exploration, satellite infrastructure,
                      earth observation, and astronomical research in Ethiopia.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="text-cyan-400/90 font-medium">Headquarters: Entoto Observatory</span>
                  <span className="text-slate-500">Established 2022</span>
                </div>
              </div>

              {/* Logo Slot 2: University Partner */}
              <div
                id="logo-slot-university"
                className="group relative p-6 rounded-2xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 hover:border-emerald-500/60 transition-all duration-300 shadow-xl overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 group-hover:bg-emerald-500/15 rounded-full blur-2xl transition-all" />
                <div className="flex items-start gap-4">
                  {/* Aerospace Insignia Placeholder Badge */}
                  <div className="w-16 h-16 rounded-xl bg-slate-800/80 group-hover:bg-emerald-950/60 border border-slate-700 group-hover:border-emerald-400/80 flex items-center justify-center shrink-0 overflow-hidden transition-all group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                    <img src="/bahir-dar-logo.png.jpg" alt="Bahir Dar University logo" className="h-full w-full object-contain p-2" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 group-hover:text-emerald-400">
                        ACADEMIC PARTNER
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        1ST COHORT
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-emerald-200 transition-colors">
                      Bahir Dar University: Aerospace Engineering
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Bahir Dar University is a leading Ethiopian center for innovation and technology,
                      and the home of the country&apos;s pioneering Aerospace Engineering Bachelor&apos;s cohort.
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span className="text-emerald-400/90 font-medium">Bahir Dar University &bull; B.Sc. Aerospace Engineering</span>
                  <span className="text-slate-500">Capstone 2026</span>
                </div>
              </div>

              {/* Mission Badge Card */}
              <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800 text-xs font-mono text-slate-400 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
                <span>
                  Official capstone internship development project validated against NASA astrodynamic standards.
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: Historical summary & satellite launch legacy */}
            <div className="lg:col-span-7 flex flex-col justify-between">
              <div className="space-y-5 text-sm sm:text-base text-slate-300 leading-relaxed">
                <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800">
                  <h4 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    Formation Under Proclamation No. 1263/2021
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    The <span className="text-white font-semibold">Space Science and Geospatial Institute (SSGI)</span> was
                    officially established in <span className="text-cyan-300 font-mono font-bold">2022</span> through
                    national <span className="text-white font-semibold">Proclamation No. 1263/2021</span>. The decree united
                    two premier scientific organizations: the{' '}
                    <span className="text-cyan-300 font-medium">Ethiopian Space Science and Technology Institute (ESSTI, established in 2016)</span>{' '}
                    and the <span className="text-cyan-300 font-medium">Geospatial Information Institute (GII)</span>.
                  </p>
                </div>

                <p>
                  This strategic merger unified Ethiopia&apos;s satellite operations, aerospace engineering, astronomical research at Entoto
                  Observatory, and nationwide geospatial mapping under a single high-tech institutional command.
                </p>

                {/* Satellite Launch Legacy Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Satellite 1: ETRSS-1 */}
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                        ETRSS-1
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">Dec 20, 2019</span>
                    </div>
                    <div className="text-xs font-bold text-white mb-1">
                      Ethiopia&apos;s 1st Earth Observation Satellite
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Launched from Taiyuan Satellite Launch Center aboard a Long March 4B. 72 kg multispectral payload providing optical data for agriculture, water resources, and climate modeling.
                    </p>
                  </div>

                  {/* Satellite 2: ET-SMART-RSS */}
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        ET-SMART-RSS
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">Dec 22, 2020</span>
                    </div>
                    <div className="text-xs font-bold text-white mb-1">
                      High-Resolution Nanogrid Satellite
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Launched aboard a Long March 8 rocket from Wenchang. Enhanced resolution optical sensor dedicated to forestry conservation, disaster relief, and infrastructure mapping.
                    </p>
                  </div>
                </div>

                {/* Milestone Progress Bar */}
                <div className="mt-4 pt-4 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                    <span>AEROSPACE CHRONOLOGY</span>
                    <span className="text-cyan-400">2016 &rarr; 2026 COHORT</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <div className="text-slate-400">2016</div>
                      <div className="text-slate-200 font-bold">ESSTI Est.</div>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <div className="text-cyan-400">2019-20</div>
                      <div className="text-slate-200 font-bold">ETRSS-1 / 2</div>
                    </div>
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <div className="text-emerald-400">2022</div>
                      <div className="text-slate-200 font-bold">SSGI Decree</div>
                    </div>
                    <div className="p-2 rounded bg-cyan-950/60 border border-cyan-500/40">
                      <div className="text-cyan-300 font-bold">2026</div>
                      <div className="text-white font-bold">1st B.Sc. Cohort</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. THE FLIGHT CREW & CONTACTS SECTION */}
      {/* ========================================================================= */}
      <section id="crew" className="relative py-20 sm:py-28 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <div className="flex items-center gap-2 text-amber-400 font-mono text-xs mb-3">
                <Award className="w-4 h-4 text-amber-400" />
                <span>INVENTORS &amp; MISSION ENGINEERS</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                SYSTEM DEVELOPERS &amp; FLIGHT CREW
              </h2>
              <p className="text-sm text-slate-400 mt-2 max-w-2xl font-normal">
                Ethiopia&apos;s first Aerospace Engineering student cohort at Bahir Dar University, developing this digital twin during our capstone internship at SSGI Addis Ababa.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAddCrewModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 hover:text-cyan-200 flex items-center gap-2 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add / Edit Crew Member</span>
              </button>
            </div>
          </div>

          {/* Responsive Grid of Professional Profile Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {crewMembers.map((member) => (
              <div
                key={member.id}
                id={`crew-card-${member.id}`}
                className="group relative flex flex-col justify-between rounded-2xl bg-slate-900/50 hover:bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 transition-all duration-300 p-6 shadow-xl hover:shadow-cyan-950/40 overflow-hidden"
              >
                {/* Accent ambient glow */}
                <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/5 group-hover:bg-cyan-500/10 rounded-full blur-xl pointer-events-none transition-all" />

                <div>
                  {/* Top Row: Avatar & Golden "Pioneer Class" Badge */}
                  <div className="flex items-start justify-between gap-4 mb-4">
                    {/* Photo or Monogram avatar */}
                    <div className="relative">
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-2xl object-cover border border-cyan-500/50 group-hover:border-cyan-400 shadow-lg shadow-cyan-950/40"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                            const fallback = (e.target as HTMLElement).nextElementSibling;
                            if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 border border-slate-700 group-hover:border-cyan-400/80 flex items-center justify-center text-xl font-bold font-mono text-cyan-300 shadow-inner transition-all group-hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] ${
                          member.avatarUrl ? 'hidden' : ''
                        }`}
                      >
                        {member.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')}
                      </div>

                      {/* Callsign Tag */}
                      {member.callsign && (
                        <span className="absolute -bottom-2 -right-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-950 text-cyan-400 border border-cyan-500/30">
                          {member.callsign}
                        </span>
                      )}
                    </div>

                    {/* Small Circular Golden Badge: "Pioneer Class" */}
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/40 border border-amber-500/50 text-amber-300 text-[10px] font-mono font-bold shadow-[0_0_10px_rgba(245,158,11,0.2)] shrink-0"
                      title="Member of Ethiopia's Inaugural Aerospace Engineering B.Sc. Cohort"
                    >
                      <Award className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                      <span>Pioneer Class</span>
                    </div>
                  </div>

                  {/* Name, Role & Social handles */}
                  <div className="mb-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-200 transition-colors">
                      {member.name}
                    </h3>
                    <div className="text-xs font-mono font-semibold text-cyan-400 mt-0.5 leading-snug">
                      {member.role}
                    </div>

                    <div className="text-[11px] text-slate-400 mt-2 font-mono">
                      {member.specialization}
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {member.bio}
                  </p>
                </div>

                {/* Row of action links / buttons for professional contact information */}
                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* GitHub Link */}
                    {member.githubUrl && (
                      <a
                        href={member.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-slate-700"
                        title="GitHub Profile"
                      >
                        <Github className="w-4 h-4" />
                      </a>
                    )}

                    {/* LinkedIn Link */}
                    {member.linkedinUrl && (
                      <a
                        href={member.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-[#0077b5] text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-slate-700"
                        title="LinkedIn Profile"
                      >
                        <Linkedin className="w-4 h-4" />
                      </a>
                    )}

                    {/* Instagram Link */}
                    {member.instagramUrl && (
                      <a
                        href={member.instagramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-gradient-to-tr hover:from-amber-600 hover:via-rose-600 hover:to-purple-600 text-slate-300 hover:text-white flex items-center justify-center transition-all border border-slate-700"
                        title={`Instagram: ${member.instagramHandle || member.name}`}
                      >
                        <Instagram className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {/* Direct Contact Button */}
                  {member.email ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleCopyEmail(member.email, e)}
                        className="px-2 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-mono transition-colors flex items-center gap-1"
                        title="Copy Email Address"
                      >
                        {copiedEmail === member.email ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`mailto:${member.email}?subject=SSGI%20CubeSat%20Digital%20Twin%20Inquiry`}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-white text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        title={`Send email to ${member.email}`}
                      >
                        <Mail className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Email</span>
                      </a>
                    </div>
                  ) : member.linkedinUrl ? (
                    <a
                      href={member.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 hover:border-blue-400 text-blue-300 hover:text-white text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                      title="Connect on LinkedIn"
                    >
                      <Linkedin className="w-3.5 h-3.5 text-blue-400" />
                      <span>Connect</span>
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SYSTEM CAPABILITIES & LIVE ASTRODYNAMICS PREVIEW */}
      {/* ========================================================================= */}
      <section id="telemetry" className="relative py-20 border-b border-slate-800/80 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-cyan-500/30 text-cyan-300 text-xs font-mono mb-3">
              <Terminal className="w-3.5 h-3.5" />
              <span>DIGITAL TWIN ARCHITECTURE</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Aerospace Ground Station Capabilities
            </h2>
            <p className="text-sm text-slate-400">
              Built using authentic astrodynamics physics equations, NASA SPICE kernels, and CesiumJS geospatial 3D visualization.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4">
                <Globe2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">3D CesiumJS Earth Digital Twin</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                WGS-84 ellipsoidal globe with true atmospheric scattering, realistic day/night terminator lines, camera tracking modes, and sub-satellite nadir ground footprints.
              </p>
              <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Camera Lock &amp; Nadir Tracking</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">NASA GIBS 2D Ground Track</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Real NASA GIBS satellite imagery layers (Blue Marble, Black Marble night city lights, NextGen), multi-revolution ground tracks, and 6-station pass scheduling.
              </p>
              <div className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Next 3 Passes AOS/TCA/LOS Predictor</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">NASA AM0 EPS Power Budget</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Triple-junction solar cell conversion (30%), cosine sun incidence angles, orbital eclipse duration calculations, and battery depth-of-discharge health analysis.
              </p>
              <div className="text-[11px] font-mono text-amber-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>1361.0 W/m² Solar Irradiance Model</span>
              </div>
            </div>
          </div>

          {/* Bottom Banner to Launch */}
          <div className="mt-12 p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
            <div>
              <div className="text-xs font-mono text-cyan-400 font-bold mb-1">READY FOR MISSION TESTING</div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">Experience the Real-Time Mission Console</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Propagate live TLEs from CelesTrak and Space-Track, load NASA SPICE attitude kernels, and adjust orbital mechanics parameters on the fly.
              </p>
            </div>
            <button
              id="cta-banner-launch-btn"
              onClick={onLaunchSimulator}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-mono font-bold text-sm shadow-xl shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2 shrink-0"
            >
              <Rocket className="w-4 h-4 text-slate-950" />
              <span>Launch Console 🚀</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. COMPACT FOOTER */}
      {/* ========================================================================= */}
      <footer className="w-full bg-[#030712] border-t border-slate-800 text-slate-400 text-xs font-sans py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left: Branding & Copyright */}
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
              <span className="font-bold text-slate-200 font-mono">
                SSGI CubeSat Digital Twin
              </span>
              <span className="hidden sm:inline text-slate-600">&bull;</span>
              <span>&copy; {new Date().getFullYear()} Space Science and Geospatial Institute (SSGI), Ethiopia. All rights reserved.</span>
            </div>

            {/* Right: Technical Version & System Disclaimers */}
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                v1.0.0-Beta
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                Build 2026.09-ETHIOPIA-SSGI
              </span>
            </div>
          </div>

          {/* Technical Disclaimer Notice */}
          <div className="mt-4 pt-4 border-t border-slate-900 text-center sm:text-left text-[11px] text-slate-500 font-mono leading-relaxed">
            <span className="text-slate-400 font-semibold">Technical Disclaimer:</span> Orbital state propagation utilizes simplified perturbation models (SGP4/SDP4 and J2 zonal harmonics). Atmospheric lifetime calculations are derived from NRLMSISE-00 density models and space weather approximations. Engineered for academic research, flight dynamics analysis, and spacecraft mission demonstration.
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* ADD / EDIT CREW MEMBER MODAL */}
      {/* ========================================================================= */}
      {isAddCrewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden font-sans">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-white text-sm font-mono">Add Internship Crew Member</h3>
              </div>
              <button
                onClick={() => setIsAddCrewModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-mono mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newCrew.name || ''}
                  onChange={(e) => setNewCrew({ ...newCrew, name: e.target.value })}
                  placeholder="e.g. Kidanu Awoke"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Engineering Role *</label>
                  <input
                    type="text"
                    required
                    value={newCrew.role || ''}
                    onChange={(e) => setNewCrew({ ...newCrew, role: e.target.value })}
                    placeholder="e.g. 3D Graphics & Orbit Engine"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Callsign</label>
                  <input
                    type="text"
                    value={newCrew.callsign || ''}
                    onChange={(e) => setNewCrew({ ...newCrew, callsign: e.target.value })}
                    placeholder="e.g. ORBIT-1"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Specialization Focus</label>
                <input
                  type="text"
                  value={newCrew.specialization || ''}
                  onChange={(e) => setNewCrew({ ...newCrew, specialization: e.target.value })}
                  placeholder="e.g. Astrodynamics, CesiumJS, SGP4"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Email</label>
                  <input
                    type="email"
                    value={newCrew.email || ''}
                    onChange={(e) => setNewCrew({ ...newCrew, email: e.target.value })}
                    placeholder="engineer@example.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">LinkedIn Profile</label>
                  <input
                    type="url"
                    value={newCrew.linkedinUrl || ''}
                    onChange={(e) => setNewCrew({ ...newCrew, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Instagram Handle</label>
                  <input
                    type="text"
                    value={newCrew.instagramHandle || ''}
                    onChange={(e) => setNewCrew({ ...newCrew, instagramHandle: e.target.value })}
                    placeholder="@username"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Instagram URL</label>
                  <input
                    type="url"
                    value={newCrew.instagramUrl || ''}
                    onChange={(e) => setNewCrew({ ...newCrew, instagramUrl: e.target.value })}
                    placeholder="https://instagram.com/..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Brief Technical Bio</label>
                <textarea
                  rows={2}
                  value={newCrew.bio || ''}
                  onChange={(e) => setNewCrew({ ...newCrew, bio: e.target.value })}
                  placeholder="Internship research achievements, orbital software contributions..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddCrewModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-mono font-bold text-xs hover:bg-cyan-400 shadow-md"
                >
                  Save Crew Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
