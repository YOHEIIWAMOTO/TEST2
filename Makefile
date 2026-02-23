.PHONY: up down logs backend-shell frontend-shell init-db clean

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

backend-shell:
	docker compose exec backend bash

frontend-shell:
	docker compose exec frontend sh

init-db:
	docker compose exec backend python -c "from app.database import init_db; init_db()"

clean:
	docker compose down -v
