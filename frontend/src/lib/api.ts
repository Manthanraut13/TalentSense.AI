import axios from 'axios';

import type { AnalysisResult, HistoryListResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 second timeout for frontend requests
});

export async function analyzeResume(params: {
  sessionId: string;
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
    headers: { 'X-Session-ID': params.sessionId },
    timeout: 30000, // Override timeout for this specific request
  });
  return response.data;
}

export async function fetchHistory(sessionId: string) {
  const response = await api.get<HistoryListResponse>('/history', {
    headers: { 'X-Session-ID': sessionId },
  });
  return response.data;
}

export async function fetchAnalysis(sessionId: string, analysisId: string) {
  const response = await api.get<AnalysisResult>(`/history/${analysisId}`, {
    headers: { 'X-Session-ID': sessionId },
  });
  return response.data;
}

export async function deleteAnalysis(sessionId: string, analysisId: string) {
  const response = await api.delete(`/history/${analysisId}`, {
    headers: { 'X-Session-ID': sessionId },
  });
  return response.data;
}
