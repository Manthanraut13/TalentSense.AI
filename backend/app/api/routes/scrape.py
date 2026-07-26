from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl

from app.services.scraper import scrape_job_description
from app.services.user_service import get_user_plan
from app.api.deps import get_current_user

router = APIRouter(tags=["scrape"])

class ScrapeRequest(BaseModel):
    url: HttpUrl

@router.post("/scrape-jd")
async def scrape_jd(body: ScrapeRequest, user_id: str = Depends(get_current_user)):
    plan = await get_user_plan(user_id)
    if plan != "pro":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Job URL scraping is a Pro feature. Upgrade to use it.")
    try:
        result = await scrape_job_description(body.url)
        return {
            "job_description": result["content"],
            "source": result["source"],
            "character_count": len(result["content"]),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")
