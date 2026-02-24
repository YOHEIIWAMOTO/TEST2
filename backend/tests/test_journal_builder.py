from app.services.journal_builder import _match_rule, build_journal_entry


SAMPLE_RULES = [
    {"keyword": "タクシー", "debit_account": "旅費交通費", "credit_account": "未払金", "debit_tax_class": "課税仕入 10%", "description_template": "交通費 {vendor_name}"},
    {"keyword": "コンビニ", "debit_account": "消耗品費", "credit_account": "未払金", "debit_tax_class": "課税仕入 10%", "description_template": "消耗品 {vendor_name}"},
    {"keyword": "飲食", "debit_account": "会議費", "credit_account": "未払金", "debit_tax_class": "課税仕入 10%", "description_template": "会議費 {vendor_name}"},
    {"keyword": "default", "debit_account": "雑費", "credit_account": "未払金", "debit_tax_class": "課税仕入 10%", "description_template": "経費 {vendor_name}"},
]


class TestMatchRule:
    def test_exact_keyword_match(self):
        rule = _match_rule("タクシー会社", None, SAMPLE_RULES)
        assert rule["debit_account"] == "旅費交通費"

    def test_keyword_in_description(self):
        rule = _match_rule(None, "コンビニで購入", SAMPLE_RULES)
        assert rule["debit_account"] == "消耗品費"

    def test_case_insensitive(self):
        # Japanese doesn't have case, but test the logic with vendor+desc
        rule = _match_rule("飲食店", "ランチ", SAMPLE_RULES)
        assert rule["debit_account"] == "会議費"

    def test_default_rule(self):
        rule = _match_rule("不明な店", "不明な品目", SAMPLE_RULES)
        assert rule["keyword"] == "default"
        assert rule["debit_account"] == "雑費"

    def test_none_inputs_use_default(self):
        rule = _match_rule(None, None, SAMPLE_RULES)
        assert rule["keyword"] == "default"

    def test_first_match_wins(self):
        # If vendor contains multiple keywords, first in rules list wins
        rule = _match_rule("タクシーコンビニ", None, SAMPLE_RULES)
        assert rule["debit_account"] == "旅費交通費"


class TestBuildJournalEntry:
    def test_basic_entry(self):
        entry = build_journal_entry(
            receipt_id="TEST123",
            vendor_name="テストタクシー",
            transaction_date=None,
            total_amount=5000,
            tax_amount=500,
            description=None,
        )
        assert entry.receipt_id == "TEST123"
        assert entry.debit_account == "旅費交通費"
        assert entry.credit_account == "未払金"
        assert entry.debit_amount == 5000
        assert entry.credit_amount == 5000
        assert entry.debit_tax_amount == 500
        assert entry.credit_tax_amount == 500
        assert "テストタクシー" in entry.description
        assert "TEST123" in entry.description

    def test_balanced_debit_credit(self):
        entry = build_journal_entry(
            receipt_id="BAL001",
            vendor_name="テスト商店",
            transaction_date=None,
            total_amount=10000,
            tax_amount=1000,
            description="テスト",
        )
        assert entry.debit_amount == entry.credit_amount
        assert entry.debit_tax_amount == entry.credit_tax_amount

    def test_none_amounts_default_to_zero(self):
        entry = build_journal_entry(
            receipt_id="ZERO001",
            vendor_name=None,
            transaction_date=None,
            total_amount=None,
            tax_amount=None,
            description=None,
        )
        assert entry.debit_amount == 0
        assert entry.credit_amount == 0
        assert entry.debit_tax_amount == 0
        assert entry.credit_tax_amount == 0

    def test_vendor_none_shows_fumei(self):
        entry = build_journal_entry(
            receipt_id="VEN001",
            vendor_name=None,
            transaction_date=None,
            total_amount=1000,
            tax_amount=100,
            description=None,
        )
        assert "不明" in entry.description

    def test_description_truncated(self):
        entry = build_journal_entry(
            receipt_id="TRUNC001",
            vendor_name="A" * 300,
            transaction_date=None,
            total_amount=1000,
            tax_amount=100,
            description=None,
        )
        assert len(entry.description) <= 200

    def test_default_rule_for_unknown(self):
        entry = build_journal_entry(
            receipt_id="DEF001",
            vendor_name="未知の店",
            transaction_date=None,
            total_amount=3000,
            tax_amount=300,
            description="不明な品目",
        )
        assert entry.debit_account == "雑費"

    def test_invoice_field_set(self):
        entry = build_journal_entry(
            receipt_id="INV001",
            vendor_name="テスト",
            transaction_date=None,
            total_amount=1000,
            tax_amount=100,
            description=None,
        )
        assert entry.debit_invoice == "適格"
        assert entry.credit_invoice is None
