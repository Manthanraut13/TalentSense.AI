import logging
import sys
import subprocess

from app.services.mongo_service import mongo_service
import httpx
import re
import asyncio
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

PLAYWRIGHT_AVAILABLE = False
try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    logger.warning("Playwright package not installed — browser-based scraping disabled. Install with: pip install playwright")

SITE_SELECTORS = {
    "linkedin.com": {
        "selector": ".jobs-description__content, .job-view-layout",
        "wait_for": ".jobs-description",
    },
    "indeed.com": {
        "selector": "#jobDescriptionText",
        "wait_for": "#jobDescriptionText",
    },
    "naukri.com": {
        "selector": ".job-desc",
        "wait_for": ".job-desc",
    },
    "glassdoor.com": {
        "selector": ".jobDescriptionContent",
        "wait_for": ".jobDescriptionContent",
    },
}


def detect_site(url: str) -> str | None:
    for site_key in SITE_SELECTORS:
        if site_key in url:
            return site_key
    return None

async def get_cached_jd(url: str) -> str | None:
    collection = mongo_service._get_collection()
    if collection is None:
        return None
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    doc = await collection.database.scraped_jds.find_one({
        "url": url,
        "scraped_at": {"$gte": cutoff},
    })
    if doc:
        logger.debug("Cache hit: url=%s", url)
    return doc["content"] if doc else None

async def cache_jd(url: str, content: str):
    collection = mongo_service._get_collection()
    if collection is None:
        return
    from datetime import datetime, timezone
    await collection.database.scraped_jds.update_one(
        {"url": url},
        {"$set": {"content": content, "scraped_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    logger.debug("Cache saved: url=%s, chars=%d", url, len(content))

async def try_simple_fetch(url: str) -> str | None:
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": "Mozilla/5.0 (compatible; ResumeAnalyzer/1.0)"},
            follow_redirects=True,
            timeout=10,
        ) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                for tag in soup(["script", "style", "nav", "header", "footer"]):
                    tag.decompose()
                text = soup.get_text(separator="\n")
                text = re.sub(r"\n{3,}", "\n\n", text).strip()
                if len(text) > 200:
                    logger.debug("Simple fetch successful: %s, chars=%d", url, len(text))
                    return text[:4000]
            else:
                logger.debug("Simple fetch returned %d for %s", resp.status_code, url)
    except Exception as e:
        logger.debug("Simple fetch failed for %s: %s", url, e)
    return None

async def scrape_with_playwright(url: str, site_key: str | None) -> str:
    if not PLAYWRIGHT_AVAILABLE:
        logger.warning("Playwright not available — skipping browser scrape: url=%s", url)
        raise ValueError("Browser-based scraping is not available. Try a different URL or paste the JD directly.")

    logger.info("Playwright scraping: url=%s, site=%s", url, site_key or "generic")

    def _run() -> str:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    locale="en-US",
                )
                page = context.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                if site_key and site_key in SITE_SELECTORS:
                    wait_selector = SITE_SELECTORS[site_key].get("wait_for")
                    if wait_selector:
                        page.wait_for_selector(wait_selector, timeout=10000)
                    selector = SITE_SELECTORS[site_key]["selector"]
                    elements = page.query_selector_all(selector)
                    texts = [el.inner_text() for el in elements]
                    content = "\n".join(texts)
                else:
                    content = page.inner_text("body")
                logger.debug("Playwright scraped: url=%s, chars=%d", url, len(content))
                return content[:4000] if content else ""
            except Exception as e:
                logger.warning("Playwright scrape failed: url=%s, error=%s", url, e)
                raise ValueError(f"Failed to scrape page: {str(e)}")
            finally:
                browser.close()

    try:
        return await asyncio.to_thread(_run)
    except ValueError:
        raise
    except Exception as e:
        logger.warning("Playwright setup failed: url=%s, error=%s", url, e)
        raise ValueError(f"Failed to initialize browser: {str(e)}")

async def scrape_job_description(url: str) -> dict:
    logger.info("Scrape job description: url=%s", url)
    cached = await get_cached_jd(url)
    if cached:
        return {"content": cached, "source": "cache"}
    site_key = detect_site(url)
    simple = await try_simple_fetch(url)
    if simple and len(simple) > 200:
        await cache_jd(url, simple)
        return {"content": simple, "source": "http"}
    content = await scrape_with_playwright(url, site_key)
    if not content or len(content) < 100:
        raise ValueError("Could not extract job description from this URL. Try pasting the JD directly.")
    await cache_jd(url, content)
    return {"content": content, "source": "playwright"}
