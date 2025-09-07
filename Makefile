SHELL := /bin/bash

.PHONY: up down logs build dev lint typecheck format prisma

up:
	docker compose up -d

down:
	docker compose down -v

logs:
	docker compose logs -f

build:
	pnpm -r build

dev:
	pnpm -r --parallel dev

lint:
	pnpm -r lint

typecheck:
	tsci -b || tsc -b

format:
	prettier --write .

