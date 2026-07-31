export {}

type OpenAnalysisMessage = {
  type: "OPEN_ANALYSIS"
  payload: {
    jdText: string
    jobTitle: string
    sourceUrl: string
  }
}

chrome.runtime.onMessage.addListener((message: OpenAnalysisMessage, sender, sendResponse) => {
  if (message?.type === "OPEN_ANALYSIS") {
    chrome.storage.session
      .set({ pendingAnalysis: message.payload })
      .then(async () => {
        const tabId = sender.tab?.id
        if (tabId !== undefined) {
          await chrome.sidePanel.open({ tabId })
        }
        sendResponse({ ok: true })
      })
      .catch((error) => {
        console.error("[background] Failed to open side panel", error)
        sendResponse({ ok: false, error: String(error) })
      })
    return true
  }
})

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.warn("[background] setPanelBehavior failed", error))
})
