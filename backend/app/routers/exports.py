import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ExportRun
from app.schemas import ExportRunSchema
from app.services.csv_exporter import export_approved_receipts
from app.services.storage import storage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exports", tags=["exports"])


@router.post("/run", response_model=ExportRunSchema)
def run_export(db: Session = Depends(get_db)):
    try:
        export_run = export_approved_receipts(db)
        return export_run
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except OSError as e:
        logger.error("Export file write failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to write export file")


@router.get("", response_model=list[ExportRunSchema])
def list_exports(db: Session = Depends(get_db)):
    return (
        db.query(ExportRun)
        .order_by(ExportRun.created_at.desc())
        .all()
    )


@router.get("/{run_id}/download")
def download_export(run_id: str, db: Session = Depends(get_db)):
    export_run = db.query(ExportRun).filter(ExportRun.id == run_id).first()
    if not export_run:
        raise HTTPException(status_code=404, detail="Export run not found")

    file_path = storage.get_export_csv_path(export_run.filename)
    if not Path(file_path).exists():
        logger.error("Export file missing: %s", file_path)
        raise HTTPException(status_code=404, detail="Export file not found on disk")

    return FileResponse(
        file_path,
        media_type="text/csv; charset=utf-8",
        filename=export_run.filename,
        headers={"Content-Disposition": f'attachment; filename="{export_run.filename}"'},
    )
