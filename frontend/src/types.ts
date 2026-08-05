// Type definitions needed for Phase 6 components
type Scores = {
  overall: number;
  skills_match: number;
  experience_relevance: number;
  keyword_coverage: number;
};

type HistoryItem = {
  analysis_id: string;
  job_title: string;
  timestamp: string;
  scores: Scores;
};

type HistoryListResponse = {
  analyses: HistoryItem[];
  total: number;
};

type AnalysisResult = {
  analysis_id: string;
  job_title: string;
  timestamp: string;
  scores: Scores;
  missing_skills: string[];
  ats_keywords: string[];
  strengths: string[];
  improvement_tips: string[];
  context_note?: string | null;
  ats_score?: number | null;
  ats_keyword_hits?: string[];
  ats_keyword_misses?: string[];
  ats_checks?: ATSCheck[];
  ats_checks_passed?: number;
  ats_checks_total?: number;
};

type ATSCheck = {
  check: string;
  passed: boolean;
  detail: string;
  weight: number;
};

type CompareResult = {
  job_title: string;
  scores: Scores;
  missing_skills: string[];
  key_strengths: string[];
  biggest_gap: string;
  fit_summary: string;
  error?: string;
};

type CompareRecommendation = {
  recommended_index: number;
  recommended_title: string;
  reasoning: string;
  avoid_index: number;
  avoid_reason: string;
};

type CompareResponse = {
  results: CompareResult[];
  recommendation: CompareRecommendation;
  total_compared: number;
};

type LearningResource = {
  title: string;
  url: string;
  snippet: string;
  type: 'video' | 'docs' | 'course' | 'article';
};

type SkillPlan = {
  skill: string;
  priority: 'high' | 'medium' | 'low';
  why_needed: string;
  estimated_weeks: number;
  learning_path: string[];
  resources: LearningResource[];
  error?: string;
};

type LearningPlanResponse = {
  plans: SkillPlan[];
  total: number;
};

type UsageStatus = {
  used: number;
  limit: number;
  remaining: number;
  is_pro: boolean;
  reset_at?: string | null;
};

type BillingStatus = {
  plan: 'free' | 'pro';
  is_pro: boolean;
};

type CheckoutSessionResponse = {
  checkout_url: string;
};

type DashboardStats = {
  total_analyses: number;
  avg_overall: number;
  avg_skills: number;
  avg_experience: number;
  avg_keywords: number;
  best_score: number;
  worst_score: number;
  score_trend: { date: string; score: number; job_title: string }[];
  top_missing_skills: { skill: string; count: number }[];
};

type CoachResponse = {
  response: string;
  conversation_id: string;
};

export type {
  Scores,
  AnalysisResult,
  ATSCheck,
  CompareResult,
  CompareRecommendation,
  CompareResponse,
  LearningResource,
  SkillPlan,
  LearningPlanResponse,
  HistoryItem,
  HistoryListResponse,
  UsageStatus,
  BillingStatus,
  CheckoutSessionResponse,
  DashboardStats,
  CoachResponse,
};
