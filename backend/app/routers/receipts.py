from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ulid import ULID

from app.database import get_db
from app.models import Receipt, JournalEntry, ReceiptStatus
from app.schemas import (
    ReceiptSummary, ReceiptDetail, ReceiptUpdateWithJournal,
    BulkApproveRequest, BulkApproveResponse,
)
from app.services.storage import storage
from app.services.ocr_provider import ocr_provider
from app.services.extract_provider import extract_provider
from app.services.journal_builder import build_journal_entry

router = APIRouter(prefix="/api/receipts", tags=["receipts"])


@router.post("/upload", response_model=list[ReceiptSummary])
async def upload_receipts(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    results = []
    for file in files:
        receipt_id = str(ULID())
        ext = ""
        if file.filename:
            ext = "." + file.filename.rsplit(".", 1)[-1] if "." in file.filename else ""

        storage.save_receipt_image(receipt_id, ext, file.file)
        file.file.seek(0)

        receipt = Receipt(
            id=receipt_id,
            status=ReceiptStatus.uploaded,
            original_filename=file.filename or "unknown",
            file_extension=ext,
        )
        db.add(receipt)
        db.flush()

        image_path = storage.get_receipt_image_path(receipt_id, ext)
        ocr_text = ocr_provider.extract_text(image_path)
        receipt.ocr_text = ocr_text
        receipt.status = ReceiptStatus.ocr_done

        extracted = extract_provider.extract(ocr_text)
        receipt.vendor_name = extracted.vendor_name
        receipt.transaction_date = extracted.transaction_date
        receipt.total_amount = extracted.total_amount
        receipt.tax_amount = extracted.tax_amount
        receipt.description = extracted.description
        receipt.status = ReceiptStatus.extracted

        journal_entry = build_journal_entry(
            receipt_id=receipt_id,
            vendor_name=extracted.vendor_name,
            transaction_date=extracted.transaction_date,
            total_amount=extracted.total_amount,
            tax_amount=extracted.tax_amount,
            description=extracted.description,
        )
        db.add(journal_entry)

        receipt.status = ReceiptStatus.needs_review
        results.append(receipt)

    db.commit()
    for r in results:
        db.refresh(r)
    return results


@router.get("", response_model=list[ReceiptSummary])
def list_receipts(
    status: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Receipt).order_by(Receipt.uploaded_at.desc())
    if status:
        query = query.filter(Receipt.status == status)
    return query.all()


@router.get("/{receipt_id}", response_model=ReceiptDetail)
def get_receipt(receipt_id: str, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.get("/{receipt_id}/image")
def get_receipt_image(receipt_id: str, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    image_path = storage.get_receipt_image_path(receipt_id, receipt.file_extension)
    return FileResponse(
        image_path,
        media_type=f"image/{receipt.file_extension.lstrip('.')}",
    )


@router.patch("/{receipt_id}", response_model=ReceiptDetail)
def update_receipt(
    receipt_id: str,
    body: ReceiptUpdateWithJournal,
    db: Session = Depends(get_db),
):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if receipt.status == ReceiptStatus.approved:
        raise HTTPException(status_code=400, detail="Cannot edit approved receipt")

    update_data = body.model_dump(exclude_unset=True, exclude={"journal_entries"})
    for key, value in update_data.items():
        setattr(receipt, key, value)

    if body.journal_entries is not None:
        db.query(JournalEntry).filter(
            JournalEntry.receipt_id == receipt_id
        ).delete()
        for je_data in body.journal_entries:
            je = JournalEntry(
                receipt_id=receipt_id,
                **je_data.model_dump(exclude={"id", "receipt_id"}),
            )
            db.add(je)

    db.commit()
    db.refresh(receipt)
    return receipt


@router.post("/{receipt_id}/approve", response_model=ReceiptDetail)
def approve_receipt(receipt_id: str, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if receipt.status == ReceiptStatus.approved:
        raise HTTPException(status_code=400, detail="Already approved")
    if not receipt.journal_entries:
        raise HTTPException(status_code=400, detail="No journal entries to approve")

    receipt.status = ReceiptStatus.approved
    db.commit()
    db.refresh(receipt)
    return receipt


@router.post("/{receipt_id}/reject", response_model=ReceiptDetail)
def reject_receipt(receipt_id: str, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if receipt.status == ReceiptStatus.approved:
        raise HTTPException(status_code=400, detail="Cannot reject approved receipt")

    receipt.status = ReceiptStatus.rejected
    db.commit()
    db.refresh(receipt)
    return receipt


@router.post("/approve-bulk", response_model=BulkApproveResponse)
def approve_bulk(body: BulkApproveRequest, db: Session = Depends(get_db)):
    approved = []
    errors = []
    for rid in body.receipt_ids:
        receipt = db.query(Receipt).filter(Receipt.id == rid).first()
        if not receipt:
            errors.append(f"{rid}: not found")
            continue
        if receipt.status == ReceiptStatus.approved:
            errors.append(f"{rid}: already approved")
            continue
        if not receipt.journal_entries:
            errors.append(f"{rid}: no journal entries")
            continue
        receipt.status = ReceiptStatus.approved
        approved.append(rid)

    db.commit()
    return BulkApproveResponse(approved=approved, errors=errors)
