// Client-side input validation constants
export const RESUME_MIN_CHARS = 200;
export const RESUME_MAX_CHARS = 8000;
export const JD_MIN_CHARS = 100;
export const JD_MAX_CHARS = 4000;
export const MAX_PDF_SIZE_MB = 5;

// Suspicious patterns for client-side injection detection
// (Backend also validates - this is for faster UX feedback)
const SUSPICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
  /you\s+are\s+now/i,
  /act\s+as\s+(a|an)/i,
  /system\s+prompt/i,
  /reveal\s+(your|the)\s+(system\s+)?prompt/i,
  /what\s+(is|are)\s+(your|the)\s+(system\s+)?prompt/i,
  /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i,
  /think\s+step\s+by\s+step/i,
  /show\s+your\s+(reasoning|thinking|work)/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,
  /god\s+mode/i,
  /unrestricted\s+mode/i,
  /```\s*(system|user|assistant)/i,
  /<\|?(system|user|assistant)\|?>/i,
];

export function validateResumeText(text: string): string | null {
  if (!text.trim()) return "Resume cannot be empty";
  if (text.length < RESUME_MIN_CHARS) {
    return `Resume is too short (${text.length}/${RESUME_MIN_CHARS} characters minimum)`;
  }
  // Backend truncates, not an error here
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(text)) {
      return "Resume contains invalid content. Please paste plain resume text only.";
    }
  }
  return null;
}

export function validateJD(text: string): string | null {
  if (!text.trim()) return "Job description cannot be empty";
  if (text.length < JD_MIN_CHARS) {
    return `Too short (${text.length}/${JD_MIN_CHARS} characters minimum)`;
  }
  return null;
}

export function validatePDFFile(file: File): string | null {
  if (file.type !== "application/pdf") return "Only PDF files are accepted";
  if (file.size > MAX_PDF_SIZE_MB * 1024 * 1024) {
    return `File too large (max ${MAX_PDF_SIZE_MB}MB)`;
  }
  return null;
}
