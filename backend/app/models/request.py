from pydantic import BaseModel, field_validator


class CompareRequest(BaseModel):
    resume_text: str
    job_descriptions: list[str]   # 2 to 3 JDs required

    @field_validator("resume_text")
    @classmethod
    def validate_resume(cls, v: str) -> str:
        if len(v.strip()) < 200:
            raise ValueError("Resume text is too short (min 200 chars)")
        return v

    @field_validator("job_descriptions")
    @classmethod
    def validate_jds(cls, v: list[str]) -> list[str]:
        if len(v) < 2:
            raise ValueError("At least 2 job descriptions required for comparison")
        if len(v) > 3:
            raise ValueError("Maximum 3 job descriptions per comparison")
        for i, jd in enumerate(v):
            if len(jd.strip()) < 100:
                raise ValueError(f"Job description {i + 1} is too short (min 100 chars)")
        return v
