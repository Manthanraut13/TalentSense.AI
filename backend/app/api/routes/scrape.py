import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl

from app.services.scraper import scrape_job_description
from app.api.deps import get_current_user

router = APIRouter(tags=["scrape"])
logger = logging.getLogger(__name__)

class ScrapeRequest(BaseModel):
    url: HttpUrl

@router.post("/scrape-jd")
async def scrape_jd(body: ScrapeRequest, user_id: str = Depends(get_current_user)):
    url = str(body.url)
    logger.info("JD scrape requested: user=%s, url=%s", user_id, url)
    try:
        result = await scrape_job_description(url)
        logger.info("JD scrape successful: user=%s, source=%s, chars=%d",
                     user_id, result["source"], len(result["content"]))
        return {
            "job_description": result["content"],
            "source": result["source"],
            "character_count": len(result["content"]),
        }
    except ValueError as e:
        logger.warning("JD scrape failed (ValueError): user=%s, url=%s, error=%s", user_id, url, e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error("JD scrape failed (unexpected): user=%s, url=%s, error=%s", user_id, url, e)
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")
