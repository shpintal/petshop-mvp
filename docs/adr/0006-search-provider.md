# ADR-0006: Абстракція SearchProvider

Статус: Прийнято (2026-10-28)

## Контекст
Пошук має еволюціонувати від SQL до спеціалізованого рушія й семантики без зміни API.

## Рішення
Інтерфейс `SearchProvider { search(query, filters, sort, page) }`. Реалізації: `PgTrigramSearchProvider` (MVP), `MeilisearchProvider`, `HybridVectorProvider` (pgvector + BM25).

## Наслідки
Заміна рушія без зміни клієнтів; можливість A/B-тестів ранжування.
