from app.services.ocr_provider import DummyOCRProvider


class TestDummyOCRProvider:
    def test_returns_sample_text(self):
        provider = DummyOCRProvider()
        text = provider.extract_text("/fake/path.jpg")
        assert "サンプル株式会社" in text
        assert "合計" in text
        assert "11,000" in text

    def test_contains_tax_info(self):
        provider = DummyOCRProvider()
        text = provider.extract_text("/fake/path.jpg")
        assert "消費税" in text

    def test_contains_date(self):
        provider = DummyOCRProvider()
        text = provider.extract_text("/fake/path.jpg")
        assert "2026年01月15日" in text
