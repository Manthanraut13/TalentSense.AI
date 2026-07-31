import { useEffect } from "react"
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.linkedin.com/jobs/*",
    "https://*.indeed.com/viewjob*",
    "https://www.naukri.com/job-listings*",
    "https://www.naukri.com/job-details*",
  ],
  run_at: "document_idle",
}

const BUTTON_ID = "rja-analyze-btn"

const SITE_SELECTORS: Record<string, { button: string; jd: string; title: string }> = {
  "linkedin.com": {
    button: ".jobs-apply-button--top-card",
    jd: ".jobs-description__content, .job-view-layout",
    title: ".job-details-jobs-unified-top-card__job-title",
  },
  "indeed.com": {
    button: "#applyButtonLinkContainer, .jobsearch-ApplyButton",
    jd: "#jobDescriptionText",
    title: ".jobsearch-JobInfoHeader-title",
  },
  "naukri.com": {
    button: ".styles-actions, .job-apply-button",
    jd: ".job-desc, .styles_JDC__dang-inner-1Mepc",
    title: "h1",
  },
}

function detectSite() {
  const host = window.location.hostname
  if (host.includes("linkedin.com")) return "linkedin.com"
  if (host.includes("indeed.com")) return "indeed.com"
  if (host.includes("naukri.com")) return "naukri.com"
  return null
}

function firstVisibleText(selector: string): string {
  const elements = Array.from(document.querySelectorAll(selector))
  for (const el of elements) {
    const text = (el as HTMLElement).innerText?.trim()
    if (text) return text
  }
  return ""
}

function extractJobDetails() {
  const site = detectSite()
  if (!site) return { jdText: "", jobTitle: "", sourceUrl: window.location.href }
  const { jd, title } = SITE_SELECTORS[site]
  return {
    jdText: firstVisibleText(jd),
    jobTitle: firstVisibleText(title),
    sourceUrl: window.location.href,
  }
}

function injectButton() {
  const site = detectSite()
  if (!site) return
  if (document.getElementById(BUTTON_ID)) return

  const anchor = document.querySelector(SITE_SELECTORS[site].button)
  if (!anchor) return

  const btn = document.createElement("button")
  btn.id = BUTTON_ID
  btn.innerText = "⚡ Analyze Match"
  btn.style.cssText = `
    background: #10B981; color: white; border: none;
    padding: 8px 16px; border-radius: 8px; font-weight: 600;
    font-size: 14px; cursor: pointer; margin-left: 8px;
  `
  btn.onclick = () => {
    const details = extractJobDetails()
    chrome.runtime.sendMessage({ type: "OPEN_ANALYSIS", payload: details })
  }
  anchor.parentNode?.insertBefore(btn, anchor.nextSibling)
}

function ResumeAnalyzerButton() {
  useEffect(() => {
    injectButton()
    const observer = new MutationObserver(injectButton)
    observer.observe(document.body, { subtree: true, childList: true })
    return () => observer.disconnect()
  }, [])

  return null
}

export default ResumeAnalyzerButton
