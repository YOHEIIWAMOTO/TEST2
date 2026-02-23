from typing import Protocol


class OCRProvider(Protocol):
    def extract_text(self, image_path: str) -> str: ...


class DummyOCRProvider:
    def extract_text(self, image_path: str) -> str:
        return (
            "サンプル株式会社\n"
            "2026年01月15日\n"
            "品目: 会議費\n"
            "小計: ¥10,000\n"
            "消費税(10%): ¥1,000\n"
            "合計: ¥11,000"
        )


ocr_provider: OCRProvider = DummyOCRProvider()
