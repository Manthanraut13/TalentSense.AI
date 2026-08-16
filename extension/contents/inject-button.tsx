import { useEffect } from "react"
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://*.linkedin.com/jobs/*",
    "https://*.indeed.com/viewjob*",
    "https://*.naukri.com/job-listings*",
    "https://*.naukri.com/job-details*",
  ],
  run_at: "document_idle",
}

const BUTTON_ID = "rja-analyze-btn"

type SiteSelectors = {
  anchors: string[]
  jd: string[]
  title: string[]
}

const SITE_SELECTORS: Record<string, SiteSelectors> = {
  "linkedin.com": {
    anchors: [
      ".jobs-apply-button--top-card",
      ".jobs-s-apply",
      "[data-test-id*='apply']",
      ".jobs-apply-button",
      ".jobs-unified-top-card__apply-button",
    ],
    jd: [
      ".jobs-description__content",
      ".job-view-layout",
      ".show-more-less-html__markup",
      ".jobs-box__html-content",
      "#job-details",
    ],
    title: [
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__title",
      "h1",
    ],
  },
  "indeed.com": {
    anchors: [
      "#applyButtonLinkContainer",
      ".jobsearch-ApplyButton",
      ".jobsearch-IndeedApplyButton",
      "[data-testid*='applyButton']",
    ],
    jd: ["#jobDescriptionText", ".jobsearch-JobComponent-description", ".jobsearch-jobDescriptionText"],
    title: [".jobsearch-JobInfoHeader-title", "h1"],
  },
  "naukri.com": {
    anchors: [
      ".styles-actions",
      ".job-apply-button",
      ".styles_actions__wrapper",
      "[data-job-id] .apply-button",
    ],
    jd: [
      ".job-desc",
      ".styles_JDC__dang-inner-1Mepc",
      ".jd-section",
      "[class*='job-description']",
      ".job-details-section",
    ],
    title: ["h1", ".job-title"],
  },
}

function detectSite() {
  const host = window.location.hostname
  if (host.includes("linkedin.com")) return "linkedin.com"
  if (host.includes("indeed.com")) return "indeed.com"
  if (host.includes("naukri.com")) return "naukri.com"
  return null
}

function firstVisibleText(selectors: string[]): string {
  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll(selector))
    for (const el of elements) {
      const text = (el as HTMLElement).innerText?.trim()
      if (text) return text
    }
  }
  return ""
}

function extractJobDetails() {
  const site = detectSite()
  const fallback = { jdText: "", jobTitle: "", sourceUrl: window.location.href }
  if (!site) return fallback
  const { jd, title } = SITE_SELECTORS[site]
  let jdText = firstVisibleText(jd)
  if (!jdText) {
    const main = document.querySelector("main") as HTMLElement | null
    jdText = main?.innerText?.trim() ?? ""
  }
  return {
    jdText,
    jobTitle: firstVisibleText(title),
    sourceUrl: window.location.href,
  }
}

function setButtonState(btn: HTMLButtonElement, busy: boolean) {
  btn.innerText = busy ? "✓ Opening analyzer…" : "⚡ Analyze Match"
  btn.disabled = busy
  btn.style.opacity = busy ? "0.6" : "1"
  btn.style.cursor = busy ? "wait" : "pointer"
}

function injectButton() {
  const site = detectSite()
  if (!site) return
  if (document.getElementById(BUTTON_ID)) return

  let anchor: Element | null = null
  for (const selector of SITE_SELECTORS[site].anchors) {
    anchor = document.querySelector(selector)
    if (anchor) break
  }

  const btn = document.createElement("button")
  btn.id = BUTTON_ID
  btn.type = "button"
  btn.innerText = "⚡ Analyze Match"
  btn.style.cssText = `
    background: #10B981; color: white; border: none;
    padding: 8px 16px; border-radius: 8px; font-weight: 600;
    font-size: 14px; cursor: pointer; margin-left: 8px;
    box-shadow: 0 2px 6px rgba(16,185,129,.35);
  `

  btn.onclick = () => {
    const details = extractJobDetails()
    setButtonState(btn, true)
    chrome.runtime.sendMessage({ type: "OPEN_ANALYSIS", payload: details }, () => {
      setButtonState(btn, false)
    })
  }

  if (anchor?.parentNode) {
    anchor.parentNode.insertBefore(btn, anchor.nextSibling)
  } else {
    btn.style.position = "fixed"
    btn.style.top = "16px"
    btn.style.right = "16px"
    btn.style.zIndex = "2147483647"
    btn.style.marginLeft = "0"
    document.body.appendChild(btn)
  }
}

chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
  if (message?.type === "FETCH_JD") {
    sendResponse(extractJobDetails())
  }
})

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
