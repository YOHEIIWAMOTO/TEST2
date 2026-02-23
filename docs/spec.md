# Receipt OCR Accounting - Application Specification

## Overview

Web application that processes receipt images through an OCR pipeline, extracts structured data, generates journal entry proposals, and exports approved entries as MoneyForward Cloud Accounting CSV files.

## Architecture

```
User Browser
    |
    v
[Frontend - React/Vite :5173]
    |  /api proxy
    v
[Backend - FastAPI :8000]
    |
    +-- SQLite (storage/db/app.db)
    +-- File Storage (storage/receipts/, storage/exports/)
    +-- OCR Provider (dummy for MVP)
    +-- Extract Provider (dummy for MVP)
    +-- Rules Engine (master CSVs)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 |
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS v4 |
| Database | SQLite (Postgres-ready via DATABASE_URL) |
| Infrastructure | Docker Compose |

## User Workflows

### 1. Upload Receipt
1. User drops or selects receipt image(s)
2. Backend saves image, runs OCR, extracts data
3. Journal entry proposal is generated from rules engine
4. Receipt status set to `needs_review`

### 2. Review & Edit
1. User opens receipt detail (image + form side by side)
2. Image viewer: zoom, rotate, always visible (sticky)
3. Edit extracted data (vendor, date, amount, tax)
4. Edit journal entry (accounts, amounts, description)

### 3. Bulk Review
1. Review Queue shows all `needs_review` receipts as cards
2. Each card shows image thumbnail + journal summary
3. Approve/reject individual receipts or approve all at once

### 4. Export
1. Click "Export Approved Receipts"
2. All approved receipts' journal entries → MF CSV (27 columns)
3. Download CSV file (UTF-8 with BOM)

## Status State Machine

```
uploaded → ocr_done → extracted → needs_review → approved
                                                → rejected
```

## Database Schema

- **receipts**: Receipt metadata + extracted data
- **journal_entries**: Debit/credit journal entry lines
- **export_runs**: Export history with timestamps
- **export_run_receipts**: Many-to-many association

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/receipts/upload | Upload receipt images |
| GET | /api/receipts | List receipts |
| GET | /api/receipts/{id} | Get receipt detail |
| GET | /api/receipts/{id}/image | Get receipt image |
| PATCH | /api/receipts/{id} | Update receipt + journal |
| POST | /api/receipts/{id}/approve | Approve receipt |
| POST | /api/receipts/{id}/reject | Reject receipt |
| POST | /api/receipts/approve-bulk | Bulk approve |
| POST | /api/exports/run | Run CSV export |
| GET | /api/exports | List exports |
| GET | /api/exports/{id}/download | Download CSV |
| GET | /api/health | Health check |
