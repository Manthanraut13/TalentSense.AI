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

export type {
  Scores,
  AnalysisResult,
  HistoryItem,
  HistoryListResponse,
  UsageStatus,
  BillingStatus,
  CheckoutSessionResponse,
};
