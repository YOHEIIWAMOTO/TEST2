from pydantic import BaseModel
from datetime import datetime, date


class ReceiptBase(BaseModel):
    vendor_name: str | None = None
    transaction_date: date | None = None
    total_amount: int | None = None
    tax_amount: int | None = None
    description: str | None = None


class ReceiptUpdate(ReceiptBase):
    pass


class ReceiptSummary(BaseModel):
    id: str
    status: str
    original_filename: str
    vendor_name: str | None
    transaction_date: date | None
    total_amount: int | None
    uploaded_at: datetime
    model_config = {"from_attributes": True}


class JournalEntrySchema(BaseModel):
    id: int | None = None
    receipt_id: str | None = None
    line_no: int = 1
    debit_account: str
    debit_sub_account: str | None = None
    debit_department: str | None = None
    debit_partner: str | None = None
    debit_tax_class: str | None = None
    debit_invoice: str | None = None
    debit_amount: int
    debit_tax_amount: int = 0
    credit_account: str
    credit_sub_account: str | None = None
    credit_department: str | None = None
    credit_partner: str | None = None
    credit_tax_class: str | None = None
    credit_invoice: str | None = None
    credit_amount: int
    credit_tax_amount: int = 0
    description: str
    memo: str | None = None
    tag: str | None = None
    model_config = {"from_attributes": True}


class ReceiptDetail(ReceiptBase):
    id: str
    status: str
    original_filename: str
    file_extension: str
    uploaded_at: datetime
    ocr_text: str | None
    updated_at: datetime
    journal_entries: list[JournalEntrySchema] = []
    model_config = {"from_attributes": True}


class ReceiptUpdateWithJournal(ReceiptUpdate):
    journal_entries: list[JournalEntrySchema] | None = None


class ExportRunSchema(BaseModel):
    id: str
    created_at: datetime
    receipt_count: int
    filename: str
    status: str
    model_config = {"from_attributes": True}


class BulkApproveRequest(BaseModel):
    receipt_ids: list[str]


class BulkApproveResponse(BaseModel):
    approved: list[str]
    errors: list[str]
