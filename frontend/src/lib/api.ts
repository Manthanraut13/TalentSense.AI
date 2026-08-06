import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import type { AnalysisResult, Application, ApplicationStatus, BillingStatus, CheckoutSessionResponse, CoachResponse, CompareResponse, CreateApplicationInput, DashboardStats, HistoryListResponse, LearningPlanResponse, PublicShareAnalysis, ShareResponse, UsageStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

const V1 = '/api/v1';

function logRequest(method: string | undefined, url: string | undefined, payload?: unknown) {
  console.debug(`[API] → ${method?.toUpperCase()} ${url}`, payload ? payload : '');
}

function logResponse(method: string | undefined, url: string | undefined, status: number | undefined, data?: unknown) {
  if (status && status >= 400) {
    console.warn(`[API] ← ${method?.toUpperCase()} ${url} ${status}`, data || '');
  } else {
    console.debug(`[API] ← ${method?.toUpperCase()} ${url} ${status}`);
  }
}

function logError(method: string | undefined, url: string | undefined, error: unknown) {
  console.error(`[API] ✗ ${method?.toUpperCase()} ${url}`, error);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000,
});

// Token getter set by App component
let getTokenFn: (() => Promise<string | null>) | null = null;
export function setTokenGetter(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

// One‑time async lock for the token fetch – prevents race
let tokenLock: Promise<string | null> | null = null;
async function getCurrentToken(): Promise<string | null> {
  if (!getTokenFn) return null;
  if (!tokenLock) tokenLock = getTokenFn();
  const token = await tokenLock;
  tokenLock = null;
  return token;
}

// Request interceptor – ensure token is present for every call
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getCurrentToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  logRequest(config.method, config.url, config.data);
  return config;
});

// Response interceptor – retry once on 401 with fresh token
let isRefreshing = false;
api.interceptors.response.use(
  (res) => {
    logResponse(res.config.method, res.config.url, res.status, res.data);
    return res;
  },
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    logError(original?.method, original?.url, error.response?.status || error.message);

    if (error.response?.status === 401 && !original._retry && getTokenFn && !isRefreshing) {
      original._retry = true;
      isRefreshing = true;
      try {
        const fresh = await getCurrentToken();
        if (fresh) {
          original.headers.set('Authorization', `Bearer ${fresh}`);
          console.debug('[API] Retrying after token refresh');
          return api(original);
        }
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export async function analyzeResume(params: {
  inputMode: 'text' | 'pdf';
  resumeText?: string;
  resumeFile?: File;
  jobDescription: string;
}) {
  const form = new FormData();
  form.append('input_mode', params.inputMode);
  form.append('job_description', params.jobDescription);

  if (params.inputMode === 'text' && params.resumeText) {
    form.append('resume_text', params.resumeText);
  }

  if (params.inputMode === 'pdf' && params.resumeFile) {
    form.append('resume_file', params.resumeFile);
  }

  const response = await api.post<AnalysisResult>(`${V1}/analyze`, form, {
    timeout: 180000,
  });
  return response.data;
}

export async function fetchHistory() {
  const response = await api.get<HistoryListResponse>(`${V1}/history`);
  return response.data;
}

export async function fetchAnalysis(analysisId: string) {
  const response = await api.get<AnalysisResult>(`${V1}/history/${analysisId}`);
  return response.data;
}

export async function deleteAnalysis(analysisId: string) {
  const response = await api.delete(`${V1}/history/${analysisId}`);
  return response.data;
}

export async function fetchUsage() {
  const response = await api.get<UsageStatus>(`${V1}/usage`);
  return response.data;
}

export async function fetchBillingStatus() {
  const response = await api.get<BillingStatus>(`${V1}/billing/status`);
  return response.data;
}

export async function createCheckoutSession(params: {
  email?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const response = await api.post<CheckoutSessionResponse>(
    `${V1}/billing/create-checkout-session`,
    {
      email: params.email,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }
  );
  return response.data;
}

export async function fetchDashboardStats() {
  const response = await api.get<DashboardStats>(`${V1}/history/dashboard/stats`);
  return response.data;
}

export async function compareJobs(params: {
  resumeText: string;
  jobDescriptions: string[];
}) {
  const response = await api.post<CompareResponse>(`${V1}/compare`, {
    resume_text: params.resumeText,
    job_descriptions: params.jobDescriptions,
  });
  return response.data;
}

export async function fetchLearningPlan(params: {
  skills: string[];
  jobContext?: string;
}) {
  const response = await api.post<LearningPlanResponse>(`${V1}/learning-plan`, {
    skills: params.skills,
    job_context: params.jobContext ?? '',
  });
  return response.data;
}

export async function sendCoachMessage(params: {
  message: string;
  conversationId?: string | null;
}) {
  const response = await api.post<CoachResponse>(`${V1}/coach/chat`, {
    message: params.message,
    conversation_id: params.conversationId ?? null,
  });
  return response.data;
}

export async function enableSharing(analysisId: string) {
  const response = await api.post<ShareResponse>(`${V1}/analyses/${analysisId}/share`);
  return response.data;
}

export async function disableSharing(analysisId: string) {
  const response = await api.delete(`${V1}/analyses/${analysisId}/share`);
  return response.data;
}

export async function fetchPublicAnalysis(slug: string) {
  const response = await api.get<PublicShareAnalysis>(`${V1}/share/${slug}`);
  return response.data;
}

export async function fetchApplications() {
  const response = await api.get<Application[]>(`${V1}/applications`);
  return response.data;
}

export async function createApplication(params: CreateApplicationInput) {
  const response = await api.post<Application>(`${V1}/applications`, params);
  return response.data;
}

export async function updateApplicationStatus(
  applicationId: string,
  params: { status: ApplicationStatus; notes?: string },
) {
  const response = await api.patch<Application>(
    `${V1}/applications/${applicationId}/status`,
    params,
  );
  return response.data;
}

export async function updateApplication(
  applicationId: string,
  params: {
    company?: string;
    role?: string;
    job_url?: string;
    notes?: string;
    applied_date?: string;
  },
) {
  const response = await api.patch<Application>(
    `${V1}/applications/${applicationId}`,
    params,
  );
  return response.data;
}

export async function deleteApplication(applicationId: string) {
  const response = await api.delete(`${V1}/applications/${applicationId}`);
  return response.data;
}
