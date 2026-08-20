import { Link } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  Check,
  Chrome,
  FileText,
  GitCompareArrows,
  GraduationCap,
  Kanban,
  Layers,
  Lightbulb,
  Rocket,
  Search,
  Share2,
  Sparkles,
  Target,
  Upload,
  Zap,
} from 'lucide-react';

const STEP_ICONS = [Target, FileText, Sparkles, BarChart3] as const;

const steps = [
  {
    icon: Target,
    title: 'Paste the job description',
    desc: 'Enter a job posting URL or paste the full text. Use the Chrome extension to auto-extract it from any LinkedIn, Indeed, or Naukri page.',
  },
  {
    icon: FileText,
    title: 'Upload your resume',
    desc: 'Paste text or drop a PDF. Resumes are stored in your account (up to 3) so you never have to re-upload.',
  },
  {
    icon: Sparkles,
    title: 'AI analyzes the match',
    desc: 'Our model scores your resume across four dimensions — skills, experience, keywords, and ATS compatibility.',
  },
  {
    icon: BarChart3,
    title: 'Get actionable insights',
    desc: 'See exactly what to fix: missing skills, keyword gaps, ATS warnings, and a personalized learning roadmap.',
  },
];

const features = [
  {
    icon: BarChart3,
    title: '4-Dimension Match Score',
    desc: 'Skills, experience, keywords, and ATS compatibility scored with clear explanations.',
    color: 'bg-primary',
  },
  {
    icon: Layers,
    title: 'ATS Simulator',
    desc: 'Rules-based keyword pass/fail checks plus an LLM-scored resume report.',
    color: 'bg-secondary',
  },
  {
    icon: GitCompareArrows,
    title: 'Compare Up to 3 Jobs',
    desc: 'Compare multiple job descriptions against one resume to find the best-fit role.',
    color: 'bg-primary',
  },
  {
    icon: GraduationCap,
    title: 'Learning Roadmap',
    desc: 'A personalized, resource-backed plan for every missing skill powered by web search.',
    color: 'bg-secondary',
  },
  {
    icon: Sparkles,
    title: 'AI Career Coach',
    desc: 'Multi-turn LangGraph assistant that remembers your history and gives tailored advice.',
    color: 'bg-primary',
  },
  {
    icon: Kanban,
    title: 'Application Tracker',
    desc: 'Kanban board across 7 pipeline stages, prefilled straight from an analysis.',
    color: 'bg-secondary',
  },
  {
    icon: Upload,
    title: 'Resume Storage',
    desc: 'Store up to 3 resumes in your account. Switch between them instantly in the analyzer and extension.',
    color: 'bg-primary',
  },
  {
    icon: Chrome,
    title: 'Chrome Extension',
    desc: 'Analyze any job page directly from your browser — auto-extracts the JD, loads your saved resumes.',
    color: 'bg-secondary',
  },
  {
    icon: Share2,
    title: 'Shareable Results',
    desc: 'Generate a public link to any analysis with a blur-to-signup conversion page.',
    color: 'bg-primary',
  },
  {
    icon: Search,
    title: 'Smart JD Fetcher',
    desc: 'Paste a LinkedIn, Indeed, or Naukri URL and the backend automatically extracts the full job description.',
    color: 'bg-secondary',
  },
  {
    icon: Lightbulb,
    title: 'Pro Tips & Insights',
    desc: 'Contextual advice on how to improve your resume for each specific role.',
    color: 'bg-primary',
  },
  {
    icon: Zap,
    title: 'Daily Usage Tracking',
    desc: 'Monitor your analysis count against the free tier, with upgrade options for power users.',
    color: 'bg-secondary',
  },
];

function FeatureCard({ icon: Icon, title, desc, color }: { icon: typeof BarChart3; title: string; desc: string; color: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-surface p-6 shadow-card transition-all hover:shadow-cardHover hover:-translate-y-1">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-primary/[0.04] transition-transform group-hover:scale-150" aria-hidden="true" />
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color} shadow-sm`}>
        <Icon size={20} className="text-white" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-textPrimary">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-textSecondary">{desc}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base text-textPrimary">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-secondary/10 blur-3xl" aria-hidden="true" />

        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 text-center sm:pt-32">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            <Zap size={14} aria-hidden="true" />
            AI-powered resume analysis
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-textPrimary sm:text-5xl lg:text-6xl">
            See how your resume matches<br className="hidden sm:block" /> any job —{' '}
            <span className="text-primary">in seconds</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-textSecondary">
            TalentSense AI scores your resume against any job description using four dimensions of
            analysis — skills, experience, keywords, and ATS compatibility — so you know exactly what
            to fix before you apply.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/sign-up"
              className="group flex items-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
            >
              <Rocket size={18} aria-hidden="true" />
              Get Started Free
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center gap-2 rounded-xl border border-line px-8 py-3.5 text-base font-medium text-textSecondary transition-all hover:bg-elevated hover:text-textPrimary"
            >
              How it works
            </a>
          </div>

          <p className="mt-8 text-sm text-textMuted">
            Free tier included · No credit card required · Works with LinkedIn, Indeed &amp; Naukri
          </p>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────── */}
      <section id="how-it-works" className="bg-surface py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-textPrimary">How it works</h2>
            <p className="mx-auto mt-3 max-w-xl text-textSecondary">
              Four steps from job posting to a personalized action plan.
            </p>
          </div>

          <div className="relative mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Connector line */}
            <div className="absolute left-0 right-0 top-8 hidden h-0.5 bg-line lg:block" aria-hidden="true" />

            {steps.map((step, i) => {
              const StepIcon = STEP_ICONS[i];
              return (
                <div key={step.title} className="relative text-center">
                  <div className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-card">
                    <StepIcon size={26} aria-hidden="true" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-xs font-bold text-primary shadow-sm ring-2 ring-primary">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-textPrimary">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-textSecondary">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-textPrimary">Everything you need to land the job</h2>
            <p className="mx-auto mt-3 max-w-xl text-textSecondary">
              A complete toolkit — from analysis to application tracking — all powered by AI.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Extension Banner ─────────────────────────────── */}
      <section className="py-12">
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative overflow-hidden rounded-3xl bg-surface shadow-cardLg">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col items-center gap-8 p-10 text-center sm:flex-row sm:text-left">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary shadow-card">
                <Chrome size={28} className="text-white" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-textPrimary">Browser Extension</h3>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-textSecondary">
                  Analyze any job posting directly from LinkedIn, Indeed, or Naukri. The extension
                  auto-extracts the job description, loads your saved resumes, and shows a step-by-step
                  progress tracker — all from your browser's side panel.
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-textMuted">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">Auto JD Fetch</span>
                  <span className="rounded-full bg-secondary/10 px-3 py-1 text-secondary">Saved Resumes</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">Live Progress</span>
                  <span className="rounded-full bg-secondary/10 px-3 py-1 text-secondary">Chrome &amp; Edge</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-textPrimary">
            Ready to find your perfect match?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-textSecondary">
            Create a free account, upload your resume, and get a detailed match score in seconds.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/sign-up"
              className="rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg"
            >
              Get Started Free
            </Link>
            <a
              href="/sign-in"
              className="rounded-xl border border-line px-8 py-3.5 text-base font-medium text-textSecondary transition-all hover:bg-elevated hover:text-textPrimary"
            >
              Sign In
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-line bg-surface py-8">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-6 text-sm text-textMuted sm:flex-row">
          <span className="font-medium text-textSecondary">TalentSense AI</span>
          <div className="flex gap-6">
            <a href="https://github.com/user/resume-job-analyzer" className="transition hover:text-primary">GitHub</a>
            <span>&copy; {new Date().getFullYear()} TalentSense AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
