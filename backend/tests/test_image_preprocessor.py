from PIL import Image

from app.services.image_preprocessor import (
    preprocess_for_ocr,
    _fix_orientation,
    _to_grayscale,
    _enhance_contrast,
    _sharpen,
    _binarize,
)


def _make_test_image(mode: str = "RGB", size: tuple = (100, 100)) -> Image.Image:
    """Create a simple test image."""
    return Image.new(mode, size, color=128)


class TestPreprocessForOcr:
    def test_returns_image(self):
        img = _make_test_image()
        result = preprocess_for_ocr(img)
        assert isinstance(result, Image.Image)

    def test_output_is_grayscale_or_binary(self):
        img = _make_test_image()
        result = preprocess_for_ocr(img)
        assert result.mode == "L"

    def test_handles_rgba(self):
        img = _make_test_image("RGBA")
        result = preprocess_for_ocr(img)
        assert isinstance(result, Image.Image)

    def test_handles_palette_mode(self):
        img = _make_test_image("RGB").convert("P")
        result = preprocess_for_ocr(img)
        assert isinstance(result, Image.Image)

    def test_preserves_size(self):
        img = _make_test_image("RGB", (200, 300))
        result = preprocess_for_ocr(img)
        assert result.size == (200, 300)


class TestFixOrientation:
    def test_no_exif_data(self):
        img = _make_test_image()
        result = _fix_orientation(img)
        assert result.size == img.size

    def test_grayscale_input(self):
        img = _make_test_image("L")
        result = _fix_orientation(img)
        assert result.mode == "L"


class TestToGrayscale:
    def test_rgb_to_grayscale(self):
        img = _make_test_image("RGB")
        result = _to_grayscale(img)
        assert result.mode == "L"

    def test_already_grayscale(self):
        img = _make_test_image("L")
        result = _to_grayscale(img)
        assert result.mode == "L"


class TestEnhanceContrast:
    def test_returns_same_mode(self):
        img = _make_test_image("L")
        result = _enhance_contrast(img)
        assert result.mode == "L"

    def test_returns_same_size(self):
        img = _make_test_image("L", (150, 200))
        result = _enhance_contrast(img)
        assert result.size == (150, 200)


class TestSharpen:
    def test_returns_same_mode(self):
        img = _make_test_image("L")
        result = _sharpen(img)
        assert result.mode == "L"


class TestBinarize:
    def test_output_is_binary(self):
        """All pixels should be either 0 (black) or 255 (white)."""
        img = _make_test_image("L")
        result = _binarize(img)
        pixels = set(list(result.getdata()))
        assert pixels.issubset({0, 255})

    def test_dark_text_on_light_bg(self):
        """Dark region on white background should produce black pixels."""
        img = Image.new("L", (100, 100), 255)
        # Draw a dark rectangle in the center
        pixels = img.load()
        for y in range(30, 70):
            for x in range(30, 70):
                pixels[x, y] = 20
        result = _binarize(img)
        # Center pixel should be black (text)
        assert result.getpixel((50, 50)) == 0

    def test_uniform_image(self):
        """Uniform image should produce all white (no text detected)."""
        img = Image.new("L", (100, 100), 128)
        result = _binarize(img)
        pixels = set(list(result.getdata()))
        assert pixels == {255}
