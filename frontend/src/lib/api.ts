import axios from 'axios';

import type { AnalysisResult, BillingStatus, CheckoutSessionResponse, HistoryListResponse, UsageStatus } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutes for slow AI analysis
});

// This function will be set by the App component
let getTokenFn: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

api.interceptors.request.use(async (config) => {
  if (getTokenFn) {
    const token = await getTokenFn();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

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
  const response = await api.post<CheckoutSessionResponse>('/api/billing/create-checkout-session', {
    email: params.email,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
  return response.data;
}
