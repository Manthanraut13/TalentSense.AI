import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlignLeft, Briefcase, FileText, Upload, Zap, AlertTriangle, Loader2 } from 'lucide-react';

import { HistorySidebar } from '../components/HistorySidebar';
import { analyzeResume } from '../lib/api';
import { useAuth } from '@clerk/clerk-react';
import { validateResumeText, validateJD, validatePDFFile } from '../lib/validators';


type InputMode = 'text' | 'pdf';

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

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-line bg-surface p-5">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <FileText className="text-primary" size={20} />
                  Resume
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
                    onChange={(e) => setResumeText(e.target.value)}
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
                      onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </section>

              <section className="rounded-lg border border-line bg-surface p-5">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <Briefcase className="text-secondary" size={20} />
                  Job Description
                </h2>
                <div className="flex gap-2 mt-2 items-center">
                  <button
                    type="button"
                    onClick={() => { setJdMode('paste'); setJdSuccess(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm transition-colors ${
                      jdMode === 'paste' ? 'bg-primary text-white' : 'text-textSecondary'
                    }`}
                  >
                    Paste
                  </button>
                  <button
                    type="button"
                    onClick={() => { setJdMode('url'); setJdSuccess(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm transition-colors ${
                      jdMode === 'url' ? 'bg-primary text-white' : 'text-textSecondary'
                    }`}
                  >
                    URL
                  </button>
                </div>

                {jdMode === 'paste' ? (
                  <textarea
                    value={jdText}
                    onChange={(e) => { setJdText(e.target.value); setJdSuccess(''); }}
                    className="mt-4 min-h-[336px] w-full resize-y rounded-lg border border-line bg-base p-4 text-sm outline-none focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base"
                    placeholder="Paste the full job description here..."
                    required
                    aria-required="true"
                  />
                ) : (
                  <div className="space-y-3">
                    <input
                      type="url"
                      value={jdUrl}
                      onChange={(e) => { setJdUrl(e.target.value); setJdSuccess(''); setJdText(''); }}
                      placeholder="https://linkedin.com/jobs/view/..."
                      className="w-full bg-elevated border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => scrapeMutation.mutate(jdUrl)}
                      disabled={!jdUrl || scrapeMutation.isPending}
                      className="w-full bg-secondary text-black font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {scrapeMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                      {scrapeMutation.isPending ? 'Fetching JD...' : 'Fetch Job Description'}
                    </button>
                    {jdText ? (
                      <div className="rounded-lg border border-line bg-base p-3">
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-xs text-textSecondary">
                            Fetched job description — review it, then click Analyze Now.
                          </p>
                          <span className="ml-2 shrink-0 text-xs text-textSecondary">
                            {jdText.length.toLocaleString()} chars
                          </span>
                        </div>
                        <textarea
                          readOnly
                          value={jdText}
                          className="max-h-48 min-h-24 w-full resize-y rounded-md border border-line bg-elevated p-3 text-xs text-textPrimary outline-none"
                          aria-label="Fetched job description preview"
                        />
                      </div>
                    ) : null}
                  </div>
                )}
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

            {resumeError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {resumeError}
              </div>
            ) : null}

            {jdError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {jdError}
              </div>
            ) : null}

            {jdSuccess ? (
              <div
                className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary"
                role="status"
                aria-live="polite"
              >
                {jdSuccess}
              </div>
            ) : null}

            {showColdStartWarning && !error && !resumeError && !jdError && (
              <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-4 text-sm text-secondary flex items-center gap-2" role="status" aria-live="polite">
                <AlertTriangle size={18} />
                <span>Server is warming up (free tier cold start) — this may take ~30 seconds</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || (jdMode === 'url' && !jdText.trim())}
              className={`inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3 font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:bg-primary-hover hover:shadow-[0_0_30px_rgba(16,185,129,0.40)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Zap size={18} aria-hidden="true" />
              {isSubmitting ? 'Analyzing...' : 'Analyze Now'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
