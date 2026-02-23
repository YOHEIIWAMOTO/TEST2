# Receipt OCR Accounting

Receipt image upload, OCR processing, journal entry generation, and MoneyForward Cloud Accounting CSV export.

## Quick Start

```bash
# Start both backend and frontend
make up

# Or use docker compose directly
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Usage

1. **Upload** receipt images via the Receipts page (drag & drop or click)
2. **Review** extracted data and journal entries on the Detail page (image stays visible while editing)
3. **Bulk review** pending receipts on the Review page
4. **Approve** receipts individually or in bulk
5. **Export** approved receipts to MoneyForward CSV on the Exports page

## Architecture

```
Frontend (React/Vite :5173)  →  Backend (FastAPI :8000)  →  SQLite
                                    ├── OCR Provider (dummy)
                                    ├── Extract Provider (dummy)
                                    └── Rules Engine (CSV masters)
```

## Project Structure

```
backend/
  app/
    main.py          # FastAPI entry point
    models.py        # SQLAlchemy models
    routers/         # API endpoints
    services/        # Business logic
  master/            # Rules and tax master CSVs
frontend/
  src/
    api/client.ts    # API client
    components/      # Reusable UI components
    pages/           # Route pages
docs/                # Specifications
```

## Development

```bash
make up              # Start services
make logs            # View logs
make backend-shell   # Shell into backend container
make frontend-shell  # Shell into frontend container
make clean           # Remove volumes and containers
```
