"""Image preprocessing pipeline to improve OCR accuracy.

Applies the following steps (all using Pillow, no OpenCV dependency):
1. EXIF auto-rotation  – fix phone camera orientation
2. Up-scale small images – Tesseract needs ~300 DPI to work well
3. Grayscale conversion – remove color noise
4. Denoise             – median filter to remove speckle noise
5. Contrast enhancement – improve text/background separation
6. Sharpening          – make edges crisper for OCR
7. Binarization        – adaptive thresholding for cleaner text
"""

import logging
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)

# Minimum height in pixels; smaller images get upscaled for better OCR
_MIN_HEIGHT = 1500


def preprocess_for_ocr(image: Image.Image) -> Image.Image:
    """Run the full preprocessing pipeline and return the cleaned image."""
    try:
        image = _fix_orientation(image)
        image = _upscale_if_small(image)
        image = _to_grayscale(image)
        image = _denoise(image)
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


def _upscale_if_small(image: Image.Image) -> Image.Image:
    """Up-scale images that are too small for reliable OCR.

    Tesseract works best at ~300 DPI.  Low-res phone crops or screenshots
    often have heights below 1000px, making characters too small.  We scale
    up using LANCZOS (high-quality) to give Tesseract more pixels to work with.
    """
    w, h = image.size
    if h < _MIN_HEIGHT:
        scale = _MIN_HEIGHT / h
        new_w = int(w * scale)
        new_h = int(h * scale)
        image = image.resize((new_w, new_h), Image.LANCZOS)
        logger.debug("Upscaled image from %dx%d to %dx%d", w, h, new_w, new_h)
    return image


def _to_grayscale(image: Image.Image) -> Image.Image:
    """Convert to grayscale to remove color noise."""
    return image.convert("L")


def _denoise(image: Image.Image) -> Image.Image:
    """Remove speckle noise with a median filter (preserves edges)."""
    return image.filter(ImageFilter.MedianFilter(size=3))


def _enhance_contrast(image: Image.Image) -> Image.Image:
    """Boost contrast to improve text/background separation."""
    image = ImageOps.autocontrast(image, cutoff=2)
    enhancer = ImageEnhance.Contrast(image)
    return enhancer.enhance(1.8)


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

    # Use a larger radius for upscaled images to capture broader local context
    w, h = image.size
    radius = max(15, min(w, h) // 50)

    blurred = image.filter(ImageFilter.GaussianBlur(radius=radius))

    # diff = blurred - original (clamped to 0 by ImageChops)
    # Where diff > offset the pixel is darker than its neighbourhood → text
    diff = ImageChops.subtract(blurred, image)
    offset = 8
    result = diff.point(lambda x: 0 if x > offset else 255)
    return result
