from datetime import date

from app.services.extract_provider import (
    RegexExtractProvider,
    _parse_amount,
    _extract_date,
    _extract_total_amount,
    _extract_tax_amount,
    _extract_subtotal,
    _extract_vendor_name,
    _extract_description,
)


class TestParseAmount:
    def test_yen_with_comma(self):
        assert _parse_amount("10,000") == 10000

    def test_yen_symbol(self):
        assert _parse_amount("¥1,500") == 1500

    def test_fullwidth_yen(self):
        assert _parse_amount("￥3,000") == 3000

    def test_plain_number(self):
        assert _parse_amount("500") == 500

    def test_with_en_suffix(self):
        assert _parse_amount("1,000円") == 1000

    def test_invalid_returns_none(self):
        assert _parse_amount("abc") is None


class TestExtractDate:
    def test_japanese_format(self):
        assert _extract_date("2026年01月15日") == date(2026, 1, 15)

    def test_japanese_no_leading_zero(self):
        assert _extract_date("2026年1月5日") == date(2026, 1, 5)

    def test_slash_format(self):
        assert _extract_date("日付: 2026/03/20") == date(2026, 3, 20)

    def test_dash_format(self):
        assert _extract_date("2025-12-31") == date(2025, 12, 31)

    def test_reiwa_era(self):
        # R8 = 2018 + 8 = 2026
        assert _extract_date("R8.01.15") == date(2026, 1, 15)

    def test_no_date_returns_none(self):
        assert _extract_date("no date here") is None

    def test_invalid_date_returns_none(self):
        assert _extract_date("2026年13月40日") is None


class TestExtractTotalAmount:
    def test_goukei_yen(self):
        assert _extract_total_amount("合計: ¥11,000") == 11000

    def test_goukei_no_yen(self):
        assert _extract_total_amount("合計:11000") == 11000

    def test_okaikei(self):
        assert _extract_total_amount("お会計 ¥5,500") == 5500

    def test_total_english(self):
        assert _extract_total_amount("Total: ¥3,300") == 3300

    def test_seikyuu(self):
        assert _extract_total_amount("ご請求額: ¥20,000") == 20000

    def test_no_total(self):
        assert _extract_total_amount("some random text") is None


class TestExtractTaxAmount:
    def test_consumption_tax(self):
        assert _extract_tax_amount("消費税(10%): ¥1,000") == 1000

    def test_tax_amount_label(self):
        assert _extract_tax_amount("税額: ¥500") == 500

    def test_uchizei(self):
        assert _extract_tax_amount("内税: ¥800") == 800

    def test_no_tax(self):
        assert _extract_tax_amount("no tax info") is None


class TestExtractSubtotal:
    def test_shoukei(self):
        assert _extract_subtotal("小計: ¥10,000") == 10000

    def test_no_subtotal(self):
        assert _extract_subtotal("no subtotal") is None


class TestExtractVendorName:
    def test_first_line(self):
        text = "サンプル株式会社\n2026年01月15日\n合計: ¥11,000"
        assert _extract_vendor_name(text) == "サンプル株式会社"

    def test_skips_date_line(self):
        text = "2026/01/15\nサンプルストア\n合計: ¥1,000"
        assert _extract_vendor_name(text) == "サンプルストア"

    def test_skips_amount_line(self):
        text = "¥10,000\nテスト商店\n小計"
        assert _extract_vendor_name(text) == "テスト商店"

    def test_skips_label_lines(self):
        text = "レシート\n合計\nサンプル商店"
        assert _extract_vendor_name(text) == "サンプル商店"

    def test_empty_returns_none(self):
        assert _extract_vendor_name("") is None

    def test_short_line_skipped(self):
        text = "A\nサンプル商店"
        assert _extract_vendor_name(text) == "サンプル商店"


class TestExtractDescription:
    def test_hinmoku(self):
        assert _extract_description("品目: 会議費") == "会議費"

    def test_hinmei(self):
        assert _extract_description("品名: コーヒー") == "コーヒー"

    def test_naiyou(self):
        assert _extract_description("内容: 交通費") == "交通費"

    def test_tekiyou(self):
        assert _extract_description("摘要: 打ち合わせ") == "打ち合わせ"

    def test_no_description(self):
        assert _extract_description("random text") is None


class TestRegexExtractProvider:
    def setup_method(self):
        self.provider = RegexExtractProvider()

    def test_full_receipt(self):
        text = (
            "サンプル株式会社\n"
            "2026年01月15日\n"
            "品目: 会議費\n"
            "小計: ¥10,000\n"
            "消費税(10%): ¥1,000\n"
            "合計: ¥11,000"
        )
        result = self.provider.extract(text)
        assert result.vendor_name == "サンプル株式会社"
        assert result.transaction_date == date(2026, 1, 15)
        assert result.total_amount == 11000
        assert result.tax_amount == 1000
        assert result.description == "会議費"

    def test_fallback_subtotal_plus_tax(self):
        text = (
            "テスト商店\n"
            "2025/06/01\n"
            "小計: ¥5,000\n"
            "消費税(10%): ¥500\n"
        )
        result = self.provider.extract(text)
        assert result.total_amount == 5500
        assert result.tax_amount == 500

    def test_fallback_largest_amount(self):
        text = (
            "テスト商店\n"
            "¥1,000\n"
            "¥3,000\n"
            "¥500\n"
        )
        result = self.provider.extract(text)
        assert result.total_amount == 3000

    def test_empty_text(self):
        result = self.provider.extract("")
        assert result.vendor_name is None
        assert result.transaction_date is None
        assert result.total_amount is None
        assert result.tax_amount is None
        assert result.description is None

    def test_whitespace_only(self):
        result = self.provider.extract("   \n  \n  ")
        assert result.vendor_name is None
