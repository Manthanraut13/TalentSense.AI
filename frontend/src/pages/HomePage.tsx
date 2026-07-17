import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlignLeft, Briefcase, FileText, Upload, Zap, AlertTriangle } from 'lucide-react';

import { HistorySidebar } from '../components/HistorySidebar';
import { analyzeResume } from '../lib/api';
import { useAuth } from '@clerk/clerk-react';
import { useUsage } from '../hooks/useUsage';

type InputMode = 'text' | 'pdf';

export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSignedIn, userId } = useAuth();
  const { data: usage } = useUsage();
  const isAtLimit = usage && !usage.is_pro && usage.remaining === 0;
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [showColdStartWarning, setShowColdStartWarning] = useState(false);
  const coldStartTimerRef = useRef<number | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const analyzeMutation = useMutation({
    mutationFn: analyzeResume,
    onSuccess: (result) => {
      window.sessionStorage.setItem(`analysis:${result.analysis_id}`, JSON.stringify(result));
      queryClient.invalidateQueries({ queryKey: ['history', userId] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      navigate(`/results/${result.analysis_id}`);
    },
    onError: (caught: unknown) => {
      const detail = 
        typeof caught === 'object' &&
        caught !== null &&
        'response' in caught &&
        typeof caught.response === 'object' &&
        caught.response !== null &&
        'data' in caught.response
          ? (caught.response as { data?: { detail?: string; message?: string } }).data
          : null;
      
      // Handle rate limit error (429)
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

  useEffect(() => {
    if (!isSubmitting) return;
    const timer = window.setInterval(() => {
      setActiveStep((step) => Math.min(step + 1, 4));
    }, 2500);
    return () => window.clearInterval(timer);
  }, [isSubmitting]);

  // Cold start warning - show after 5 seconds of waiting
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

    return () => {
      if (coldStartTimerRef.current) {
        clearTimeout(coldStartTimerRef.current);
        coldStartTimerRef.current = null;
      }
    };
  }, [isSubmitting]);

  // Focus error message when it appears
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (inputMode === 'text' && resumeText.trim().length < 200) {
      setError('Resume text must be at least 200 characters.');
      return;
    }

    if (inputMode === 'pdf' && !resumeFile) {
      setError('Upload a PDF resume before analysis.');
      return;
    }

    if (jobDescription.trim().length < 100) {
      setError('Job description must be at least 100 characters.');
      return;
    }

    setIsSubmitting(true);
    setActiveStep(0);

    analyzeMutation.mutate({
      inputMode,
      resumeText,
      resumeFile: resumeFile ?? undefined,
      jobDescription,
    });
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Please sign in to analyze resumes</h1>
          <a href="/sign-in" className="text-primary hover: items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        {showColdStartWarning && (
          <div className="mb-6 rounded-lg border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary flex items-center gap-2" role="status" aria-live="polite">
            <AlertTriangle size={18} />
            <span>Server is warming up (free tier cold start) — this may take ~30 seconds</span>
          </div>
        )}
        <div className="mt-6 space-y-3">
          {[
            'Parsing your resume',
            'Analyzing job requirements',
            'Calculating match score',
            'Generating recommendations',
            'Almost done',
          ].map((step, index) => (
            <div
              key={step}
              className={`flex items-center gap-3 text-sm ${
                index < activeStep ? 'text-textPrimary' : index === activeStep ? 'text-secondary animate-pulse' : 'text-textMuted'
              }`}
            >
              {index < activeStep ? (
                <svg className="text-primary" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg className={index === activeStep ? 'animate-pulse text-secondary' : ''} width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/></svg>
              )}
              {step}
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-base">
      <main className="mx-auto max-w-7xl px-4 py-8 lg:grid lg:grid-cols-[288px_1fr] lg:gap-6">
        <HistorySidebar />

        <div className="lg:col-span-1">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Analyze your resume against any job</h1>
            <p className="mt-2 max-w-2xl text-sm text-textSecondary">
              Upload or paste a resume, paste a job description, and get a structured match report.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-line bg-surface p-5">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <FileText className="text-primary" size={20} />
                  Resume Input
                </h2>
                <div className="mt-4 grid grid-cols-2 rounded-lg border border-line bg-base p-1">
                  <button
                    type="button"
                    onClick={() => setInputMode('text')}
                    className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base ${
                      inputMode === 'text' ? 'bg-primary text-white' : 'text-textSecondary'
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
                    className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base ${
                      inputMode === 'pdf' ? 'bg-primary text-white' : 'text-textSecondary'
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
                    onChange={(event) => setResumeText(event.target.value)}
                    className="mt-4 min-h-72 w-full resize-y rounded-lg border border-line bg-base p-4 text-sm outline-none focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                    placeholder="Paste your resume text here..."
                    required
                    aria-required="true"
                    aria-describedby="resume-help"
                  />
                ) : (
                  <label className="mt-4 flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-base p-6 text-center transition hover:border-primary">
                    <Upload className="mb-3 text-primary" size={28} aria-hidden="true" />
                    <span className="font-medium">{resumeFile ? resumeFile.name : 'Drop your PDF here'}</span>
                    <span className="mt-2 text-sm text-textSecondary">PDF only, max 5MB</span>
                    <input
                      className="sr-only"
                      type="file"
                      accept="application/pdf"
                      required
                      aria-required="true"
                      onChange={(event) => setResumeFile(event.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </section>

              <section className="rounded-lg border border-line bg-surface p-5">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Briefcase className="text-secondary" size={20} />
                  Job Description
                </h2>
                <textarea
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  className="mt-4 min-h-[336px] w-full resize-y rounded-lg border border-line bg-base p-4 text-sm outline-none focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                  placeholder="Paste the full job description here..."
                  required
                  aria-required="true"
                />
              </section>
            </div>

            {error ? (
              <div
                ref={errorRef}
                tabIndex={-1}
                className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            ) : null}

            {isAtLimit && !error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                Daily limit reached. <a href="/pricing" className="text-primary underline">Upgrade to Pro</a> for unlimited analyses.
              </div>
            )}

            <button
              type="submit"
              disabled={isAtLimit || isSubmitting}
              className={`inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:bg-primary-hover hover:shadow-[0_0_30px_rgba(16,185,129,0.40)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base ${isAtLimit || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Zap size={18} aria-hidden="true" />
              {isAtLimit ? 'Daily Limit Reached' : isSubmitting ? 'Analyzing...' : 'Analyze Now'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}