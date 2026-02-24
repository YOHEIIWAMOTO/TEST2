"""Image preprocessing pipeline to improve OCR accuracy.

Applies the following steps (all using Pillow, no OpenCV dependency):
1. EXIF auto-rotation  – fix phone camera orientation
2. Grayscale conversion – remove color noise
3. Contrast enhancement – improve text/background separation
4. Sharpening          – make edges crisper for OCR
5. Binarization        – adaptive thresholding for cleaner text
"""

import logging
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)


def preprocess_for_ocr(image: Image.Image) -> Image.Image:
    """Run the full preprocessing pipeline and return the cleaned image."""
    try:
        image = _fix_orientation(image)
        image = _to_grayscale(image)
        image = _enhance_contrast(image)
        image = _sharpen(image)
        image = _binarize(image)
    except Exception as e:
        logger.warning("Image preprocessing partially failed, using best effort: %s", e)
    return image


def _fix_orientation(image: Image.Image) -> Image.Image:
    """Auto-rotate based on EXIF orientation tag (handles phone photos)."""
    try:
        image = ImageOps.exif_transpose(image)
    except Exception:
        pass  # No EXIF data or unsupported format
    return image


def _to_grayscale(image: Image.Image) -> Image.Image:
    """Convert to grayscale to remove color noise."""
    return image.convert("L")


def _enhance_contrast(image: Image.Image) -> Image.Image:
    """Boost contrast to improve text/background separation."""
    image = ImageOps.autocontrast(image, cutoff=1)
    enhancer = ImageEnhance.Contrast(image)
    return enhancer.enhance(1.5)


def _sharpen(image: Image.Image) -> Image.Image:
    """Sharpen image to make text edges crisper."""
    enhancer = ImageEnhance.Sharpness(image)
    return enhancer.enhance(2.0)


def _binarize(image: Image.Image) -> Image.Image:
    """Apply adaptive-like binarization for cleaner text.

    Compares each pixel against a locally-blurred version (Gaussian) of the
    image.  Pixels darker than the local mean minus an offset become black;
    the rest become white.  Uses PIL vectorised ops — no pixel loops.
    """
    if image.mode != "L":
        image = image.convert("L")

    blurred = image.filter(ImageFilter.GaussianBlur(radius=15))

    # diff = blurred - original (clamped to 0 by ImageChops)
    # Where diff > offset the pixel is darker than its neighbourhood → text
    diff = ImageChops.subtract(blurred, image)
    offset = 10
    result = diff.point(lambda x: 0 if x > offset else 255)
    return result
