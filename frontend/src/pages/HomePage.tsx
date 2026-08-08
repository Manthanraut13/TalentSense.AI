import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlignLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  Check,
  FileText,
  Lightbulb,
  Loader2,
  Sparkles,
  Upload,
  User,
  X,
  Zap,
  AlertTriangle,
} from 'lucide-react';

import { HistorySidebar } from '../components/HistorySidebar';
import { analyzeResume } from '../lib/api';
import { useAuth } from '@clerk/clerk-react';
import { validateResumeText, validateJD, validatePDFFile } from '../lib/validators';

type InputMode = 'text' | 'pdf';
type StepState = 'done' | 'active' | 'upcoming';

function Step({
  icon: Icon,
  label,
  state,
}: {
  icon: typeof User;
  label: string;
  state: StepState;
}) {
  return (
    <div className="group flex flex-col items-center gap-2">
      <div
        className={`relative flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition-transform group-hover:scale-110 ${
          state === 'upcoming' ? 'bg-surfaceVariant text-textSecondary' : 'bg-primary text-white'
        }`}
      >
        {state === 'active' ? (
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" aria-hidden="true" />
        ) : null}
        {state === 'done' ? <Check size={20} aria-hidden="true" /> : <Icon size={20} aria-hidden="true" />}
      </div>
      <span className={`text-xs font-medium ${state === 'upcoming' ? 'text-textMuted' : 'text-primary'}`}>
        {label}
      </span>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  tileClass,
  blobClass,
  title,
  body,
}: {
  icon: typeof Lightbulb;
  tileClass: string;
  blobClass: string;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative flex-1 overflow-hidden rounded-2xl bg-surface p-6 shadow-card transition hover:shadow-cardHover">
      <div className={`absolute right-0 top-0 h-24 w-24 rounded-bl-full ${blobClass} transition-transform group-hover:scale-110`} aria-hidden="true" />
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full shadow-sm ${tileClass}`}>
          <Icon size={22} className="text-white" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-textPrimary">{title}</h3>
          <p className="mt-0.5 text-sm text-textSecondary">{body}</p>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSignedIn, userId } = useAuth();

  const [jdMode, setJdMode] = useState<'paste' | 'url'>('paste');
  const [jdUrl, setJdUrl] = useState('');
  const [jdText, setJdText] = useState('');
  const [jdError, setJdError] = useState('');
  const [jdSuccess, setJdSuccess] = useState('');

  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [inputMode, setInputMode] = useState<InputMode>('text');

  const [error, setError] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [showColdStartWarning, setShowColdStartWarning] = useState(false);
  const [coldStartDismissed, setColdStartDismissed] = useState(false);
  const coldStartTimerRef = useRef<number | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const analyzeMutation = useMutation({
    mutationFn: analyzeResume,
    onSuccess: (result) => {
      console.debug('[HomePage] Analysis successful', { id: result.analysis_id, title: result.job_title, score: result.scores.overall });
      window.sessionStorage.setItem(`analysis:${result.analysis_id}`, JSON.stringify(result));
      queryClient.invalidateQueries({ queryKey: ['history', userId] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      navigate(`/results/${result.analysis_id}`);
    },
    onError: (caught: unknown) => {
      console.error('[HomePage] Analysis failed', caught);
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      const detail =
        typeof caught === 'object' &&
        caught !== null &&
        'response' in caught &&
        typeof caught.response === 'object' &&
        caught.response !== null &&
        'data' in caught.response
          ? (caught.response as { data?: { detail?: string; message?: string } }).data
          : null;

      if (detail && typeof detail === 'object' && 'message' in detail && detail.message) {
        setError(detail.message);
      } else if (detail && typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Analysis failed. Please retry.');
      }
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: async (url: string) => {
      console.debug('[HomePage] Scraping JD from URL:', url);
      const { data } = await api.post('/api/v1/scrape-jd', { url });
      return data;
    },
    onSuccess: (data) => {
      console.debug('[HomePage] JD scrape successful', { chars: data.character_count, source: data.source });
      setJdText(data.job_description);
      setJdError('');
      setJdSuccess('Job description fetched successfully from the URL.');
    },
    onError: (e: unknown) => {
      console.warn('[HomePage] JD scrape failed', e);
      setJdSuccess('');
      if (e && typeof e === 'object' && 'response' in e && e.response && typeof e.response === 'object' && 'data' in e.response) {
        const msg = (e.response as { data?: { detail?: string; message?: string } }).data?.detail || (e.response as { data?: { detail?: string; message?: string } }).data?.message || 'Failed to fetch job description';
        setJdError(msg);
      } else {
        setJdError('Failed to fetch job description. Please try again.');
      }
    },
  });

  useEffect(() => {
    if (!isSubmitting) return;
    const timer = window.setInterval(() => {
      setActiveStep((step) => Math.min(step + 1, 4));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [isSubmitting]);

  useEffect(() => {
    if (!isSubmitting) {
      setShowColdStartWarning(false);
      if (coldStartTimerRef.current) {
        clearTimeout(coldStartTimerRef.current);
        coldStartTimerRef.current = null;
      }
      return;
    }

    coldStartTimerRef.current = window.setTimeout(() => {
      setShowColdStartWarning(true);
    }, 5000);
  }, [isSubmitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setColdStartDismissed(false);
    console.debug('[HomePage] Submit started', { inputMode, jdLength: jdText.length });

    if (!isSignedIn) {
      navigate('/sign-in');
      return;
    }

try {
        const jdError = validateJD(jdText);
        if (jdError) {
          setError(jdMode === 'url' ? 'Fetch the job description from the URL before analyzing.' : jdError);
          setIsSubmitting(false);
          return;
        }

        let parsedResume;
        if (inputMode === 'text') {
          if (!resumeText || resumeText.trim().length < 200) {
            setError('Resume text is too short (minimum 200 characters)');
            setResumeError('');
            setIsSubmitting(false);
            return;
          }
          const resumeError = validateResumeText(resumeText);
          if (resumeError) {
            setError(resumeError);
            setIsSubmitting(false);
            return;
          }
          parsedResume = resumeText;
        } else {
          if (!resumeFile) {
            setError('Resume PDF is required');
            setResumeError('');
            setIsSubmitting(false);
            return;
          }

          const pdfError = validatePDFFile(resumeFile);
          if (pdfError) {
            setError(pdfError);
            setIsSubmitting(false);
            return;
          }

          parsedResume = ''; // Backend extracts text from the PDF
        }

        const result = await analyzeMutation.mutateAsync({
          inputMode,
          jobDescription: jdText,
          resumeText: parsedResume!,
          resumeFile: resumeFile || undefined,
        });
    } catch (err) {
    }
  };

  const steps: { label: string; icon: typeof User }[] = [
    { label: 'Profile', icon: User },
    { label: 'Resume', icon: FileText },
    { label: 'Job Desc', icon: Briefcase },
    { label: 'Analysis', icon: BarChart3 },
  ];
  const currentStep = isSubmitting ? Math.min(activeStep, steps.length) : 1;

  return (
    <div className="min-h-screen bg-base">
      <main className="mx-auto max-w-[1280px] px-6 py-8 lg:grid lg:grid-cols-[288px_1fr] lg:gap-6">
        <HistorySidebar />

        <div>
          {showColdStartWarning && !coldStartDismissed ? (
            <div className="mb-4 flex w-full items-center justify-between gap-4 rounded-2xl bg-secondary/10 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="flex-shrink-0 text-secondary" size={20} aria-hidden="true" />
                <p className="text-sm text-textSecondary">
                  <span className="font-semibold text-textPrimary">Cold Start Warning:</span> The first
                  analysis may take up to 45 seconds to initialize the models. Subsequent analyses will be
                  significantly faster.
                </p>
              </div>
              <button
                onClick={() => setColdStartDismissed(true)}
                className="flex-shrink-0 text-textSecondary transition-colors hover:text-textPrimary"
                aria-label="Dismiss warning"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} noValidate>
            <div className="relative overflow-hidden rounded-2xl bg-surface p-8 shadow-card">
              <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" aria-hidden="true" />
              <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-secondary/5 blur-3xl" aria-hidden="true" />

              <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-8">
                <div className="relative flex w-full items-center justify-between">
                  <div className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-surfaceVariant" aria-hidden="true" />
                  {steps.map(({ label, icon }, i) => (
                    <Step
                      key={label}
                      icon={icon}
                      label={label}
                      state={i < currentStep ? 'done' : i === currentStep ? 'active' : 'upcoming'}
                    />
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-8 pt-2 md:grid-cols-2">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="text-primary" size={20} aria-hidden="true" />
                      <h2 className="text-lg font-semibold text-textPrimary">Upload Resume</h2>
                    </div>
                    <div className="grid grid-cols-2 rounded-xl border border-line bg-elevated p-1">
                      <button
                        type="button"
                        onClick={() => setInputMode('text')}
                        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                          inputMode === 'text' ? 'bg-primary text-white shadow-card' : 'text-textSecondary'
                        }`}
                        aria-pressed={inputMode === 'text'}
                        aria-label="Paste resume text"
                      >
                        <AlignLeft size={16} aria-hidden="true" />
                        Paste
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputMode('pdf')}
                        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                          inputMode === 'pdf' ? 'bg-primary text-white shadow-card' : 'text-textSecondary'
                        }`}
                        aria-pressed={inputMode === 'pdf'}
                        aria-label="Upload PDF resume"
                      >
                        <Upload size={16} aria-hidden="true" />
                        PDF
                      </button>
                    </div>

                    {inputMode === 'text' ? (
                      <textarea
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                        className="min-h-56 w-full resize-none rounded-xl border-2 border-outlineVariant bg-containerLow p-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder="Paste your resume text here..."
                        required
                        aria-required="true"
                        aria-describedby="resume-help"
                      />
                    ) : (
                      <label className="group flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outlineVariant bg-containerLow p-6 text-center transition-colors hover:border-primary hover:bg-containerLow">
                        <Upload
                          className="mb-3 text-outlineVariant transition-all duration-300 group-hover:scale-110 group-hover:text-primary"
                          size={48}
                          aria-hidden="true"
                        />
                        <p className="mb-1 text-sm text-textSecondary">
                          <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-textMuted">
                          {resumeFile ? `Selected: ${resumeFile.name}` : 'PDF only, max 5MB'}
                        </p>
                        <input
                          className="sr-only"
                          type="file"
                          accept="application/pdf"
                          required
                          aria-required="true"
                          onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="text-secondary" size={20} aria-hidden="true" />
                      <h2 className="text-lg font-semibold text-textPrimary">Job Description</h2>
                    </div>
                    <div className="flex h-64 flex-col overflow-hidden rounded-xl border-2 border-outlineVariant bg-containerLow transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                      <div className="z-10 mb-1 flex w-full items-center gap-2 rounded-lg bg-surface p-2 shadow-sm">
                        <X size={14} className="flex-shrink-0 text-textMuted" aria-hidden="true" />
                        <input
                          type="url"
                          value={jdUrl}
                          onChange={(e) => { setJdUrl(e.target.value); setJdSuccess(''); }}
                          placeholder="Paste Job URL (LinkedIn, Indeed, etc.)"
                          className="w-full bg-transparent text-sm text-textPrimary outline-none placeholder:text-textMuted"
                          aria-label="Job posting URL"
                        />
                        <button
                          type="button"
                          onClick={() => scrapeMutation.mutate(jdUrl)}
                          disabled={!jdUrl || scrapeMutation.isPending}
                          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-elevated px-3 py-1.5 text-xs font-medium text-textSecondary transition-colors hover:bg-surfaceVariant disabled:opacity-50"
                        >
                          {scrapeMutation.isPending ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
                          {scrapeMutation.isPending ? 'Fetching...' : 'Fetch'}
                        </button>
                      </div>
                      <textarea
                        value={jdText}
                        onChange={(e) => { setJdText(e.target.value); setJdSuccess(''); }}
                        placeholder="Or paste full job description here..."
                        className="z-10 min-h-0 w-full flex-1 resize-none bg-transparent p-3 text-sm text-textPrimary outline-none placeholder:text-textMuted"
                        required
                        aria-required="true"
                      />
                      <div className="z-10 self-end p-2 text-[11px] text-textMuted">
                        {jdText.length.toLocaleString()} / 5000 chars
                      </div>
                    </div>
                  </div>
                </div>

                {error ? (
                  <div ref={errorRef} tabIndex={-1} className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700" role="alert" aria-live="assertive">
                    {error}
                  </div>
                ) : null}
                {resumeError ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700" role="alert">
                    {resumeError}
                  </div>
                ) : null}
                {jdError ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700" role="alert">
                    {jdError}
                  </div>
                ) : null}
                {jdSuccess ? (
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary" role="status" aria-live="polite">
                    {jdSuccess}
                  </div>
                ) : null}

                <div className="flex w-full justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || (jdMode === 'url' && !jdText.trim())}
                    className="group relative flex items-center gap-2 overflow-hidden rounded-lg bg-primary px-8 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="absolute inset-0 translate-x-[-100%] bg-white/20 transition-transform duration-500 ease-in-out group-hover:translate-x-[100%]" aria-hidden="true" />
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Zap size={18} aria-hidden="true" />}
                    {isSubmitting ? 'Analyzing...' : 'Analyze Match'}
                    <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </form>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row">
            <InsightCard
              icon={Lightbulb}
              tileClass="bg-[#D97B51]"
              blobClass="bg-[#D97B51]/10"
              title="Pro Tip"
              body="Include specific metrics in your resume to boost your match score."
            />
            <InsightCard
              icon={Sparkles}
              tileClass="bg-secondary"
              blobClass="bg-secondary/10"
              title="AI Insights"
              body="Our model highlights missing keywords relevant to the JD."
            />
          </div>
        </div>
      </main>
    </div>
  );
}
