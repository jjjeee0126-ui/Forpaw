from __future__ import annotations

import base64
import io
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import cv2
import numpy as np
from PIL import Image, ImageOps


def decode_data_url(data_url: str) -> Image.Image:
    if not data_url.startswith("data:image/"):
        raise ValueError("이미지 data URL 형식이 아닙니다.")

    header, encoded = data_url.split(",", 1)
    if ";base64" not in header:
        raise ValueError("base64 이미지 데이터만 지원합니다.")

    image_bytes = base64.b64decode(encoded)
    image = Image.open(io.BytesIO(image_bytes))
    return ImageOps.exif_transpose(image).convert("RGB")


def image_to_data_url(image: Image.Image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def hex_to_rgb(value: str) -> Tuple[int, int, int]:
    cleaned = value.lstrip("#")
    if len(cleaned) != 6:
        raise ValueError("paperColor는 6자리 hex 형식이어야 합니다.")
    return tuple(int(cleaned[index:index + 2], 16) for index in (0, 2, 4))


@dataclass
class RenderConfig:
    preset: str = "pet-portrait"
    backend: str = "auto"
    remove_background: bool = True
    crop_subject: bool = True
    paper_color: str = "#f7dfbd"
    detail_boost: float = 0.62
    stroke_boost: float = 0.38
    max_side: int = 1280


class LineArtPipeline:
    def __init__(self) -> None:
        self.root_dir = Path(__file__).resolve().parent
        self.output_dir = self.root_dir / "outputs"
        self.output_dir.mkdir(exist_ok=True)
        self._detector = None
        self._detector_error: Optional[str] = None

    def status(self) -> Dict[str, Any]:
        detector_ready = self._detector is not None
        if not detector_ready and self._detector_error is None:
            self._ensure_detector(lazy=True)
            detector_ready = self._detector is not None

        backend = "controlnet_aux" if detector_ready else "xdog"
        return {
            "ok": True,
            "backend": backend,
            "detectorReady": detector_ready,
            "detectorError": self._detector_error,
        }

    def warmup(self) -> Dict[str, Any]:
        self._ensure_detector(lazy=False)
        return self.status()

    def render(self, image_data_url: str, config: RenderConfig) -> Dict[str, Any]:
        started_at = time.perf_counter()
        source_image = decode_data_url(image_data_url)
        prepared = self._prepare_canvas(source_image, config)

        backend = self._pick_backend(config.backend)
        if backend == "controlnet_aux":
            try:
                line_map = self._render_with_detector(prepared["subject"], config)
            except Exception as error:
                self._detector_error = str(error)
                backend = "xdog"
                line_map = self._render_with_xdog(prepared["subject"], config)
        else:
            line_map = self._render_with_xdog(prepared["subject"], config)

        composed = self._compose_line_art(line_map, prepared["mask"], prepared["paper"], config)
        duration_ms = (time.perf_counter() - started_at) * 1000

        file_name = f"lineart-{int(time.time() * 1000)}.png"
        output_path = self.output_dir / file_name
        composed.save(output_path)

        return {
            "imageDataUrl": image_to_data_url(composed),
            "meta": {
                "backend": backend,
                "paperColor": config.paper_color,
                "durationMs": duration_ms,
                "savedPath": str(output_path),
                "message": self._build_message(backend, config),
            },
        }

    def _build_message(self, backend: str, config: RenderConfig) -> str:
        if backend == "controlnet_aux":
            return f"AI 라인 디텍터로 {config.preset} 스타일에 맞춰 정리했어요."
        return "클래식 라인 추출로 결과를 만들었어요. AI 디텍터를 설치하면 더 깨끗해집니다."

    def _pick_backend(self, requested_backend: str) -> str:
        if requested_backend == "xdog":
            return "xdog"

        self._ensure_detector(lazy=requested_backend == "auto")
        if self._detector is not None:
            return "controlnet_aux"

        if requested_backend == "controlnet_aux":
            raise RuntimeError(self._detector_error or "AI 라인 디텍터를 사용할 수 없습니다.")

        return "xdog"

    def _ensure_detector(self, lazy: bool) -> None:
        if self._detector is not None or self._detector_error is not None:
            return

        try:
            from controlnet_aux import LineartDetector
        except Exception as error:
            self._detector_error = (
                "controlnet_aux가 설치되지 않았습니다. "
                "`.venv` 활성화 후 `pip install -r lineart_service/requirements-ai.txt`를 실행해 주세요. "
                f"({error})"
            )
            return

        if lazy and os.environ.get("FORPAW_SKIP_MODEL_LOAD", "0") == "1":
            self._detector_error = "환경 변수로 모델 로드를 건너뛰었습니다."
            return

        try:
            self._detector = LineartDetector.from_pretrained("lllyasviel/Annotators")
        except Exception as error:
            self._detector_error = (
                "LineartDetector 모델을 불러오지 못했습니다. "
                "네트워크 연결 후 `python3 -m lineart_service.download_models`로 먼저 받아 두면 안정적입니다. "
                f"({error})"
            )

    def _prepare_canvas(self, image: Image.Image, config: RenderConfig) -> Dict[str, Image.Image]:
        resized = self._resize_image(image, config.max_side)
        subject_image = resized
        subject_mask = Image.new("L", resized.size, 255)

        if config.remove_background:
            subject_mask = self._extract_subject_mask(resized)

        if config.crop_subject:
            subject_image, subject_mask = self._crop_subject(resized, subject_mask, config.max_side)

        paper = Image.new("RGB", subject_image.size, hex_to_rgb(config.paper_color))
        return {
            "subject": subject_image,
            "mask": subject_mask,
            "paper": paper,
        }

    def _resize_image(self, image: Image.Image, max_side: int) -> Image.Image:
        width, height = image.size
        largest_side = max(width, height)
        if largest_side <= max_side:
            return image

        scale = max_side / float(largest_side)
        next_size = (max(1, int(width * scale)), max(1, int(height * scale)))
        return image.resize(next_size, Image.Resampling.LANCZOS)

    def _extract_subject_mask(self, image: Image.Image) -> Image.Image:
        rgb = np.array(image.convert("RGB"))
        mask = np.zeros(rgb.shape[:2], np.uint8)
        background_model = np.zeros((1, 65), np.float64)
        foreground_model = np.zeros((1, 65), np.float64)
        height, width = mask.shape
        margin = max(8, min(width, height) // 14)
        rect = (margin, margin, max(1, width - (margin * 2)), max(1, height - (margin * 2)))

        try:
            cv2.grabCut(rgb, mask, rect, background_model, foreground_model, 4, cv2.GC_INIT_WITH_RECT)
            mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype("uint8")
        except Exception:
            mask.fill(255)

        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        mask = cv2.GaussianBlur(mask, (0, 0), sigmaX=1.1, sigmaY=1.1)
        return Image.fromarray(mask, mode="L")

    def _crop_subject(self, image: Image.Image, mask: Image.Image, max_side: int) -> Tuple[Image.Image, Image.Image]:
        mask_array = np.array(mask)
        points = np.argwhere(mask_array > 24)
        if points.size == 0:
            return image, mask

        top, left = points.min(axis=0)
        bottom, right = points.max(axis=0)
        height, width = mask_array.shape
        padding = int(max(bottom - top, right - left) * 0.16)

        top = max(0, top - padding)
        left = max(0, left - padding)
        bottom = min(height, bottom + padding)
        right = min(width, right + padding)

        cropped_image = image.crop((left, top, right, bottom))
        cropped_mask = mask.crop((left, top, right, bottom))

        square_size = min(max_side, max(cropped_image.size))
        square_image = Image.new("RGB", (square_size, square_size), "white")
        square_mask = Image.new("L", (square_size, square_size), 0)

        paste_x = (square_size - cropped_image.size[0]) // 2
        paste_y = (square_size - cropped_image.size[1]) // 2
        square_image.paste(cropped_image, (paste_x, paste_y))
        square_mask.paste(cropped_mask, (paste_x, paste_y))
        return square_image, square_mask

    def _render_with_detector(self, image: Image.Image, config: RenderConfig) -> Image.Image:
        if self._detector is None:
            raise RuntimeError(self._detector_error or "AI 라인 디텍터가 준비되지 않았습니다.")

        try:
            detected = self._detector(image, coarse=config.preset == "bold")
        except TypeError:
            detected = self._detector(image)

        if isinstance(detected, Image.Image) and detected.size != image.size:
            detected = detected.resize(image.size, Image.Resampling.LANCZOS)

        return self._normalize_line_map(detected, config)

    def _render_with_xdog(self, image: Image.Image, config: RenderConfig) -> Image.Image:
        rgb = np.array(image.convert("RGB"))
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        gray = cv2.bilateralFilter(gray, 7, 55, 55)

        low_threshold = int(28 + (config.detail_boost * 28))
        high_threshold = int(94 + (config.detail_boost * 68))
        edges = cv2.Canny(gray, low_threshold, high_threshold)
        edge_map = cv2.bitwise_not(edges)

        adaptive = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            17,
            3,
        )

        combined = cv2.min(adaptive, edge_map)
        return self._normalize_line_map(Image.fromarray(combined, mode="L"), config)

    def _normalize_line_map(self, image: Any, config: RenderConfig) -> Image.Image:
        if isinstance(image, Image.Image):
            gray = np.array(image.convert("L"))
        else:
            gray = np.array(image)
            if gray.ndim == 3:
                gray = cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)

        gray = cv2.GaussianBlur(gray, (0, 0), sigmaX=0.7)
        if float(np.mean(gray)) < 127:
            gray = cv2.bitwise_not(gray)

        cutoff = int(208 - (config.detail_boost * 74))
        _, binary = cv2.threshold(gray, cutoff, 255, cv2.THRESH_BINARY)
        ink = cv2.bitwise_not(binary)

        if config.preset == "minimal":
            ink = cv2.erode(ink, np.ones((2, 2), np.uint8), iterations=1)
        if config.preset == "bold":
            ink = cv2.dilate(ink, np.ones((2, 2), np.uint8), iterations=1)

        extra_dilate = max(0, int(round(config.stroke_boost * 3)))
        if extra_dilate:
            kernel_size = 1 + (extra_dilate * 2)
            ink = cv2.dilate(ink, np.ones((kernel_size, kernel_size), np.uint8), iterations=1)

        return Image.fromarray(cv2.bitwise_not(ink), mode="L")

    def _compose_line_art(
        self,
        line_map: Image.Image,
        subject_mask: Image.Image,
        paper: Image.Image,
        config: RenderConfig,
    ) -> Image.Image:
        if line_map.size != paper.size:
            line_map = line_map.resize(paper.size, Image.Resampling.LANCZOS)

        line_array = np.array(line_map.convert("L"))
        mask_array = np.array(subject_mask.convert("L"))
        paper_array = np.array(paper.convert("RGB"))

        if config.remove_background:
            expanded_mask = cv2.dilate(mask_array, np.ones((11, 11), np.uint8), iterations=1)
            outside = expanded_mask < 10
            line_array[outside] = 255

        ink_pixels = line_array < 200
        paper_array[ink_pixels] = (23, 18, 13)
        return Image.fromarray(paper_array, mode="RGB")
