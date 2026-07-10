import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlignLeft, Briefcase, FileText, Upload, Zap, AlertTriangle } from 'lucide-react';

import { StepProgress } from '../components/StepProgress';
import { analyzeResume } from '../lib/api';
import { useSession } from '../context/SessionContext';

type InputMode = 'text' | 'pdf';

export function HomePage() {
  const navigate = useNavigate();
  const { sessionId } = useSession();
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [showColdStartWarning, setShowColdStartWarning] = useState(false);
  const coldStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    try {
      const result = await analyzeResume({
        sessionId,
        inputMode,
        resumeText,
        resumeFile: resumeFile ?? undefined,
        jobDescription,
      });
      window.sessionStorage.setItem(`analysis:${result.analysis_id}`, JSON.stringify(result));
      navigate(`/results/${result.analysis_id}`);
    } catch (caught) {
      const message =
        typeof caught === 'object' &&
        caught !== null &&
        'response' in caught &&
        typeof caught.response === 'object' &&
        caught.response !== null &&
        'data' in caught.response
          ? String((caught.response as { data?: { detail?: string } }).data?.detail ?? 'Analysis failed.')
          : 'Analysis failed. Please retry.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitting) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-14">
        {showColdStartWarning && (
          <div className="mb-6 rounded-lg border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>Server is warming up (free tier cold start) — this may take ~30 seconds</span>
          </div>
        )}
        <StepProgress activeStep={activeStep} />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="h-28 animate-pulse rounded-lg bg-surface" />
          <div className="h-28 animate-pulse rounded-lg bg-surface" />
          <div className="h-28 animate-pulse rounded-lg bg-surface" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
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
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm ${
                  inputMode === 'text' ? 'bg-primary text-white' : 'text-textSecondary'
                }`}
              >
                <AlignLeft size={16} />
                Paste
              </button>
              <button
                type="button"
                onClick={() => setInputMode('pdf')}
                className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm ${
                  inputMode === 'pdf' ? 'bg-primary text-white' : 'text-textSecondary'
                }`}
              >
                <Upload size={16} />
                PDF
              </button>
            </div>

            {inputMode === 'text' ? (
              <textarea
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                className="mt-4 min-h-72 w-full resize-y rounded-lg border border-line bg-base p-4 text-sm outline-none focus:border-primary"
                placeholder="Paste your resume text here..."
              />
            ) : (
              <label className="mt-4 flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-line bg-base p-6 text-center transition hover:border-primary">
                <Upload className="mb-3 text-primary" size={28} />
                <span className="font-medium">{resumeFile ? resumeFile.name : 'Drop your PDF here'}</span>
                <span className="mt-2 text-sm text-textSecondary">PDF only, max 5MB</span>
                <input
                  className="sr-only"
                  type="file"
                  accept="application/pdf"
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
              className="mt-4 min-h-[336px] w-full resize-y rounded-lg border border-line bg-base p-4 text-sm outline-none focus:border-primary"
              placeholder="Paste the full job description here..."
            />
          </section>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:bg-primary-hover hover:shadow-[0_0_30px_rgba(16,185,129,0.40)]"
        >
          <Zap size={18} />
          Analyze Now
        </button>
      </form>
    </main>
  );
}
