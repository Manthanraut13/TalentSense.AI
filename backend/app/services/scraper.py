from app.services.mongo_service import mongo_service
import httpx
import re
import asyncio
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

# Get the database and create a collection for scraped job descriptions
db = mongo_service._get_collection().database
scraped_jds_collection = db.scraped_jds

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
                    return text[:4000]
    except Exception:
        pass
    return None

async def scrape_with_playwright(url: str, site_key: str | None) -> str:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            locale="en-US",
        )
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            if site_key and site_key in SITE_SELECTORS:
                wait_selector = SITE_SELECTORS[site_key].get("wait_for")
                if wait_selector:
                    await page.wait_for_selector(wait_selector, timeout=10000)
                selector = SITE_SELECTORS[site_key]["selector"]
                elements = await page.query_selector_all(selector)
                texts = [await el.inner_text() for el in elements]
                content = "\n".join(texts)
            else:
                content = await page.inner_text("body")
            await browser.close()
            return content[:4000] if content else ""
        except Exception as e:
            await browser.close()
            raise ValueError(f"Failed to scrape page: {str(e)}")

async def get_cached_jd(url: str) -> str | None:
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    doc = await scraped_jds_collection.find_one({
        "url": url,
        "scraped_at": {"$gte": cutoff},
    })
    return doc["content"] if doc else None

async def cache_jd(url: str, content: str):
    from datetime import datetime, timezone
    await scraped_jds_collection.update_one(
        {"url": url},
        {"$set": {"content": content, "scraped_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )

async def scrape_job_description(url: str) -> dict:
    cached = await get_cached_jd(url)
    if cached:
        return {"content": cached, "source": "cache"}
    site_key = detect_site(url)
    if site_key not in ["linkedin.com"]:
        simple = await try_simple_fetch(url)
        if simple and len(simple) > 200:
            await cache_jd(url, simple)
            return {"content": simple, "source": "http"}
    content = await scrape_with_playwright(url, site_key)
    if not content or len(content) < 100:
        raise ValueError("Could not extract job description from this URL. Try pasting the JD directly.")
    await cache_jd(url, content)
    return {"content": content, "source": "playwright"}
