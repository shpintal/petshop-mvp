# ADR-0003: PostgreSQL + Drizzle ORM; PGlite для dev/тестів

Статус: Прийнято (2026-10-28)

## Контекст
Потрібні транзакції, JSONB для атрибутів, повнотекстовий пошук, pgvector. Локальне середовище без Docker має бути повноцінним.

## Рішення
PostgreSQL 18 у проді; Drizzle ORM (типобезпечні SQL-запити, міграції як SQL); драйвер-абстракція: PGlite (PostgreSQL у WASM, in-process) у dev/CI, node-postgres у staging/prod.

## Наслідки
Однаковий SQL-діалект усюди, тести на справжньому PostgreSQL без контейнерів. PGlite однопоточний і без pgvector — лише для dev/тестів.
