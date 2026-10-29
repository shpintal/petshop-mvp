# Звіт про середовище розробки прототипу (крок 1)

| Компонент | Версія / статус |
|---|---|
| ОС | Windows (нативна пісочниця), 8 CPU, 16 GiB RAM |
| Node.js | v22.23.4 (conda-forge, середовище `shop`) |
| npm | 10.9.9 |
| Next.js | 16.4.3 (Turbopack) |
| React | 19.3.1 |
| TypeScript | 5.9.3 (TS 7 свідомо не взято: Next/NestJS CLI покладаються на JS API компілятора) |
| PostgreSQL (нативний) | 18.6 встановлено, **не запускається**: FATAL `could not create signal listener pipe` (пісочниця забороняє named pipes) |
| PostgreSQL (PGlite) | PGlite 0.5.13 = PostgreSQL 18.6 у WASM, in-process; pg_trgm працює; **pgvector не входить у пакет** |
| Docker | відсутній |

## Обмеження пісочниці та прийняті обхідні рішення
1. `lstat` на предкових каталогах (`C:\`, `C:\Users`) заборонено → Node запускається з `--preserve-symlinks --preserve-symlinks-main` і preload-шимом `devtools/sandbox-fs-shim.cjs` (**лише для цієї пісочниці, не частина продукту**).
2. Дочірні процеси Node з каналами stdio/IPC зависають (libuv named pipes) → Next.js: `experimental.workerThreads: true`, `cpus: 1`, перевірка типів окремо через `tsc --noEmit`; тести — in-process.
3. Нативний PostgreSQL недоступний → **ADR: Drizzle ORM + драйвер-абстракція**: PGlite (dev/тести/демо) і node-postgres (staging/prod). Схема та міграції однакові.
4. pgvector недоступний у PGlite → семантичний пошук: інтерфейс `SearchProvider`; в прототипі — pg_trgm + full-text, у проді — pgvector/Meilisearch.
5. Системний HTTP-проксі блокує urllib до 127.0.0.1 → smoke-тести через `http.client` напряму (raw loopback працює).

Перевірено: `next build` (5 с), `tsc --noEmit` (0 помилок), `next start` → HTTP 200 на 127.0.0.1.
