import csv
import io
from datetime import date, datetime
from unittest.mock import patch, MagicMock

from app.models import Receipt, JournalEntry, ExportRun, ReceiptStatus
from app.services.csv_exporter import (
    MF_CSV_HEADERS,
    _journal_to_row,
    export_approved_receipts,
)


class TestJournalToRow:
    def _make_receipt(self, tx_date=None):
        r = MagicMock(spec=Receipt)
        r.transaction_date = tx_date
        return r

    def _make_entry(self, **overrides):
        defaults = dict(
            debit_account="旅費交通費",
            debit_sub_account=None,
            debit_department=None,
            debit_partner="テスト会社",
            debit_tax_class="課税仕入 10%",
            debit_invoice="適格",
            debit_amount=5000,
            debit_tax_amount=500,
            credit_account="未払金",
            credit_sub_account=None,
            credit_department=None,
            credit_partner=None,
            credit_tax_class=None,
            credit_invoice=None,
            credit_amount=5000,
            credit_tax_amount=500,
            description="交通費 テスト会社",
            memo=None,
            tag=None,
        )
        defaults.update(overrides)
        entry = MagicMock(spec=JournalEntry)
        for k, v in defaults.items():
            setattr(entry, k, v)
        return entry

    def test_row_length_matches_headers(self):
        receipt = self._make_receipt(date(2026, 1, 15))
        entry = self._make_entry()
        row = _journal_to_row(1, receipt, entry, "2026/01/15 10:00:00")
        assert len(row) == len(MF_CSV_HEADERS)

    def test_transaction_date_formatted(self):
        receipt = self._make_receipt(date(2026, 3, 20))
        entry = self._make_entry()
        row = _journal_to_row(1, receipt, entry, "2026/01/15 10:00:00")
        assert row[1] == "2026/03/20"

    def test_none_date_empty_string(self):
        receipt = self._make_receipt(None)
        entry = self._make_entry()
        row = _journal_to_row(1, receipt, entry, "2026/01/15 10:00:00")
        assert row[1] == ""

    def test_amounts_as_strings(self):
        receipt = self._make_receipt(date(2026, 1, 1))
        entry = self._make_entry(debit_amount=10000, credit_amount=10000)
        row = _journal_to_row(1, receipt, entry, "now")
        assert row[8] == "10000"  # debit amount
        assert row[16] == "10000"  # credit amount

    def test_none_fields_become_empty(self):
        receipt = self._make_receipt(date(2026, 1, 1))
        entry = self._make_entry(
            debit_sub_account=None,
            debit_department=None,
            credit_partner=None,
            memo=None,
            tag=None,
        )
        row = _journal_to_row(1, receipt, entry, "now")
        assert row[3] == ""   # debit sub account
        assert row[4] == ""   # debit department
        assert row[13] == ""  # credit partner
        assert row[19] == ""  # memo
        assert row[20] == ""  # tag

    def test_transaction_no(self):
        receipt = self._make_receipt(date(2026, 1, 1))
        entry = self._make_entry()
        row = _journal_to_row(42, receipt, entry, "now")
        assert row[0] == "42"


class TestExportApprovedReceipts:
    def test_no_approved_raises(self, db):
        with patch("app.services.csv_exporter.storage"):
            import pytest
            with pytest.raises(ValueError, match="No approved receipts"):
                export_approved_receipts(db)

    def test_export_creates_csv(self, db):
        # Create an approved receipt with journal entry
        receipt = Receipt(
            id="TEST_EXP_001",
            status=ReceiptStatus.approved,
            original_filename="test.jpg",
            file_extension=".jpg",
            transaction_date=date(2026, 1, 15),
        )
        journal = JournalEntry(
            receipt_id="TEST_EXP_001",
            line_no=1,
            debit_account="旅費交通費",
            debit_amount=5000,
            debit_tax_amount=500,
            credit_account="未払金",
            credit_amount=5000,
            credit_tax_amount=500,
            description="テスト仕訳",
        )
        receipt.journal_entries.append(journal)
        db.add(receipt)
        db.commit()

        saved_content = None

        def mock_save_csv(filename, content):
            nonlocal saved_content
            saved_content = content
            return f"/tmp/{filename}"

        with patch("app.services.csv_exporter.storage") as mock_storage:
            mock_storage.save_export_csv.side_effect = mock_save_csv
            result = export_approved_receipts(db)

        assert result.receipt_count == 1
        assert result.status == "completed"
        assert saved_content is not None

        # Verify CSV content
        text = saved_content.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        assert rows[0] == MF_CSV_HEADERS  # header row
        assert len(rows) == 2  # header + 1 data row
        assert rows[1][2] == "旅費交通費"  # debit account
        assert rows[1][8] == "5000"  # debit amount

    def test_export_multiple_receipts(self, db):
        for i in range(3):
            receipt = Receipt(
                id=f"MULTI_{i:03d}",
                status=ReceiptStatus.approved,
                original_filename=f"test{i}.jpg",
                file_extension=".jpg",
                transaction_date=date(2026, 1, i + 1),
            )
            journal = JournalEntry(
                receipt_id=f"MULTI_{i:03d}",
                line_no=1,
                debit_account="雑費",
                debit_amount=1000 * (i + 1),
                debit_tax_amount=100 * (i + 1),
                credit_account="未払金",
                credit_amount=1000 * (i + 1),
                credit_tax_amount=100 * (i + 1),
                description=f"テスト{i}",
            )
            receipt.journal_entries.append(journal)
            db.add(receipt)
        db.commit()

        with patch("app.services.csv_exporter.storage") as mock_storage:
            mock_storage.save_export_csv.return_value = "/tmp/test.csv"
            result = export_approved_receipts(db)

        assert result.receipt_count == 3

    def test_non_approved_excluded(self, db):
        # Only approved receipts should be exported
        for status in [ReceiptStatus.uploaded, ReceiptStatus.needs_review, ReceiptStatus.rejected]:
            receipt = Receipt(
                id=f"EXCL_{status.value}",
                status=status,
                original_filename="test.jpg",
                file_extension=".jpg",
            )
            db.add(receipt)

        approved = Receipt(
            id="ONLY_APPROVED",
            status=ReceiptStatus.approved,
            original_filename="approved.jpg",
            file_extension=".jpg",
            transaction_date=date(2026, 1, 1),
        )
        journal = JournalEntry(
            receipt_id="ONLY_APPROVED",
            line_no=1,
            debit_account="雑費",
            debit_amount=1000,
            debit_tax_amount=100,
            credit_account="未払金",
            credit_amount=1000,
            credit_tax_amount=100,
            description="テスト",
        )
        approved.journal_entries.append(journal)
        db.add(approved)
        db.commit()

        with patch("app.services.csv_exporter.storage") as mock_storage:
            mock_storage.save_export_csv.return_value = "/tmp/test.csv"
            result = export_approved_receipts(db)

        assert result.receipt_count == 1

    def test_csv_utf8_bom(self, db):
        receipt = Receipt(
            id="BOM_TEST",
            status=ReceiptStatus.approved,
            original_filename="test.jpg",
            file_extension=".jpg",
            transaction_date=date(2026, 1, 1),
        )
        journal = JournalEntry(
            receipt_id="BOM_TEST",
            line_no=1,
            debit_account="雑費",
            debit_amount=1000,
            debit_tax_amount=100,
            credit_account="未払金",
            credit_amount=1000,
            credit_tax_amount=100,
            description="テスト",
        )
        receipt.journal_entries.append(journal)
        db.add(receipt)
        db.commit()

        saved_content = None

        def mock_save_csv(filename, content):
            nonlocal saved_content
            saved_content = content
            return f"/tmp/{filename}"

        with patch("app.services.csv_exporter.storage") as mock_storage:
            mock_storage.save_export_csv.side_effect = mock_save_csv
            export_approved_receipts(db)

        # UTF-8 BOM starts with EF BB BF
        assert saved_content[:3] == b"\xef\xbb\xbf"
