from typing import Protocol
from datetime import date


class ExtractedData:
    def __init__(
        self,
        vendor_name: str | None = None,
        transaction_date: date | None = None,
        total_amount: int | None = None,
        tax_amount: int | None = None,
        description: str | None = None,
    ):
        self.vendor_name = vendor_name
        self.transaction_date = transaction_date
        self.total_amount = total_amount
        self.tax_amount = tax_amount
        self.description = description


class ExtractProvider(Protocol):
    def extract(self, ocr_text: str) -> ExtractedData: ...


class DummyExtractProvider:
    def extract(self, ocr_text: str) -> ExtractedData:
        return ExtractedData(
            vendor_name="サンプル株式会社",
            transaction_date=date(2026, 1, 15),
            total_amount=11000,
            tax_amount=1000,
            description="会議費",
        )


extract_provider: ExtractProvider = DummyExtractProvider()
