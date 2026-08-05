import { useEffect, useState } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import axios from "axios"

const API_BASE = process.env.PLASMO_PUBLIC_API_BASE || "http://localhost:8000"
const FULL_RESULTS_URL = (process.env.PLASMO_PUBLIC_APP_URL || "http://localhost:5173") + "/results/"

type PendingAnalysis = {
  jdText: string
  jobTitle: string
  sourceUrl: string
}

type SavedResume = {
  resume_id: string
  name: string
  created_at: string
}

type AnalysisResult = {
  analysis_id: string
  job_title: string
  scores: { overall: number }
  missing_skills: string[]
  ats_keywords: string[]
  strengths: string[]
  improvement_tips: string[]
}

const scoreColor = (score: number) => (score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444")

function extractErrorMessage(caught: unknown): string {
  if (axios.isAxiosError(caught)) {
    const detail = (caught.response?.data as { detail?: unknown })?.detail
    if (typeof detail === "object" && detail !== null && "message" in (detail as object)) {
      return (detail as { message: string }).message
    }
    if (typeof detail === "string") return detail
    return caught.message
  }
  return "Something went wrong. Please try again."
}

export default function SidePanel() {
  const [jdText, setJdText] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState("")
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingResumes, setLoadingResumes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useStorage<string>("clerk_token", "")

  const loadPendingAnalysis = async () => {
    const pending = await chrome.storage.session.get("pendingAnalysis")
    const analysis = pending?.pendingAnalysis as PendingAnalysis | undefined
    if (analysis) {
      setJdText(analysis.jdText || "")
      setJobTitle(analysis.jobTitle || "")
      setSourceUrl(analysis.sourceUrl || "")
    }
  }

  useEffect(() => {
    loadPendingAnalysis()
    chrome.storage.session.onChanged.addListener((changes) => {
      if (changes.pendingAnalysis) {
        const analysis = changes.pendingAnalysis.newValue as PendingAnalysis | undefined
        if (analysis) {
          setJdText(analysis.jdText || "")
          setJobTitle(analysis.jobTitle || "")
          setSourceUrl(analysis.sourceUrl || "")
        }
      }
    })
  }, [])

  useEffect(() => {
    if (!token) {
      setSavedResumes([])
      return
    }
    setLoadingResumes(true)
    axios
      .get<SavedResume[]>(`${API_BASE}/api/v1/resumes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setSavedResumes(res.data))
      .catch((e) => setError(extractErrorMessage(e)))
      .finally(() => setLoadingResumes(false))
  }, [token])

  const handleAnalyze = async () => {
    if (!token || !selectedResumeId || !jdText) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const resume = await axios.get<{ content: string }>(`${API_BASE}/api/v1/resumes/${selectedResumeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const formData = new FormData()
      formData.append("job_description", jdText)
      formData.append("input_mode", "text")
      formData.append("resume_text", resume.data.content)

      const { data } = await axios.post<AnalysisResult>(`${API_BASE}/api/v1/analyze`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setResult(data)
    } catch (e) {
      setError(extractErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div style={{ padding: 24, fontFamily: "Inter, sans-serif", background: "#0F0F0F", minHeight: "100vh", color: "#F5F5F5" }}>
        <h2 style={{ color: "#10B981", marginBottom: 12 }}>Resume Analyzer</h2>
        <p style={{ color: "#A3A3A3", fontSize: 14, marginBottom: 12 }}>
          Sign in on the web app first, then paste your Clerk token below (or set it in chrome.storage as <code>clerk_token</code>).
        </p>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your Clerk session token..."
          style={{
            width: "100%",
            background: "#242424",
            border: "1px solid #2E2E2E",
            color: "#F5F5F5",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            boxSizing: "border-box",
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: 20, fontFamily: "Inter, sans-serif", background: "#0F0F0F", minHeight: "100vh", color: "#F5F5F5" }}>
      <h2 style={{ color: "#10B981", fontSize: 16, marginBottom: 16 }}>⚡ Resume Analyzer</h2>

      {jobTitle ? (
        <div style={{ fontSize: 13, color: "#A3A3A3", marginBottom: 4 }}>
          Job: <strong style={{ color: "#F5F5F5" }}>{jobTitle}</strong>
        </div>
      ) : null}
      {sourceUrl ? (
        <div style={{ fontSize: 12, color: "#525252", marginBottom: 12, wordBreak: "break-all" }}>{sourceUrl}</div>
      ) : null}

      {jdText ? (
        <div
          style={{
            fontSize: 12,
            color: "#A3A3A3",
            background: "#1A1A1A",
            border: "1px solid #2E2E2E",
            borderRadius: 8,
            padding: "8px 12px",
            maxHeight: 96,
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          {jdText.length > 220 ? `${jdText.slice(0, 220)}…` : jdText}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "#A3A3A3", marginBottom: 12 }}>
          Open a LinkedIn, Indeed, or Naukri job page and click the ⚡ Analyze Match button.
        </p>
      )}

      <select
        value={selectedResumeId}
        onChange={(e) => setSelectedResumeId(e.target.value)}
        disabled={loadingResumes}
        style={{
          width: "100%",
          background: "#242424",
          border: "1px solid #2E2E2E",
          color: "#F5F5F5",
          padding: "8px 12px",
          borderRadius: 8,
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        <option value="">
          {loadingResumes ? "Loading resumes..." : savedResumes.length ? "Select your resume..." : "No saved resumes found"}
        </option>
        {savedResumes.map((r) => (
          <option key={r.resume_id} value={r.resume_id}>
            {r.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleAnalyze}
        disabled={loading || !selectedResumeId || !jdText}
        style={{
          width: "100%",
          background: loading ? "#059669" : "#10B981",
          color: "white",
          border: "none",
          padding: "10px 0",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          marginBottom: 16,
          opacity: !selectedResumeId || !jdText ? 0.5 : 1,
        }}
      >
        {loading ? "Analyzing..." : "Analyze Match"}
      </button>

      {error ? (
        <div
          style={{
            background: "#EF444420",
            color: "#f87171",
            border: "1px solid #EF444430",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            marginBottom: 16,
          }}
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {result ? (
        <div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: scoreColor(result.scores.overall),
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {result.scores.overall}%
          </div>
          <div style={{ fontSize: 13, color: "#A3A3A3", textAlign: "center", marginBottom: 16 }}>Overall Match</div>

          <div style={{ fontSize: 12, color: "#A3A3A3", marginBottom: 6 }}>Missing Skills:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
            {result.missing_skills.slice(0, 6).map((s) => (
              <span
                key={s}
                style={{
                  background: "#EF444420",
                  color: "#f87171",
                  border: "1px solid #EF444430",
                  borderRadius: 20,
                  padding: "2px 8px",
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              >
                {s}
              </span>
            ))}
          </div>

          <a
            href={`${FULL_RESULTS_URL}${result.analysis_id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "block", marginTop: 16, textAlign: "center", color: "#10B981", fontSize: 13 }}
          >
            View full analysis →
          </a>
        </div>
      ) : null}
    </div>
  )
}
