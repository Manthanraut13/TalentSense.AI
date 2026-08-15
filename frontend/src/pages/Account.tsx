import { format } from 'date-fns';
import { AlignLeft, CalendarDays, Check, FileText, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { useState } from 'react';

import { useResumes } from '../hooks/useResumes';
import { validatePDFFile, validateResumeText } from '../lib/validators';

const MAX_RESUMES = 3;
type InputMode = 'text' | 'pdf';

export default function Account() {
  const {
    resumes,
    isLoading,
    error,
    addResume,
    isAdding,
    addError,
    removeResume,
  } = useResumes();

  const [showForm, setShowForm] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const count = resumes?.length ?? 0;
  const atLimit = count >= MAX_RESUMES;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please give your resume a name.');
      return;
    }
    if (inputMode === 'text') {
      const textError = validateResumeText(resumeText);
      if (textError) {
        setFormError(textError);
        return;
      }
    } else {
      if (!resumeFile) {
        setFormError('Please select a PDF file.');
        return;
      }
      const fileError = validatePDFFile(resumeFile);
      if (fileError) {
        setFormError(fileError);
        return;
      }
    }
    setFormError(null);
    try {
      const saved = await addResume({
        name: name.trim(),
        inputMode,
        resumeText: inputMode === 'text' ? resumeText : undefined,
        resumeFile: inputMode === 'pdf' ? resumeFile || undefined : undefined,
      });
      setSelectedId(saved.resume_id);
      setName('');
      setResumeText('');
      setResumeFile(null);
      setShowForm(false);
    } catch {
      setFormError('Could not save the resume. Please try again.');
    }
  }

  function handleDelete(id: string) {
    if (window.confirm('Delete this saved resume?')) {
      void removeResume(id).catch(() => {});
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-textPrimary">Account</h1>
          <p className="mt-1 text-sm text-textSecondary">
            Manage the resumes used for match analysis.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Close' : 'Add Resume'}
        </button>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
        <p className="text-sm text-textSecondary">
          Stored resumes: <span className="font-semibold text-textPrimary">{count} / {MAX_RESUMES}</span>
        </p>
        <p className="text-xs text-textMuted">Oldest is removed automatically when full</p>
      </div>

      {atLimit ? (
        <div className="mb-6 rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3 text-sm text-secondary" role="status">
          Resume limit reached ({MAX_RESUMES}). Adding a new resume will automatically remove the oldest one.
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={handleAdd} noValidate className="mb-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-4 text-lg font-semibold">Store a new resume</h2>
          <div className="mb-4">
            <label className="block">
              <span className="mb-1 block text-sm text-textSecondary">Resume name *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-textPrimary outline-none focus:border-primary"
                placeholder="e.g. Software Engineer Resume"
                required
              />
            </label>
          </div>

          <div className="mb-4 grid grid-cols-2 rounded-xl border border-line bg-elevated p-1">
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                inputMode === 'text' ? 'bg-primary text-white shadow-card' : 'text-textSecondary'
              }`}
              aria-pressed={inputMode === 'text'}
            >
              <AlignLeft size={16} /> Paste text
            </button>
            <button
              type="button"
              onClick={() => setInputMode('pdf')}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                inputMode === 'pdf' ? 'bg-primary text-white shadow-card' : 'text-textSecondary'
              }`}
              aria-pressed={inputMode === 'pdf'}
            >
              <Upload size={16} /> Upload PDF
            </button>
          </div>

          {inputMode === 'text' ? (
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="min-h-48 w-full resize-none rounded-xl border-2 border-outlineVariant bg-containerLow p-4 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Paste your full resume text here..."
            />
          ) : (
            <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-outlineVariant bg-containerLow p-6 text-center transition-colors hover:border-primary hover:bg-containerLow">
              <Upload className="mb-3 text-outlineVariant" size={40} />
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
                onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}

          {formError ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700" role="alert">
              {formError}
            </p>
          ) : null}
          {addError ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700" role="alert">
              {addError instanceof Error ? addError.message : 'Could not save the resume.'}
            </p>
          ) : null}

          <div className="mt-4">
            <button
              type="submit"
              disabled={isAdding}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {isAdding && <Loader2 size={14} className="animate-spin" />}
              {isAdding ? 'Saving...' : 'Save Resume'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-textSecondary shadow-card">
          Could not load your resumes: {error.message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : resumes && resumes.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {resumes.map((resume) => {
            const isSelected = resume.resume_id === selectedId;
            return (
              <li
                key={resume.resume_id}
                className={`rounded-xl border bg-surface p-4 shadow-card transition-colors ${
                  isSelected ? 'border-primary' : 'border-line'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(resume.resume_id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-pressed={isSelected}
                  >
                    <span
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                        isSelected ? 'bg-primary text-white' : 'bg-elevated text-textSecondary'
                      }`}
                    >
                      <FileText size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-textPrimary">{resume.name}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-textMuted">
                        <CalendarDays size={12} aria-hidden="true" />
                        Added {format(new Date(resume.created_at), 'MMM d, yyyy')}
                      </span>
                    </span>
                    {isSelected ? (
                      <span className="ml-auto flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        <Check size={12} aria-hidden="true" /> Selected
                      </span>
                    ) : null}
                  </button>
                  <button
                    onClick={() => handleDelete(resume.resume_id)}
                    className="shrink-0 rounded-lg border border-line p-1.5 text-textMuted transition hover:border-red-500/40 hover:text-red-600"
                    aria-label={`Delete resume ${resume.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <FileText className="mx-auto mb-3 text-textMuted" size={32} />
          <p className="text-textSecondary">No resumes stored yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
          >
            <Plus size={14} /> Store your first resume
          </button>
        </div>
      )}
    </main>
  );
}
