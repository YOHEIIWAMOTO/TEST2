import csv
import io
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import Receipt, JournalEntry, ExportRun, ReceiptStatus
from app.services.storage import storage

MF_CSV_HEADERS = [
    "取引No",
    "取引日",
    "借方勘定科目",
    "借方補助科目",
    "借方部門",
    "借方取引先",
    "借方税区分",
    "借方インボイス",
    "借方金額",
    "借方税額",
    "貸方勘定科目",
    "貸方補助科目",
    "貸方部門",
    "貸方取引先",
    "貸方税区分",
    "貸方インボイス",
    "貸方金額",
    "貸方税額",
    "摘要",
    "仕訳メモ",
    "タグ",
    "MF仕訳タイプ",
    "決算整理仕訳",
    "作成日時",
    "作成者",
    "最終更新日時",
    "最終更新者",
]


def _generate_run_id() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _build_filename(run_id: str, db: Session) -> str:
    base = f"export_{run_id}"
    existing = db.query(ExportRun).filter(ExportRun.id.like(f"{run_id}%")).count()
    if existing > 0:
        return f"{base}_{existing + 1}.csv"
    return f"{base}.csv"


def _journal_to_row(
    transaction_no: int,
    receipt: Receipt,
    entry: JournalEntry,
    now_str: str,
) -> list[str]:
    tx_date = ""
    if receipt.transaction_date:
        tx_date = receipt.transaction_date.strftime("%Y/%m/%d")

    return [
        str(transaction_no),
        tx_date,
        entry.debit_account or "",
        entry.debit_sub_account or "",
        entry.debit_department or "",
        entry.debit_partner or "",
        entry.debit_tax_class or "",
        entry.debit_invoice or "",
        str(entry.debit_amount),
        str(entry.debit_tax_amount),
        entry.credit_account or "",
        entry.credit_sub_account or "",
        entry.credit_department or "",
        entry.credit_partner or "",
        entry.credit_tax_class or "",
        entry.credit_invoice or "",
        str(entry.credit_amount),
        str(entry.credit_tax_amount),
        entry.description or "",
        entry.memo or "",
        entry.tag or "",
        "",
        "",
        now_str,
        "receipt-ocr-app",
        now_str,
        "receipt-ocr-app",
    ]


def export_approved_receipts(db: Session) -> ExportRun:
    receipts = (
        db.query(Receipt)
        .filter(Receipt.status == ReceiptStatus.approved)
        .order_by(Receipt.transaction_date)
        .all()
    )

    if not receipts:
        raise ValueError("No approved receipts to export")

    run_id = _generate_run_id()
    filename = _build_filename(run_id, db)
    now_str = datetime.now().strftime("%Y/%m/%d %H:%M:%S")

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_ALL)
    writer.writerow(MF_CSV_HEADERS)

    transaction_no = 1
    for receipt in receipts:
        for entry in receipt.journal_entries:
            row = _journal_to_row(transaction_no, receipt, entry, now_str)
            writer.writerow(row)
            transaction_no += 1

    csv_bytes = output.getvalue().encode("utf-8-sig")
    storage.save_export_csv(filename, csv_bytes)

    export_run = ExportRun(
        id=run_id,
        receipt_count=len(receipts),
        filename=filename,
        status="completed",
    )
    for receipt in receipts:
        export_run.receipts.append(receipt)

    db.add(export_run)
    db.commit()
    db.refresh(export_run)

    return export_run
