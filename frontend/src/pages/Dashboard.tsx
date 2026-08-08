import { useDashboard } from '../hooks/useDashboard';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  CalendarDays,
  ChevronDown,
  PieChart,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

function StatCard({
  icon: Icon,
  tileClass,
  blobClass,
  label,
  value,
  sub,
}: {
  icon: typeof BarChart3;
  tileClass: string;
  blobClass: string;
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-card transition-shadow hover:shadow-cardHover">
      <div
        className={`absolute -right-4 -top-4 h-24 w-24 rounded-full blur-xl transition-colors ${blobClass}`}
        aria-hidden="true"
      />
      <div className="mb-4 flex items-start justify-between">
        <span className={`flex items-center justify-center rounded-lg p-2 ${tileClass}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-textSecondary">{label}</h3>
      <p className="text-3xl font-bold text-textPrimary">{value}</p>
      {sub ? <p className="mt-1 text-xs text-textMuted">{sub}</p> : null}
    </div>
  );
}

function dimensionHint(value: number) {
  if (value >= 80) return 'Strong alignment with role expectations.';
  if (value >= 60) return 'Solid foundation with room to improve.';
  return 'Focus area — check the learning roadmap.';
}

export default function Dashboard() {
  const { data: stats, isLoading, error } = useDashboard();

  if (error) {
    console.error('[Dashboard] Failed to load stats', error);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-textSecondary">Loading your stats...</div>
      </div>
    );
  }

  if (!stats || stats.total_analyses === 0) {
    console.debug('[Dashboard] No stats data available');
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center space-y-3">
          <TrendingUp size={48} className="text-textMuted mx-auto" />
          <h2 className="text-xl font-semibold text-textPrimary">No data yet</h2>
          <p className="text-textSecondary">Run your first analysis to see your dashboard</p>
        </div>
      </div>
    );
  }

  const trendData = stats.score_trend.map((item) => ({
    date: format(new Date(item.date), 'MMM d'),
    score: item.score,
    job: item.job_title,
  }));

  const topSkill = stats.top_missing_skills[0];

  const dimensions = [
    {
      label: 'Experience',
      value: stats.avg_experience,
      dot: 'bg-primary',
      bar: 'bg-primary',
      valueClass: 'text-primary',
      hint: dimensionHint(stats.avg_experience),
    },
    {
      label: 'Skills',
      value: stats.avg_skills,
      dot: 'bg-tertiary',
      bar: 'bg-tertiary',
      valueClass: 'text-tertiary',
      hint: dimensionHint(stats.avg_skills),
    },
    {
      label: 'Keywords',
      value: stats.avg_keywords,
      dot: 'bg-secondary',
      bar: 'bg-secondary',
      valueClass: 'text-secondary',
      hint: dimensionHint(stats.avg_keywords),
    },
  ];

  const barStyles = [
    { on: 'bg-error', off: 'bg-error/30' },
    { on: 'bg-tertiary', off: 'bg-tertiary/30' },
    { on: 'bg-secondary', off: 'bg-secondary/30' },
  ];

  return (
    <div className="min-h-screen bg-base px-6 py-8">
      <div className="mx-auto max-w-[1280px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 px-2 pt-2">
          <div>
            <h1 className="text-2xl font-bold text-textPrimary">Dashboard</h1>
            <p className="mt-1 text-sm text-textSecondary">
              Here&apos;s an overview of your resume analysis performance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-containerHigh px-4 py-2 text-sm font-medium text-textPrimary transition-colors hover:bg-containerHighest"
            >
              <CalendarDays size={18} aria-hidden="true" />
              All Time
              <ChevronDown size={18} aria-hidden="true" />
            </button>
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-hover"
            >
              <Upload size={18} aria-hidden="true" />
              New Analysis
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={BarChart3}
            tileClass="bg-primary text-white"
            blobClass="group-hover:bg-primary/10 bg-primary/5"
            label="Total Analyses"
            value={stats.total_analyses}
          />
          <StatCard
            icon={PieChart}
            tileClass="bg-[#d97b51] text-white"
            blobClass="group-hover:bg-[#d97b51]/20 bg-[#d97b51]/10"
            label="Avg Match Score"
            value={<span>{stats.avg_overall}%</span>}
          />
          <StatCard
            icon={AlertTriangle}
            tileClass="bg-[#ffdad6] text-[#93000a]"
            blobClass="group-hover:bg-[#ba1a1a]/20 bg-[#ba1a1a]/10"
            label="Top Skill Gap"
            value={<span className="block truncate text-xl">{topSkill?.skill ?? '—'}</span>}
            sub={topSkill ? `Missing in ${Math.round((topSkill.count / stats.total_analyses) * 100)}% of roles` : undefined}
          />
          <StatCard
            icon={Award}
            tileClass="bg-[#fd761a] text-white"
            blobClass="group-hover:bg-[#fd761a]/20 bg-[#fd761a]/10"
            label="Best Score"
            value={<span>{stats.best_score}%</span>}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-card lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-textPrimary">Match Score Trend</h2>
                <p className="text-sm text-textSecondary">Your average match score over time.</p>
              </div>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0EA5A0" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#0EA5A0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#BCC9C8" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#6D7A78', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 20, 40, 60, 80, 100]}
                    tick={{ fill: '#6D7A78', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#FFFFFF',
                      border: '1px solid #BCC9C8',
                      borderRadius: 12,
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                    }}
                    labelStyle={{ color: '#171D1C' }}
                    itemStyle={{ color: '#0EA5A0' }}
                    formatter={(val: any) => [`${val}%`, 'Match Score']}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#0EA5A0"
                    strokeWidth={2}
                    fill="url(#trendGradient)"
                    dot={{ fill: '#0EA5A0', stroke: '#FFFFFF', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex flex-col rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-textPrimary">Dimension Averages</h2>
              <p className="text-sm text-textSecondary">Performance across core evaluation areas.</p>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-6">
              {dimensions.map(({ label, value, dot, bar, valueClass, hint }) => (
                <div key={label} className="group cursor-pointer">
                  <div className="mb-2 flex items-end justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
                      <span className="text-sm font-semibold text-textPrimary">{label}</span>
                    </div>
                    <span className={`text-sm font-medium ${valueClass}`}>{value}%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-containerHigh">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${bar}`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  <p className="mt-1 max-h-0 overflow-hidden text-xs text-textSecondary opacity-0 transition-all group-hover:max-h-8 group-hover:opacity-100">
                    {hint}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-textPrimary">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-error/10 text-error">
                  <Target size={14} aria-hidden="true" />
                </span>
                Skills You Keep Missing
              </h2>
              <span className="rounded bg-containerHigh px-2 py-1 text-xs font-medium text-textSecondary">
                Top 5 by Frequency
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {stats.top_missing_skills.slice(0, 5).map(({ skill, count }, i) => {
                const ratio = stats.total_analyses > 0 ? count / stats.total_analyses : 0;
                const filled = Math.max(1, Math.round(ratio * 5));
                const style = barStyles[i % barStyles.length];
                const tileClass =
                  i === 0
                    ? 'bg-[#ffdad6] text-[#93000a]'
                    : 'bg-containerHighest text-textSecondary';
                return (
                  <div
                    key={skill}
                    className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-containerLow"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-sm font-bold ${tileClass}`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-textPrimary">{skill}</p>
                        <p className="text-xs text-textSecondary">
                          Missing in {count} of {stats.total_analyses} analyses
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <span
                          key={j}
                          className={`h-6 w-1.5 rounded-full ${j < filled ? style.on : style.off}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden rounded-xl border border-line bg-surface p-5 text-center shadow-card">
            <div
              className="pointer-events-none absolute inset-0 opacity-10"
              style={{
                backgroundImage: 'radial-gradient(#0EA5A0 1px, transparent 1px)',
                backgroundSize: '18px 18px',
              }}
              aria-hidden="true"
            />
            <div className="relative z-10 mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-white shadow-md">
              <Sparkles size={32} aria-hidden="true" />
            </div>
            <h3 className="relative z-10 mb-2 text-lg font-semibold text-textPrimary">
              AI Career Coach Insight
            </h3>
            <p className="relative z-10 mb-6 max-w-md text-sm text-textSecondary">
              Based on your recent analyses, focusing on{' '}
              <strong className="text-textPrimary">{topSkill?.skill ?? 'your top skill gap'}</strong>{' '}
              could significantly improve your match score.
            </p>
            <Link
              to="/coach"
              className="relative z-10 flex items-center gap-1.5 rounded-lg border border-primary/20 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
            >
              View Learning Path
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
