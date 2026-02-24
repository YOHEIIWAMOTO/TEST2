import logging
from typing import Protocol

logger = logging.getLogger(__name__)


class OCRProvider(Protocol):
    def extract_text(self, image_path: str) -> str: ...


class TesseractOCRProvider:
    """OCR provider using Tesseract via pytesseract."""

    def __init__(self, lang: str = "jpn"):
        self.lang = lang

    def extract_text(self, image_path: str) -> str:
        try:
            import pytesseract
            from PIL import Image

            from app.services.image_preprocessor import preprocess_for_ocr

            image = Image.open(image_path)
            image = preprocess_for_ocr(image)
            text = pytesseract.image_to_string(image, lang=self.lang)
            return text.strip()
        except Exception as e:
            logger.error("Tesseract OCR failed for %s: %s", image_path, e)
            raise RuntimeError(f"OCR processing failed: {e}") from e


class DummyOCRProvider:
    """Fallback provider that returns fixed sample text (for testing without Tesseract)."""

    def extract_text(self, image_path: str) -> str:
        return (
            "サンプル株式会社\n"
            "2026年01月15日\n"
            "品目: 会議費\n"
            "小計: ¥10,000\n"
            "消費税(10%): ¥1,000\n"
            "合計: ¥11,000"
        )


def _create_provider() -> OCRProvider:
    from app.config import settings

    if settings.ocr_provider == "dummy":
        logger.info("Using DummyOCRProvider")
        return DummyOCRProvider()
    try:
        import pytesseract  # noqa: F401

        logger.info("Using TesseractOCRProvider")
        return TesseractOCRProvider()
    except ImportError:
        logger.warning("pytesseract not installed, falling back to DummyOCRProvider")
        return DummyOCRProvider()


ocr_provider: OCRProvider = _create_provider()
