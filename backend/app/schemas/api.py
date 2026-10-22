from pydantic import BaseModel, Field, field_validator


class CreateDebateRequest(BaseModel):
    question: str = Field(min_length=8)
    topic: str = Field(default="custom", min_length=1, max_length=60)

    @field_validator("question", "topic")
    @classmethod
    def strip(cls, value: str) -> str:
        return value.strip()
