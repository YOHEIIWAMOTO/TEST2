import logging
import re
from datetime import date
from typing import Protocol

logger = logging.getLogger(__name__)


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


def _parse_amount(text: str) -> int | None:
    """Parse a Japanese-style amount string like '¥10,000' or '10000円' to int."""
    cleaned = re.sub(r"[¥￥,、\s円]", "", text)
    try:
        return int(cleaned)
    except ValueError:
        return None


def _extract_date(text: str) -> date | None:
    """Extract date from OCR text. Supports multiple Japanese date formats."""
    patterns = [
        # 2026年01月15日 or 2026年1月15日
        r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",
        # 2026/01/15 or 2026/1/15
        r"(\d{4})[/／](\d{1,2})[/／](\d{1,2})",
        # 2026-01-15
        r"(\d{4})-(\d{1,2})-(\d{1,2})",
        # R8.01.15 (Reiwa era, R=令和, year offset=2018)
        r"[RＲ令和]\s*(\d{1,2})[./．](\d{1,2})[./．](\d{1,2})",
    ]
    for i, pattern in enumerate(patterns):
        match = re.search(pattern, text)
        if match:
            try:
                if i == 3:
                    # Reiwa era
                    year = 2018 + int(match.group(1))
                    month = int(match.group(2))
                    day = int(match.group(3))
                else:
                    year = int(match.group(1))
                    month = int(match.group(2))
                    day = int(match.group(3))
                return date(year, month, day)
            except ValueError:
                continue
    return None


def _extract_total_amount(text: str) -> int | None:
    """Extract total amount. Looks for 合計, total, etc."""
    patterns = [
        # 合計: ¥11,000 or 合計 ¥11,000 or 合計:11,000 or 合計 11,000円
        r"合\s*計\s*[:：]?\s*[¥￥]?\s*([\d,，]+)\s*円?",
        # お会計 ¥11,000
        r"お\s*会\s*計\s*[:：]?\s*[¥￥]?\s*([\d,，]+)\s*円?",
        # Total: ¥11,000
        r"[Tt]otal\s*[:：]?\s*[¥￥]?\s*([\d,，]+)\s*円?",
        # ご請求額 ¥11,000
        r"ご?\s*請\s*求\s*額?\s*[:：]?\s*[¥￥]?\s*([\d,，]+)\s*円?",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            amount = _parse_amount(match.group(1))
            if amount and amount > 0:
                return amount
    return None


def _extract_tax_amount(text: str) -> int | None:
    """Extract tax amount from OCR text."""
    patterns = [
        # 消費税(10%): ¥1,000 or 消費税: ¥1,000
        r"消\s*費\s*税\s*(?:\(?\s*\d+\s*%?\s*\)?)?\s*[:：]?\s*[¥￥]?\s*([\d,，]+)\s*円?",
        # 税額: ¥1,000
        r"税\s*額\s*[:：]?\s*[¥￥]?\s*([\d,，]+)\s*円?",
        # 内税 ¥1,000
        r"内\s*税\s*[:：]?\s*[¥￥]?\s*([\d,，]+)\s*円?",
        # (税 ¥1,000)
        r"税\s*[¥￥]?\s*([\d,，]+)\s*円?",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            amount = _parse_amount(match.group(1))
            if amount is not None and amount >= 0:
                return amount
    return None


def _extract_subtotal(text: str) -> int | None:
    """Extract subtotal (小計) to use as fallback for total."""
    patterns = [
        r"小\s*計\s*[:：]?\s*[¥￥]?\s*([\d,，]+)\s*円?",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            amount = _parse_amount(match.group(1))
            if amount and amount > 0:
                return amount
    return None


def _extract_vendor_name(text: str) -> str | None:
    """Extract vendor name from the first meaningful line of OCR text."""
    lines = text.strip().split("\n")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Skip lines that look like dates, amounts, labels
        if re.match(r"^\d{4}[年/\-]", line):
            continue
        if re.match(r"^[¥￥\d,]+$", line):
            continue
        if re.match(r"^(合計|小計|消費税|税|内税|お会計|品目|日付|レシート|領収)", line):
            continue
        # Return first non-trivial line (likely vendor/store name)
        cleaned = re.sub(r"[\s　]+", " ", line).strip()
        if len(cleaned) >= 2:
            return cleaned[:100]  # limit length
    return None


def _extract_description(text: str) -> str | None:
    """Extract description/item category from OCR text."""
    patterns = [
        # 品目: 会議費
        r"品\s*目\s*[:：]\s*(.+)",
        # 品名: コーヒー
        r"品\s*名\s*[:：]\s*(.+)",
        # 内容: 交通費
        r"内\s*容\s*[:：]\s*(.+)",
        # 摘要: 打ち合わせ
        r"摘\s*要\s*[:：]\s*(.+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            desc = match.group(1).strip()
            if desc:
                return desc[:200]
    return None


class RegexExtractProvider:
    """Extract structured data from OCR text using regex patterns."""

    def extract(self, ocr_text: str) -> ExtractedData:
        if not ocr_text or not ocr_text.strip():
            return ExtractedData()

        transaction_date = _extract_date(ocr_text)
        total_amount = _extract_total_amount(ocr_text)
        tax_amount = _extract_tax_amount(ocr_text)
        vendor_name = _extract_vendor_name(ocr_text)
        description = _extract_description(ocr_text)

        # If no total found, try subtotal + tax
        if total_amount is None:
            subtotal = _extract_subtotal(ocr_text)
            if subtotal is not None:
                tax = tax_amount or 0
                total_amount = subtotal + tax

        # If still no total, try finding the largest amount as fallback
        if total_amount is None:
            amounts = re.findall(r"[¥￥]\s*([\d,，]+)", ocr_text)
            if amounts:
                parsed = [_parse_amount(a) for a in amounts]
                valid = [a for a in parsed if a is not None and a > 0]
                if valid:
                    total_amount = max(valid)

        return ExtractedData(
            vendor_name=vendor_name,
            transaction_date=transaction_date,
            total_amount=total_amount,
            tax_amount=tax_amount,
            description=description,
        )


class DummyExtractProvider:
    """Returns fixed sample data (for testing)."""

    def extract(self, ocr_text: str) -> ExtractedData:
        return ExtractedData(
            vendor_name="サンプル株式会社",
            transaction_date=date(2026, 1, 15),
            total_amount=11000,
            tax_amount=1000,
            description="会議費",
        )


def _create_provider() -> ExtractProvider:
    from app.config import settings

    if settings.extract_provider == "dummy":
        logger.info("Using DummyExtractProvider")
        return DummyExtractProvider()
    logger.info("Using RegexExtractProvider")
    return RegexExtractProvider()


extract_provider: ExtractProvider = _create_provider()
