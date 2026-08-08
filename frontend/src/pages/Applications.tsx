import { format } from 'date-fns';
import { Briefcase, Clock3, ExternalLink, Loader2, MoreHorizontal, PartyPopper, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useApplications } from '../hooks/useApplications';
import type { Application, ApplicationStatus } from '../types';

const STATUS_ORDER: ApplicationStatus[] = [
  'saved',
  'applied',
  'phone_screen',
  'technical',
  'final_round',
  'offer',
  'rejected',
];

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  phone_screen: 'Phone Screen',
  technical: 'Technical',
  final_round: 'Final Round',
  offer: 'Offer',
  rejected: 'Rejected',
};

function matchScoreBadge(score: number) {
  const cls =
    score >= 75
      ? 'bg-primary/10 text-primary'
      : score >= 50
        ? 'bg-secondary/10 text-secondary'
        : 'bg-red-500/10 text-red-700';
  return (
    <span className={`rounded-md px-2 py-1 text-xs font-medium ${cls}`}>
      {score}% Match
    </span>
  );
}

function formatDate(value: string) {
  if (!value) return null;
  return format(new Date(`${value}T00:00:00`), 'MMM d, yyyy');
}

function NotesEditor({
  app,
  onSave,
}: {
  app: Application;
  onSave: (id: string, notes: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(app.notes ?? '');

  useEffect(() => {
    if (!editing) setValue(app.notes ?? '');
  }, [app.notes, editing]);

  if (!editing) {
    return (
      <div>
        {app.notes ? (
          <p className="whitespace-pre-wrap text-xs text-textSecondary">{app.notes}</p>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-textMuted transition hover:text-textSecondary"
          >
            <Pencil size={12} /> Add note
          </button>
        )}
        {app.notes ? (
          <button
            onClick={() => setEditing(true)}
            className="mt-1 flex items-center gap-1 text-xs text-textMuted transition hover:text-textSecondary"
          >
            <Pencil size={12} /> Edit
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full resize-y rounded-lg border border-line bg-surface p-2 text-xs text-textPrimary outline-none focus:border-primary"
        rows={2}
        aria-label="Application notes"
      />
      <div className="flex gap-2">
        <button
          onClick={() => {
            onSave(app.application_id, value.trim());
            setEditing(false);
          }}
          className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-hover"
        >
          Save
        </button>
        <button
          onClick={() => {
            setValue(app.notes ?? '');
            setEditing(false);
          }}
          className="rounded-md border border-line px-2 py-1 text-xs text-textSecondary hover:bg-elevated"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ApplicationCard({
  app,
  onChangeStatus,
  onDelete,
  onSaveNotes,
}: {
  app: Application;
  onChangeStatus: (id: string, status: ApplicationStatus) => void;
  onDelete: (id: string) => void;
  onSaveNotes: (id: string, notes: string) => void;
}) {
  return (
    <div className="group rounded-lg bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-semibold text-textPrimary">{app.company}</h4>
            {app.job_url ? (
              <a
                href={app.job_url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-textMuted transition hover:text-primary"
                aria-label={`Open job posting for ${app.company}`}
              >
                <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
          <p className="truncate text-sm text-textSecondary">{app.role}</p>
        </div>
        {app.match_score != null ? matchScoreBadge(app.match_score) : null}
      </div>

      {app.applied_date ? (
        <p className="mt-2 text-xs text-textMuted">Applied {formatDate(app.applied_date)}</p>
      ) : null}

      <div className="mt-2">
        <NotesEditor app={app} onSave={onSaveNotes} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <select
          value={app.status}
          onChange={(e) => onChangeStatus(app.application_id, e.target.value as ApplicationStatus)}
          className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-textPrimary outline-none focus:border-primary"
          aria-label={`Change status for ${app.company}`}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          onClick={() => onDelete(app.application_id)}
          className="shrink-0 rounded-lg border border-line p-1.5 text-textMuted transition hover:border-red-500/40 hover:text-red-600"
          aria-label={`Delete application at ${app.company}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Applications() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    applications,
    isLoading,
    error,
    addApplication,
    isAdding,
    changeStatus,
    editApplication,
    removeApplication,
  } = useApplications();

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    company: '',
    role: '',
    job_url: '',
    match_score: '',
    notes: '',
    applied_date: '',
  });

  const prefillRole = searchParams.get('role');
  const prefillScore = searchParams.get('score');
  const prefillAnalysis = searchParams.get('analysis_id');

  useEffect(() => {
    if (prefillRole) {
      setForm((f) => ({
        ...f,
        role: prefillRole,
        match_score: prefillScore ?? '',
      }));
      setShowForm(true);
    }
    // Only prefill on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map: Record<ApplicationStatus, Application[]> = {
      saved: [],
      applied: [],
      phone_screen: [],
      technical: [],
      final_round: [],
      offer: [],
      rejected: [],
    };
    const q = search.trim().toLowerCase();
    for (const app of applications ?? []) {
      if (
        !q ||
        app.company.toLowerCase().includes(q) ||
        app.role.toLowerCase().includes(q)
      ) {
        map[app.status]?.push(app);
      }
    }
    return map;
  }, [applications, search]);

  const totals = useMemo(() => {
    const list = applications ?? [];
    return {
      total: list.length,
      applied: list.filter((a) => a.status === 'applied').length,
      offers: list.filter((a) => a.status === 'offer').length,
      inProgress: list.filter((a) =>
        ['phone_screen', 'technical', 'final_round'].includes(a.status),
      ).length,
      rejected: list.filter((a) => a.status === 'rejected').length,
    };
  }, [applications]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) {
      setFormError('Company and role are required.');
      return;
    }
    let score: number | null = null;
    if (form.match_score.trim() !== '') {
      score = Number(form.match_score);
      if (Number.isNaN(score) || score < 0 || score > 100) {
        setFormError('Match score must be a number between 0 and 100.');
        return;
      }
    }
    setFormError(null);
    try {
      await addApplication({
        company: form.company.trim(),
        role: form.role.trim(),
        job_url: form.job_url.trim(),
        match_score: score,
        notes: form.notes,
        applied_date: form.applied_date || null,
        analysis_id: prefillAnalysis,
      });
      setForm({ company: '', role: '', job_url: '', match_score: '', notes: '', applied_date: '' });
      setShowForm(false);
      if (searchParams.size > 0) {
        setSearchParams({}, { replace: true });
      }
    } catch {
      setFormError('Could not save the application. Please try again.');
    }
  }

  function handleDelete(id: string) {
    if (window.confirm('Delete this application?')) {
      void removeApplication(id).catch(() => {});
    }
  }

  return (
    <main className="mx-auto max-w-[1280px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-textPrimary">Applications</h1>
          <p className="mt-1 text-sm text-textSecondary">
            Track every job you are pursuing in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-textSecondary"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg bg-surface py-2 pl-9 pr-3 text-sm text-textPrimary shadow-card outline-none placeholder:text-textSecondary focus:ring-2 focus:ring-primary/20"
              placeholder="Search applications..."
              aria-label="Search applications"
            />
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Close' : 'Add Application'}
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          {
            label: 'Total',
            value: totals.total,
            color: '#64748B',
            circle: 'bg-[#F1F5F9] text-[#64748B]',
            border: 'border-[#64748B]',
            icon: Briefcase,
          },
          {
            label: 'Applied',
            value: totals.applied,
            color: '#3B82F6',
            circle: 'bg-[#EFF6FF] text-[#3B82F6]',
            border: 'border-[#3B82F6]',
            icon: Send,
          },
          {
            label: 'In Progress',
            value: totals.inProgress,
            color: '#F59E0B',
            circle: 'bg-[#FEF3C7] text-[#F59E0B]',
            border: 'border-[#F59E0B]',
            icon: Clock3,
          },
          {
            label: 'Offers',
            value: totals.offers,
            color: '#10B981',
            circle: 'bg-[#D1FAE5] text-[#10B981]',
            border: 'border-[#10B981]',
            icon: PartyPopper,
          },
          {
            label: 'Rejected',
            value: totals.rejected,
            color: '#EF4444',
            circle: 'bg-[#FEE2E2] text-[#EF4444]',
            border: 'border-[#EF4444]',
            icon: X,
          },
        ].map(({ label, value, circle, border, icon: Icon }) => (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-xl border-l-4 bg-surface p-4 shadow-card ${border}`}
          >
            <span
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${circle}`}
            >
              <Icon size={22} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-textSecondary">{label}</p>
              <p className="text-2xl font-bold text-textPrimary">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={handleAdd} noValidate className="mb-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-4 text-lg font-semibold">Add a job to your tracker</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-textSecondary">Company *</span>
              <input
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-textPrimary outline-none focus:border-primary"
                placeholder="Acme Corp"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-textSecondary">Role *</span>
              <input
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-textPrimary outline-none focus:border-primary"
                placeholder="Senior Backend Engineer"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-textSecondary">Job URL</span>
              <input
                type="url"
                value={form.job_url}
                onChange={(e) => setForm((f) => ({ ...f, job_url: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-textPrimary outline-none focus:border-primary"
                placeholder="https://..."
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-textSecondary">Match score (0–100)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={form.match_score}
                onChange={(e) => setForm((f) => ({ ...f, match_score: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-textPrimary outline-none focus:border-primary"
                placeholder="e.g. 82"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-textSecondary">Applied date</span>
              <input
                type="date"
                value={form.applied_date}
                onChange={(e) => setForm((f) => ({ ...f, applied_date: e.target.value }))}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-textPrimary outline-none focus:border-primary"
              />
            </label>
            <div className="sm:col-span-2">
              <label className="block">
                <span className="mb-1 block text-sm text-textSecondary">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm text-textPrimary outline-none focus:border-primary"
                  rows={2}
                  placeholder="Referral, recruiter contact, salary info..."
                />
              </label>
            </div>
          </div>

          {formError ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={isAdding}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
            >
              {isAdding && <Loader2 size={14} className="animate-spin" />}
              {isAdding ? 'Saving...' : 'Save Application'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-line bg-surface p-5 text-textSecondary shadow-card">
          Could not load your applications: {error.message}
        </div>
      ) : null}

      {!isLoading && applications && applications.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <Briefcase className="mx-auto mb-3 text-textMuted" size={32} />
          <p className="text-textSecondary">No applications tracked yet.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-hover"
          >
            <Plus size={14} /> Add your first application
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_ORDER.map((s) => (
            <div key={s} className="h-40 w-72 flex-shrink-0 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      ) : applications && applications.length > 0 ? (
        <>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STATUS_ORDER.map((status) => (
              <section key={status} className="flex w-80 flex-shrink-0 flex-col rounded-xl bg-elevated p-2">
                <header className="mb-2 flex items-center justify-between px-2 pt-1">
                  <h3 className="text-sm font-semibold text-textPrimary">
                    {STATUS_LABELS[status]}
                    <span className="ml-2 text-sm font-normal text-textSecondary">({grouped[status].length})</span>
                  </h3>
                  <button
                    type="button"
                    className="text-textSecondary transition-colors hover:text-primary"
                    aria-label={`${STATUS_LABELS[status]} column options`}
                  >
                    <MoreHorizontal size={20} aria-hidden="true" />
                  </button>
                </header>
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {grouped[status].map((app) => (
                    <ApplicationCard
                      key={app.application_id}
                      app={app}
                      onChangeStatus={(id, next) => void changeStatus({ id, status: next }).catch(() => {})}
                      onDelete={handleDelete}
                      onSaveNotes={(id, notes) => void editApplication({ id, notes }).catch(() => {})}
                    />
                  ))}
                  {grouped[status].length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-textMuted">No applications</p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
