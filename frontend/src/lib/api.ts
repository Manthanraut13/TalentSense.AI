import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import type { AnalysisResult, BillingStatus, CheckoutSessionResponse, DashboardStats, HistoryListResponse, UsageStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
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
  return config;
});

// Response interceptor – retry once on 401 with fresh token
let isRefreshing = false;
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry && getTokenFn && !isRefreshing) {
      original._retry = true;
      isRefreshing = true;
      try {
        const fresh = await getCurrentToken();
        if (fresh) {
          original.headers.set('Authorization', `Bearer ${fresh}`);
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

  const response = await api.post<AnalysisResult>('/analyze', form, {
    timeout: 180000,
  });
  return response.data;
}

export async function fetchHistory() {
  const response = await api.get<HistoryListResponse>('/history');
  return response.data;
}

export async function fetchAnalysis(analysisId: string) {
  const response = await api.get<AnalysisResult>(`/history/${analysisId}`);
  return response.data;
}

export async function deleteAnalysis(analysisId: string) {
  const response = await api.delete(`/history/${analysisId}`);
  return response.data;
}

export async function fetchUsage() {
  const response = await api.get<UsageStatus>('/usage');
  return response.data;
}

export async function fetchBillingStatus() {
  const response = await api.get<BillingStatus>('/api/billing/status');
  return response.data;
}

export async function createCheckoutSession(params: {
  email?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const response = await api.post<CheckoutSessionResponse>(
    '/api/billing/create-checkout-session',
    {
      email: params.email,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }
  );
  return response.data;
}

export async function fetchDashboardStats() {
  const response = await api.get<DashboardStats>('/history/dashboard/stats');
  return response.data;
}
