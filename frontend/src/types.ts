export type Scores = {
  overall: number;
  skills_match: number;
  experience_relevance: number;
  keyword_coverage: number;
};

export type AnalysisResult = {
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

export type HistoryListResponse = {
  analyses: Array<Pick<AnalysisResult, 'analysis_id' | 'job_title' | 'timestamp' | 'scores'>>;
  total: number;
};
