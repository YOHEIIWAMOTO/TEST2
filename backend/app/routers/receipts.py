import logging

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ulid import ULID

from app.database import get_db
from app.models import Receipt, JournalEntry, ReceiptStatus
from app.schemas import (
    ReceiptSummary, ReceiptDetail, ReceiptUpdateWithJournal,
    BulkApproveRequest, BulkApproveResponse,
    BulkDeleteRequest, BulkDeleteResponse,
)
from app.services.storage import storage
from app.services.ocr_provider import ocr_provider
from app.services.extract_provider import extract_provider
from app.services.journal_builder import build_journal_entry
from app.services.learned_rules import learn_from_approval

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/receipts", tags=["receipts"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


def _validate_upload_file(file: UploadFile) -> str:
    """Validate uploaded file and return its extension."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    ext = ""
    if "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Check content type
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"Invalid content type: {file.content_type}")

    # Check file size (read and check)
    content = file.file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {len(content)} bytes (max {MAX_FILE_SIZE} bytes)",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    file.file.seek(0)

    return ext


@router.post("/upload", response_model=list[ReceiptSummary])
async def upload_receipts(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per upload")

    results = []
    for file in files:
        ext = _validate_upload_file(file)
        receipt_id = str(ULID())

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

        # OCR processing
        image_path = storage.get_receipt_image_path(receipt_id, ext)
        try:
            ocr_text = ocr_provider.extract_text(image_path)
        except Exception as e:
            logger.error("OCR failed for receipt %s: %s", receipt_id, e)
            ocr_text = ""
        receipt.ocr_text = ocr_text
        receipt.status = ReceiptStatus.ocr_done

        # Data extraction
        extracted = extract_provider.extract(ocr_text)
        receipt.vendor_name = extracted.vendor_name
        receipt.transaction_date = extracted.transaction_date
        receipt.total_amount = extracted.total_amount
        receipt.tax_amount = extracted.tax_amount
        receipt.description = extracted.description
        receipt.status = ReceiptStatus.extracted

        # Build journal entry
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
        # Validate status value
        valid_statuses = {s.value for s in ReceiptStatus}
        if status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status}. Valid values: {', '.join(sorted(valid_statuses))}",
            )
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
    ext = receipt.file_extension.lstrip(".")
    media_types = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "gif": "image/gif",
        "bmp": "image/bmp", "tiff": "image/tiff", "tif": "image/tiff",
        "webp": "image/webp",
    }
    media_type = media_types.get(ext, f"image/{ext}")
    return FileResponse(image_path, media_type=media_type)


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

    # Validate numeric fields
    if "total_amount" in update_data and update_data["total_amount"] is not None:
        if update_data["total_amount"] < 0:
            raise HTTPException(status_code=400, detail="Total amount cannot be negative")
    if "tax_amount" in update_data and update_data["tax_amount"] is not None:
        if update_data["tax_amount"] < 0:
            raise HTTPException(status_code=400, detail="Tax amount cannot be negative")

    for key, value in update_data.items():
        setattr(receipt, key, value)

    if body.journal_entries is not None:
        # Validate journal entries
        for je_data in body.journal_entries:
            if je_data.debit_amount < 0 or je_data.credit_amount < 0:
                raise HTTPException(status_code=400, detail="Journal amounts cannot be negative")

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
    if receipt.status not in (ReceiptStatus.needs_review, ReceiptStatus.rejected):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve receipt in '{receipt.status}' status",
        )
    if not receipt.journal_entries:
        raise HTTPException(status_code=400, detail="No journal entries to approve")

    receipt.status = ReceiptStatus.approved
    db.commit()
    db.refresh(receipt)

    # Learn from the approved mapping for future auto-classification
    _learn_from_receipt(receipt)

    return receipt


def _learn_from_receipt(receipt: Receipt) -> None:
    """Record vendor→account mapping from an approved receipt."""
    try:
        if receipt.journal_entries:
            je = receipt.journal_entries[0]
            learn_from_approval(
                vendor_name=receipt.vendor_name,
                description=receipt.description,
                debit_account=je.debit_account,
                credit_account=je.credit_account,
                debit_tax_class=je.debit_tax_class,
            )
    except Exception as e:
        logger.warning("Failed to learn from receipt %s: %s", receipt.id, e)


@router.post("/{receipt_id}/reject", response_model=ReceiptDetail)
def reject_receipt(receipt_id: str, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if receipt.status == ReceiptStatus.approved:
        raise HTTPException(status_code=400, detail="Cannot reject approved receipt")
    if receipt.status not in (ReceiptStatus.needs_review, ReceiptStatus.extracted):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject receipt in '{receipt.status}' status",
        )

    receipt.status = ReceiptStatus.rejected
    db.commit()
    db.refresh(receipt)
    return receipt


@router.post("/approve-bulk", response_model=BulkApproveResponse)
def approve_bulk(body: BulkApproveRequest, db: Session = Depends(get_db)):
    if not body.receipt_ids:
        raise HTTPException(status_code=400, detail="No receipt IDs provided")

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
        if receipt.status not in (ReceiptStatus.needs_review, ReceiptStatus.rejected):
            errors.append(f"{rid}: cannot approve from '{receipt.status}' status")
            continue
        if not receipt.journal_entries:
            errors.append(f"{rid}: no journal entries")
            continue
        receipt.status = ReceiptStatus.approved
        approved.append(rid)

    db.commit()

    # Learn from all approved receipts
    for rid in approved:
        receipt = db.query(Receipt).filter(Receipt.id == rid).first()
        if receipt:
            _learn_from_receipt(receipt)

    return BulkApproveResponse(approved=approved, errors=errors)


@router.delete("/{receipt_id}")
def delete_receipt(receipt_id: str, db: Session = Depends(get_db)):
    receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if receipt.status == ReceiptStatus.approved:
        raise HTTPException(status_code=400, detail="Cannot delete approved receipt")
    db.delete(receipt)
    db.commit()
    return {"detail": "Deleted"}


@router.post("/delete-bulk", response_model=BulkDeleteResponse)
def delete_bulk(body: BulkDeleteRequest, db: Session = Depends(get_db)):
    if not body.receipt_ids:
        raise HTTPException(status_code=400, detail="No receipt IDs provided")

    deleted = []
    errors = []
    for rid in body.receipt_ids:
        receipt = db.query(Receipt).filter(Receipt.id == rid).first()
        if not receipt:
            errors.append(f"{rid}: not found")
            continue
        if receipt.status == ReceiptStatus.approved:
            errors.append(f"{rid}: cannot delete approved receipt")
            continue
        db.delete(receipt)
        deleted.append(rid)

    db.commit()
    return BulkDeleteResponse(deleted=deleted, errors=errors)
