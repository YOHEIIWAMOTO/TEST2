import enum
from datetime import datetime, date
from sqlalchemy import (
    String, Integer, Text, DateTime, Date, Enum, ForeignKey, Index, Table, Column,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ReceiptStatus(str, enum.Enum):
    uploaded = "uploaded"
    ocr_done = "ocr_done"
    extracted = "extracted"
    needs_review = "needs_review"
    approved = "approved"
    rejected = "rejected"


export_run_receipts = Table(
    "export_run_receipts",
    Base.metadata,
    Column("export_run_id", String, ForeignKey("export_runs.id"), primary_key=True),
    Column("receipt_id", String, ForeignKey("receipts.id"), primary_key=True),
)


class Receipt(Base):
    __tablename__ = "receipts"
    __table_args__ = (
        Index("ix_receipts_status", "status"),
        Index("ix_receipts_transaction_date", "transaction_date"),
        Index("ix_receipts_uploaded_at", "uploaded_at"),
    )

    id: Mapped[str] = mapped_column(String(26), primary_key=True)
    status: Mapped[str] = mapped_column(
        Enum(ReceiptStatus), default=ReceiptStatus.uploaded
    )
    original_filename: Mapped[str] = mapped_column(String(255))
    file_extension: Mapped[str] = mapped_column(String(10))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    vendor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    transaction_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    total_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tax_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    journal_entries: Mapped[list["JournalEntry"]] = relationship(
        back_populates="receipt", cascade="all, delete-orphan"
    )
    export_runs: Mapped[list["ExportRun"]] = relationship(
        secondary=export_run_receipts, back_populates="receipts"
    )


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    receipt_id: Mapped[str] = mapped_column(String(26), ForeignKey("receipts.id"))
    line_no: Mapped[int] = mapped_column(Integer, default=1)
    debit_account: Mapped[str] = mapped_column(String(30))
    debit_sub_account: Mapped[str | None] = mapped_column(String(30), nullable=True)
    debit_department: Mapped[str | None] = mapped_column(String(20), nullable=True)
    debit_partner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    debit_tax_class: Mapped[str | None] = mapped_column(String(50), nullable=True)
    debit_invoice: Mapped[str | None] = mapped_column(String(50), nullable=True)
    debit_amount: Mapped[int] = mapped_column(Integer)
    debit_tax_amount: Mapped[int] = mapped_column(Integer, default=0)
    credit_account: Mapped[str] = mapped_column(String(30))
    credit_sub_account: Mapped[str | None] = mapped_column(String(30), nullable=True)
    credit_department: Mapped[str | None] = mapped_column(String(20), nullable=True)
    credit_partner: Mapped[str | None] = mapped_column(String(255), nullable=True)
    credit_tax_class: Mapped[str | None] = mapped_column(String(50), nullable=True)
    credit_invoice: Mapped[str | None] = mapped_column(String(50), nullable=True)
    credit_amount: Mapped[int] = mapped_column(Integer)
    credit_tax_amount: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str] = mapped_column(String(200))
    memo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tag: Mapped[str | None] = mapped_column(String(100), nullable=True)

    receipt: Mapped["Receipt"] = relationship(back_populates="journal_entries")


class ExportRun(Base):
    __tablename__ = "export_runs"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    receipt_count: Mapped[int] = mapped_column(Integer, default=0)
    filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="completed")

    receipts: Mapped[list["Receipt"]] = relationship(
        secondary=export_run_receipts, back_populates="export_runs"
    )
