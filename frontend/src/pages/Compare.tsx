import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Trash2, Trophy } from 'lucide-react';

import { useCompareMutation } from '../hooks/useCompare';

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? '#10B981' : value >= 60 ? '#F59E0B' : '#EF4444';
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-textSecondary">{label}</span>
        <span className="font-semibold" style={{ color }}>
          {value}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function extractErrorMessage(caught: unknown): string {
  if (typeof caught === 'object' && caught !== null && 'response' in caught) {
    const response = (caught as { response?: unknown }).response;
    if (typeof response === 'object' && response !== null) {
      const data = (response as { data?: unknown }).data;
      if (typeof data === 'object' && data !== null) {
        const detail = (data as { detail?: unknown }).detail;
        if (typeof detail === 'object' && detail !== null && 'message' in (detail as object)) {
          return (detail as { message: string }).message;
        }
        if (typeof detail === 'string') return detail;
        if ('message' in (data as object)) return (data as { message: string }).message;
      }
    }
  }
  return 'Comparison failed. Please retry.';
}

export function ComparePage() {
  const [resumeText, setResumeText] = useState('');
  const [jds, setJds] = useState<string[]>(['', '']);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { mutate: compare, data, isPending, error } = useCompareMutation();

  const canCompare = useMemo(
    () => resumeText.trim().length >= 200 && jds.length >= 2 && jds.every((jd) => jd.trim().length >= 100),
    [resumeText, jds],
  );

  const addJD = () => {
    if (jds.length < 3) setJds([...jds, '']);
  };

  const removeJD = (index: number) => {
    if (jds.length > 2) setJds(jds.filter((_, i) => i !== index));
  };

  const updateJD = (index: number, value: string) => {
    const updated = [...jds];
    updated[index] = value;
    setJds(updated);
  };

  const handleCompare = () => {
    setValidationError(null);
    if (resumeText.trim().length < 200) {
      setValidationError('Resume text is too short (minimum 200 characters)');
      return;
    }
    if (jds.length < 2) {
      setValidationError('Add at least 2 job descriptions to compare.');
      return;
    }
    for (let i = 0; i < jds.length; i++) {
      if (jds[i].trim().length < 100) {
        setValidationError(`Job description ${i + 1} is too short (minimum 100 characters)`);
        return;
      }
    }
    compare({ resumeText, jobDescriptions: jds });
  };

  const serverError = error ? extractErrorMessage(error) : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Multi-JD Comparison</h1>
        <p className="mt-2 text-sm text-textSecondary">Find which job fits your resume best</p>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold">Your Resume</h2>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste your resume text here..."
            className="h-40 w-full resize-none rounded-lg border border-line bg-elevated p-4 text-sm outline-none focus:border-primary"
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Job Descriptions ({jds.length}/3)</h2>
            {jds.length < 3 ? (
              <button onClick={addJD} className="flex items-center gap-1.5 text-xs text-primary transition hover:text-primary-hover">
                <Plus size={12} aria-hidden="true" /> Add Job Description
              </button>
            ) : null}
          </div>

          <div className={`grid gap-4 ${jds.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
            {jds.map((jd, i) => (
              <div key={i} className="rounded-lg border border-line bg-surface p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-textSecondary">JOB {i + 1}</span>
                  {jds.length > 2 ? (
                    <button
                      onClick={() => removeJD(i)}
                      className="text-textMuted transition hover:text-red-400"
                      aria-label={`Remove job description ${i + 1}`}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <textarea
                  value={jd}
                  onChange={(e) => updateJD(i, e.target.value)}
                  placeholder={`Paste job description ${i + 1}...`}
                  className="h-48 w-full resize-none rounded-lg border border-line bg-elevated p-3 text-xs outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
        </section>

        {validationError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300" role="alert">
            {validationError}
          </div>
        ) : null}

        {serverError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300" role="alert">
            {serverError}
          </div>
        ) : null}

        <div className="flex justify-center">
          <button
            onClick={handleCompare}
            disabled={isPending || !canCompare}
            className="flex items-center gap-2 rounded-lg bg-primary px-10 py-3 font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
            {isPending ? 'Comparing...' : `Compare ${jds.length} Jobs`}
          </button>
        </div>

        {data ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-primary/30 bg-primary-subtle p-6">
              <div className="flex items-start gap-3">
                <Trophy size={20} className="mt-0.5 flex-shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <div className="mb-1 font-semibold">
                    Recommended: {data.recommendation.recommended_title}
                  </div>
                  <p className="text-sm text-textSecondary">{data.recommendation.reasoning}</p>
                  {data.recommendation.avoid_reason ? (
                    <p className="mt-2 flex items-center gap-1 text-xs text-secondary">
                      <AlertTriangle size={11} aria-hidden="true" />
                      Avoid Job {data.recommendation.avoid_index + 1}: {data.recommendation.avoid_reason}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={`grid gap-4 ${data.results.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
              {data.results.map((result, i) => {
                const isRecommended = i === data.recommendation.recommended_index;
                return (
                  <div
                    key={`${result.job_title}-${i}`}
                    className={`rounded-lg bg-surface p-6 border-2 ${isRecommended ? 'border-primary' : 'border-line'}`}
                  >
                    {result.error ? (
                      <div>
                        <h3 className="mb-1 text-sm font-semibold">{result.job_title}</h3>
                        <p className="text-xs text-red-400">{result.error}</p>
                      </div>
                    ) : (
                      <>
                        {isRecommended ? (
                          <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-primary">
                            <Trophy size={10} aria-hidden="true" /> BEST MATCH
                          </div>
                        ) : null}
                        <h3 className="mb-1 text-sm font-semibold">{result.job_title}</h3>

                        <div
                          className="mb-4 text-4xl font-extrabold"
                          style={{
                            color:
                              result.scores.overall >= 80
                                ? '#10B981'
                                : result.scores.overall >= 60
                                  ? '#F59E0B'
                                  : '#EF4444',
                          }}
                        >
                          {result.scores.overall}%
                        </div>

                        <div className="mb-4 space-y-2.5">
                          <ScoreBar label="Skills" value={result.scores.skills_match} />
                          <ScoreBar label="Experience" value={result.scores.experience_relevance} />
                          <ScoreBar label="Keywords" value={result.scores.keyword_coverage} />
                        </div>

                        <p className="mb-3 text-xs italic text-textSecondary">{result.fit_summary}</p>

                        {result.missing_skills.length > 0 ? (
                          <div>
                            <div className="mb-1 text-xs text-textMuted">Key Gaps</div>
                            <div className="flex flex-wrap gap-1">
                              {result.missing_skills.slice(0, 4).map((s) => (
                                <span key={s} className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-400">
                                  {s}
                                </span>
                              ))}
                              {result.missing_skills.length > 4 ? (
                                <span className="text-xs text-textMuted">+{result.missing_skills.length - 4} more</span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
