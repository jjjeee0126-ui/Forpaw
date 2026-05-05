from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .pipeline import LineArtPipeline, RenderConfig


class RenderOptionsPayload(BaseModel):
    backend: str = Field(default="auto")
    removeBackground: bool = Field(default=True)
    cropSubject: bool = Field(default=True)
    paperColor: str = Field(default="#f7dfbd")
    detailBoost: float = Field(default=0.62, ge=0.0, le=1.0)
    strokeBoost: float = Field(default=0.38, ge=0.0, le=1.0)
    maxSide: int = Field(default=1280, ge=512, le=2048)


class RenderRequest(BaseModel):
    imageDataUrl: str
    preset: str = Field(default="pet-portrait")
    options: RenderOptionsPayload = Field(default_factory=RenderOptionsPayload)


pipeline = LineArtPipeline()
app = FastAPI(title="ForPaw LineArt Service")


@app.get("/health")
def health() -> dict:
    return pipeline.status()


@app.post("/render")
def render(request: RenderRequest) -> dict:
    try:
        config = RenderConfig(
            preset=request.preset,
            backend=request.options.backend,
            remove_background=request.options.removeBackground,
            crop_subject=request.options.cropSubject,
            paper_color=request.options.paperColor,
            detail_boost=request.options.detailBoost,
            stroke_boost=request.options.strokeBoost,
            max_side=request.options.maxSide,
        )
        return pipeline.render(request.imageDataUrl, config)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
