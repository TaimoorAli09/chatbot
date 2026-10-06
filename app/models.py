from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=2000, description="Visitor's question")
    history: list[ChatMessage] = Field(default_factory=list, max_length=10)
    # This is optional presentation context from React, not a trusted source of facts.
    page_url: str | None = Field(default=None, max_length=500)

    @field_validator("message")
    @classmethod
    def clean_message(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("message cannot be blank")
        return value


class ChatResponse(BaseModel):
    answer: str
    model: str
