import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from app.services.learned_rules import (
    learn_from_approval,
    lookup_vendor_rule,
    lookup_keyword_rule,
    get_all_learned_rules,
    _normalize_vendor,
    _empty_store,
)


def _temp_store(tmp_path: Path):
    """Patch _STORE_PATH to use a temp file."""
    return patch("app.services.learned_rules._STORE_PATH", tmp_path / "learned_rules.json")


class TestNormalizeVendor:
    def test_lowercase_and_strip(self):
        assert _normalize_vendor("  Starbucks  ") == "starbucks"

    def test_japanese(self):
        assert _normalize_vendor("サンプル株式会社") == "サンプル株式会社"


class TestLearnFromApproval:
    def test_learn_new_vendor(self, tmp_path):
        with _temp_store(tmp_path):
            learn_from_approval(
                vendor_name="タクシー太郎",
                description=None,
                debit_account="旅費交通費",
                credit_account="未払金",
                debit_tax_class="課税仕入 10%",
            )
            store_path = tmp_path / "learned_rules.json"
            assert store_path.exists()
            data = json.loads(store_path.read_text("utf-8"))
            key = "タクシー太郎"
            assert key in data["vendor_rules"]
            assert data["vendor_rules"][key]["debit_account"] == "旅費交通費"
            assert data["vendor_rules"][key]["count"] == 1

    def test_learn_increments_count(self, tmp_path):
        with _temp_store(tmp_path):
            for _ in range(3):
                learn_from_approval(
                    vendor_name="繰り返し店",
                    description=None,
                    debit_account="消耗品費",
                    credit_account="未払金",
                    debit_tax_class="課税仕入 10%",
                )
            data = json.loads((tmp_path / "learned_rules.json").read_text("utf-8"))
            assert data["vendor_rules"]["繰り返し店"]["count"] == 3

    def test_learn_overwrites_on_different_account(self, tmp_path):
        with _temp_store(tmp_path):
            learn_from_approval("店A", None, "消耗品費", "未払金", None)
            learn_from_approval("店A", None, "会議費", "未払金", None)
            data = json.loads((tmp_path / "learned_rules.json").read_text("utf-8"))
            # Should overwrite with the new account
            assert data["vendor_rules"]["店a"]["debit_account"] == "会議費"
            assert data["vendor_rules"]["店a"]["count"] == 1

    def test_learn_skips_none_vendor(self, tmp_path):
        with _temp_store(tmp_path):
            learn_from_approval(None, None, "雑費", "未払金", None)
            store_path = tmp_path / "learned_rules.json"
            assert not store_path.exists()


class TestLookupVendorRule:
    def test_found(self, tmp_path):
        with _temp_store(tmp_path):
            learn_from_approval("テスト商店", None, "消耗品費", "未払金", "課税仕入 10%")
            rule = lookup_vendor_rule("テスト商店")
            assert rule is not None
            assert rule["debit_account"] == "消耗品費"

    def test_not_found(self, tmp_path):
        with _temp_store(tmp_path):
            rule = lookup_vendor_rule("存在しない店")
            assert rule is None

    def test_none_vendor(self, tmp_path):
        with _temp_store(tmp_path):
            rule = lookup_vendor_rule(None)
            assert rule is None

    def test_case_insensitive(self, tmp_path):
        with _temp_store(tmp_path):
            learn_from_approval("ABC Store", None, "消耗品費", "未払金", None)
            rule = lookup_vendor_rule("abc store")
            assert rule is not None


class TestLookupKeywordRule:
    def test_empty_returns_none(self, tmp_path):
        with _temp_store(tmp_path):
            assert lookup_keyword_rule(None, None) is None

    def test_no_keywords_returns_none(self, tmp_path):
        with _temp_store(tmp_path):
            assert lookup_keyword_rule("something", "other") is None


class TestGetAllLearnedRules:
    def test_empty_store(self, tmp_path):
        with _temp_store(tmp_path):
            result = get_all_learned_rules()
            assert result == {"vendor_rules": {}, "keyword_rules": {}}

    def test_with_data(self, tmp_path):
        with _temp_store(tmp_path):
            learn_from_approval("店X", None, "雑費", "未払金", None)
            result = get_all_learned_rules()
            assert "店x" in result["vendor_rules"]
