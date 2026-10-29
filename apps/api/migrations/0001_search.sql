-- Пошук (ADR-0006): нечіткий пошук за триграмами для MVP-провайдера PgTrigramSearchProvider
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING gin (lower(name_uk) gin_trgm_ops);
--> statement-breakpoint
ALTER TABLE categories ADD CONSTRAINT categories_parent_fk FOREIGN KEY (parent_id) REFERENCES categories(id);
