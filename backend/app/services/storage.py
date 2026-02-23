import shutil
from pathlib import Path
from typing import BinaryIO, Protocol

from app.config import settings


class StorageProvider(Protocol):
    def save_receipt_image(self, receipt_id: str, extension: str, file: BinaryIO) -> str: ...
    def get_receipt_image_path(self, receipt_id: str, extension: str) -> str: ...
    def save_export_csv(self, filename: str, content: bytes) -> str: ...
    def get_export_csv_path(self, filename: str) -> str: ...


class LocalStorageProvider:
    def __init__(self, root: str | None = None):
        self.root = Path(root or settings.storage_root)
        self.receipts_dir = self.root / "receipts"
        self.exports_dir = self.root / "exports"
        self.receipts_dir.mkdir(parents=True, exist_ok=True)
        self.exports_dir.mkdir(parents=True, exist_ok=True)

    def save_receipt_image(self, receipt_id: str, extension: str, file: BinaryIO) -> str:
        receipt_dir = self.receipts_dir / receipt_id
        receipt_dir.mkdir(parents=True, exist_ok=True)
        filepath = receipt_dir / f"original{extension}"
        with open(filepath, "wb") as f:
            shutil.copyfileobj(file, f)
        return str(filepath)

    def get_receipt_image_path(self, receipt_id: str, extension: str) -> str:
        return str(self.receipts_dir / receipt_id / f"original{extension}")

    def save_export_csv(self, filename: str, content: bytes) -> str:
        filepath = self.exports_dir / filename
        with open(filepath, "wb") as f:
            f.write(content)
        return str(filepath)

    def get_export_csv_path(self, filename: str) -> str:
        return str(self.exports_dir / filename)


storage = LocalStorageProvider()
