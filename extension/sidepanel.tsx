import { useEffect, useRef, useState } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import axios from "axios"

const API_BASE = (process.env.PLASMO_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/+$/, "")
const FULL_RESULTS_URL = (process.env.PLASMO_PUBLIC_APP_URL || "http://localhost:5173").replace(/\/+$/, "") + "/results/"

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

type JdStatus = "idle" | "fetching" | "loaded" | "empty"
type AnalysisPhase = "idle" | "fetching_resume" | "sending" | "analyzing" | "done"

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

function isAuthError(caught: unknown): boolean {
  return axios.isAxiosError(caught) && caught.response?.status === 401
}

const phaseLabel: Record<AnalysisPhase, string> = {
  idle: "",
  fetching_resume: "Fetching your resume...",
  sending: "Sending to the analyzer...",
  analyzing: "AI is analyzing the job vs your resume...",
  done: "Analysis complete!",
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
  const [jdStatus, setJdStatus] = useState<JdStatus>("idle")
  const [showManualPaste, setShowManualPaste] = useState(false)
  const [manualJd, setManualJd] = useState("")
  const [phase, setPhase] = useState<AnalysisPhase>("idle")
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef<number | null>(null)

  const loadPendingAnalysis = async () => {
    const pending = await chrome.storage.session.get("pendingAnalysis")
    const analysis = pending?.pendingAnalysis as PendingAnalysis | undefined
    if (analysis) {
      setJdText(analysis.jdText || "")
      setJobTitle(analysis.jobTitle || "")
      setSourceUrl(analysis.sourceUrl || "")
      setJdStatus(analysis.jdText ? "loaded" : "empty")
    }
  }

  const fetchJdFromPage = async () => {
    setJdStatus("fetching")
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) throw new Error("no active tab")
      const resp = (await chrome.tabs.sendMessage(tab.id, { type: "FETCH_JD" })) as PendingAnalysis | undefined
      if (resp?.jdText) {
        setJdText(resp.jdText)
        setJobTitle(resp.jobTitle || "")
        setSourceUrl(resp.sourceUrl || tab.url || "")
        setJdStatus("loaded")
        return
      }
      setJdStatus("empty")
    } catch (e) {
      console.error("[sidepanel] fetchJdFromPage failed", e)
      setJdStatus("empty")
    }
  }

  useEffect(() => {
    loadPendingAnalysis()
    if (!token) return
    chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        if (!tab?.id) return
        return chrome.tabs.sendMessage(tab.id, { type: "FETCH_JD" })
      })
      .then((resp) => {
        const r = resp as PendingAnalysis | undefined
        if (r?.jdText) {
          setJdText(r.jdText)
          setJobTitle(r.jobTitle || "")
          setSourceUrl(r.sourceUrl || "")
          setJdStatus("loaded")
        } else {
          setJdStatus((s) => (s === "idle" ? "empty" : s))
        }
      })
      .catch(() => setJdStatus((s) => (s === "idle" ? "empty" : s)))

    chrome.storage.session.onChanged.addListener((changes) => {
      if (changes.pendingAnalysis) {
        const analysis = changes.pendingAnalysis.newValue as PendingAnalysis | undefined
        if (analysis) {
          setJdText(analysis.jdText || "")
          setJobTitle(analysis.jobTitle || "")
          setSourceUrl(analysis.sourceUrl || "")
          setJdStatus(analysis.jdText ? "loaded" : "empty")
        }
      }
    })
  }, [token])

  useEffect(() => {
    if (phase !== "analyzing") return
    setElapsed(0)
    elapsedRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => {
      if (elapsedRef.current !== null) {
        clearInterval(elapsedRef.current)
        elapsedRef.current = null
      }
    }
  }, [phase])

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
      .catch((e) => {
        if (isAuthError(e)) {
          setToken("")
          setSavedResumes([])
          return
        }
        setError(extractErrorMessage(e))
      })
      .finally(() => setLoadingResumes(false))
  }, [token])

  const handleAnalyze = async () => {
    if (!token || !selectedResumeId || !jdText) return
    setLoading(true)
    setError(null)
    setResult(null)
    setPhase("fetching_resume")
    try {
      const resume = await axios.get<{ content: string }>(`${API_BASE}/api/v1/resumes/${selectedResumeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      const formData = new FormData()
      formData.append("job_description", jdText)
      formData.append("input_mode", "text")
      formData.append("resume_text", resume.data.content)

      setPhase("sending")
      const postPromise = axios.post<AnalysisResult>(`${API_BASE}/api/v1/analyze`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setPhase("analyzing")
      const { data } = await postPromise
      setResult(data)
      setPhase("done")
    } catch (e) {
      if (isAuthError(e)) {
        setToken("")
        setResult(null)
        setPhase("idle")
        return
      }
      setError(extractErrorMessage(e))
      setPhase("idle")
    } finally {
      setLoading(false)
    }
  }

  const startManualPaste = () => {
    setManualJd("")
    setShowManualPaste(true)
  }

  const useManualJd = () => {
    if (!manualJd.trim()) return
    setJdText(manualJd)
    setJdStatus("loaded")
    setShowManualPaste(false)
    setManualJd("")
  }

  if (!token) {
    return (
      <div style={{ padding: 24, fontFamily: "Inter, sans-serif", background: "#0F0F0F", minHeight: "100vh", color: "#F5F5F5" }}>
        <h2 style={{ color: "#10B981", marginBottom: 12 }}>Resume Analyzer</h2>
        <p style={{ color: "#A3A3A3", fontSize: 14, marginBottom: 12 }}>
          Sign in on the web app first, then paste your Clerk token below.
        </p>
        <p style={{ color: "#A3A3A3", fontSize: 12, marginBottom: 12 }}>
          ⚠️ Normal Clerk tokens expire in ~60 seconds. For a token that lasts much longer, run this in the web app console (F12):
        </p>
        <pre
          style={{
            background: "#242424",
            border: "1px solid #2E2E2E",
            color: "#10B981",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 12,
            overflowX: "auto",
            marginBottom: 12,
          }}
        >
{`await window.Clerk?.session?.getToken({ template: "extension" })`}
        </pre>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your Clerk token..."
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
      <style>{`
        @keyframes rja-spin { to { transform: rotate(360deg); } }
        .rja-spinner {
          display: inline-block; width: 14px; height: 14px;
          border: 2px solid #10B981; border-top-color: transparent;
          border-radius: 50%; animation: rja-spin .8s linear infinite;
          vertical-align: middle;
        }
      `}</style>
      <h2 style={{ color: "#10B981", fontSize: 16, marginBottom: 16 }}>⚡ Resume Analyzer</h2>

      {/* Job description status card */}
      <div
        style={{
          background: "#1A1A1A",
          border: "1px solid #2E2E2E",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {jdStatus === "fetching" ? (
              <>
                <span className="rja-spinner" /> Fetching job description…
              </>
            ) : jdStatus === "loaded" ? (
              <>
                <span style={{ color: "#10B981" }}>●</span> Job description loaded ({jdText.length.toLocaleString()} chars)
              </>
            ) : jdStatus === "empty" ? (
              <>
                <span style={{ color: "#F59E0B" }}>●</span> No job description yet
              </>
            ) : (
              "Job description"
            )}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={fetchJdFromPage}
              disabled={jdStatus === "fetching"}
              style={{
                background: "#242424",
                color: "#10B981",
                border: "1px solid #10B98140",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ↻ Fetch from page
            </button>
            <button
              onClick={startManualPaste}
              style={{
                background: "#242424",
                color: "#A3A3A3",
                border: "1px solid #2E2E2E",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Paste manually
            </button>
          </div>
        </div>

        {jobTitle ? (
          <div style={{ fontSize: 12, color: "#A3A3A3", marginBottom: 4 }}>
            Job: <strong style={{ color: "#F5F5F5" }}>{jobTitle}</strong>
          </div>
        ) : null}
        {sourceUrl ? (
          <div style={{ fontSize: 11, color: "#525252", wordBreak: "break-all" }}>{sourceUrl}</div>
        ) : null}

        {showManualPaste ? (
          <div style={{ marginTop: 10 }}>
            <textarea
              value={manualJd}
              onChange={(e) => setManualJd(e.target.value)}
              placeholder="Paste the job description here..."
              rows={6}
              style={{
                width: "100%",
                background: "#0F0F0F",
                border: "1px solid #2E2E2E",
                color: "#F5F5F5",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
                boxSizing: "border-box",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button
                onClick={useManualJd}
                disabled={!manualJd.trim()}
                style={{
                  background: "#10B981",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: manualJd.trim() ? "pointer" : "not-allowed",
                  opacity: manualJd.trim() ? 1 : 0.5,
                }}
              >
                Use this text
              </button>
              <button
                onClick={() => setShowManualPaste(false)}
                style={{
                  background: "transparent",
                  color: "#A3A3A3",
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

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
      ) : null}

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
          cursor: loading ? "wait" : !selectedResumeId || !jdText ? "not-allowed" : "pointer",
          marginBottom: 16,
          opacity: !selectedResumeId || !jdText ? 0.5 : 1,
        }}
      >
        {loading ? (
          <span>
            <span className="rja-spinner" style={{ borderColor: "white", borderTopColor: "transparent" }} />{" "}
            {phaseLabel[phase]}
          </span>
        ) : (
          "Analyze Match"
        )}
      </button>

      {!jdText && !showManualPaste ? (
        <p style={{ fontSize: 12, color: "#F59E0B", marginBottom: 16 }}>
          ⚠️ No job description loaded. Click <strong>↻ Fetch from page</strong> above, or open the side panel from a
          job page with the <strong>⚡ Analyze Match</strong> button.
        </p>
      ) : jdText && !selectedResumeId ? (
        <p style={{ fontSize: 12, color: "#F59E0B", marginBottom: 16 }}>
          ⚠️ Select a resume from the dropdown above to enable analysis.
        </p>
      ) : null}

      {loading && phase !== "idle" ? (
        <div
          style={{
            background: "#1A1A1A",
            border: "1px solid #2E2E2E",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 16,
          }}
        >
          {[
            { key: "fetching_resume", label: "Fetching your resume" },
            { key: "sending", label: "Sending request to the server" },
            { key: "analyzing", label: "AI analyzing resume vs job" },
          ].map((step) => {
            const order = ["fetching_resume", "sending", "analyzing"]
            const stepIdx = order.indexOf(step.key)
            const phaseIdx = phase === "done" ? 3 : order.indexOf(phase)
            const isDone = phaseIdx > stepIdx
            const isActive = phaseIdx === stepIdx
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
                {isDone ? (
                  <span style={{ color: "#10B981", fontSize: 13 }}>✓</span>
                ) : isActive ? (
                  <span className="rja-spinner" />
                ) : (
                  <span style={{ color: "#525252", fontSize: 13 }}>○</span>
                )}
                <span style={{ fontSize: 12, color: isDone || isActive ? "#F5F5F5" : "#525252" }}>{step.label}</span>
                {isActive && phase === "analyzing" ? (
                  <span style={{ fontSize: 11, color: "#10B981", marginLeft: "auto" }}>{elapsed}s</span>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

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
