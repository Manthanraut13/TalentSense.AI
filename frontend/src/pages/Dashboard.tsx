import { useDashboard } from '../hooks/useDashboard';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Target, AlertCircle, Award } from 'lucide-react';
import { format } from 'date-fns';

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-6">
      <div className="flex items-center gap-2 text-textSecondary text-sm mb-3">
        <Icon size={14} />
        {label}
      </div>
      <div className="text-3xl font-bold text-textPrimary">{value}</div>
      {sub && <div className="text-xs text-textMuted mt-1">{sub}</div>}
    </div>
  );
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

    return (
      <div className="min-h-screen bg-base p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <h1 className="text-2xl font-bold text-textPrimary">Your Progress Dashboard</h1>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Target} label="Total Analyses" value={stats.total_analyses} />
          <StatCard icon={TrendingUp} label="Avg Match Score" value={`${stats.avg_overall}%`} sub="across all analyses" />
          <StatCard icon={Award} label="Best Score" value={`${stats.best_score}%`} />
          <StatCard icon={AlertCircle} label="Lowest Score" value={`${stats.worst_score}%`} />
        </div>

        {/* Score Trend Chart */}
        <div className="bg-surface border border-line rounded-xl p-6">
          <h2 className="text-base font-semibold text-textPrimary mb-6">Match Score Over Time</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2E2E2E" />
              <XAxis dataKey="date" tick={{ fill: '#A3A3A3', fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#A3A3A3', fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 8 }}
                labelStyle={{ color: '#F5F5F5' }}
                itemStyle={{ color: '#10B981' }}
                formatter={(val: any, _: any, props: any) => [`${val}%`, props.payload.job]}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Score Breakdown Averages */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Skills Match', value: stats.avg_skills },
            { label: 'Experience', value: stats.avg_experience },
            { label: 'Keywords', value: stats.avg_keywords },
          ].map(({ label, value }) => (
            <div key={label} className="bg-surface border border-line rounded-xl p-6">
              <div className="text-sm text-textSecondary mb-2">{label} (avg)</div>
              <div className="text-2xl font-bold text-textPrimary">{value}%</div>
              <div className="mt-3 h-2 bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Most Common Missing Skills */}
        <div className="bg-surface border border-line rounded-xl p-6">
          <h2 className="text-base font-semibold text-textPrimary mb-4">
            Skills You Keep Missing
          </h2>
          <div className="space-y-3">
            {stats.top_missing_skills.map(({ skill, count }) => (
              <div key={skill} className="flex items-center gap-3">
                <span className="font-mono text-sm text-textPrimary w-36 shrink-0">{skill}</span>
                <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${(count / stats.total_analyses) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-textSecondary w-24 text-right">
                  {count}/{stats.total_analyses} analyses
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
