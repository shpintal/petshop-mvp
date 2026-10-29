# PetShop Platform — MVP-прототип

Сучасний аналог омніканального зоомагазину: **NestJS 12 (Fastify) Commerce API** + **Next.js 16 storefront**, PostgreSQL 18 через **Drizzle ORM**.
Функціональний еталон — ZooBonus.ua (див. звіт реінженерії); код, тексти й дані — власні, каталог синтетичний.

## Що реалізовано
| Область | Функції |
|---|---|
| Каталог | дерево категорій (4 види тварин + ветаптека), Product → Variant, ціна за кг, 13 атрибутів, бренди |
| Пошук | нечіткий пошук українською (pg_trgm), підказки, диз'юнктивні фасети (бренд, клас, вік, білок, беззерновий, стерилізовані), сортування |
| Картка товару | варіанти фасування, наявність у магазинах міста, блок доставки з ETA для 4 способів, відгуки з розподілом оцінок |
| Ціни | знижка за рівнем картки (MEMBER/PRESTIGE/SUPER), акції на бренд/категорію, політика `best_of`/`stack`, уцінка без додаткових знижок |
| Доставка | власний кур'єр за зонами й графіком (cut-off), самовивіз (магазин/переміщення зі складу), Нова Пошта (адаптер-заглушка), пороги безкоштовної доставки після знижок |
| Кошик/Checkout | серверний кошик, атомарний резерв залишків, 5 способів оплати, LiqPay (підпис data/signature, вебхук з ідемпотентністю), transactional outbox |
| Клієнт | OTP-вхід за телефоном, автоматична картка лояльності, профілі тварин, рекомендації корму (алергени, вік, стерилізація) + добова норма і «на скільки вистачить пачки» |
| SEO | 1 H1, canonical, noindex для фільтрів і службових сторінок, JSON-LD Product/Offer/AggregateRating/BreadcrumbList/PetStore/WebSite, sitemap, robots |
| Безпека | Zod-валідація всіх входів, HMAC-токени, rate-limit OTP, CSP і заголовки безпеки, екранування JSON-LD |

## Структура
```
apps/api      NestJS Commerce API (модульний моноліт, ADR-0002)
  src/db        Drizzle-схема, клієнт (PGlite | node-postgres), міграції, сід
  src/modules   catalog, search, pricing, inventory, delivery, cart, checkout, payments, auth, account, reviews, stores, outbox
  src/test      unit-тести правил і e2e-сценарії (node:test)
  migrations    SQL-міграції (генеруються з TS-схеми)
  openapi.json  контракт API
apps/web      Next.js storefront (App Router, RSC)
docs/         SAD.md (архітектура, C4), erd.md, adr/ (13 рішень)
```

## Запуск одним скриптом (Windows)
```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1        # вітрина http://127.0.0.1:3107, API :4000
powershell -ExecutionPolicy Bypass -File .\start-local.ps1 -Reset # з чистою БД
```
Якщо порт 3000 недоступний (Windows резервує діапазони портів для Hyper-V/WSL — `netsh interface ipv4 show excludedportrange protocol=tcp`), скрипт за замовчуванням використовує 3107.

## Швидкий старт (без Docker)
Потрібен Node.js 22+.
```bash
cd apps/api && npm ci && npm run build && npm run db:reset && npm start   # http://127.0.0.1:4000/api/v1
cd apps/web && npm ci && API_URL=http://127.0.0.1:4000/api/v1 npm run build && npm start   # http://localhost:3000
```
За замовчуванням API використовує **PGlite** (PostgreSQL у WASM, дані в `apps/api/.data`). Для справжнього PostgreSQL задайте `DATABASE_URL=postgres://…`.
Демо-клієнт: телефон `+380500000001`; у dev-режимі OTP-код повертається у відповіді API (`devCode`).

## Повне оточення (Docker)
```bash
docker compose up --build    # postgres+pgvector, meilisearch, valkey, api, web
```

## Тести
```bash
cd apps/api && npm test        # 35 тестів: правила ціноутворення, доставки, рекомендацій, лояльності + e2e checkout і платежів
cd apps/web && npm run typecheck
```

## Примітка про середовище розробки прототипу
Прототип зібрано й перевірено в ізольованому Windows-середовищі з обмеженнями (без Docker, без named pipes). Тому:
`next.config.mjs` містить `experimental.workerThreads`/`cpus: 1`, а перевірка типів винесена в `npm run typecheck`. У звичайному середовищі ці налаштування можна прибрати.
Деталі — `env_report.md`.
