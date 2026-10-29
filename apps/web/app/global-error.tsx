"use client";
import { useEffect } from "react";
import "./globals.css";
// Помилки кореневого layout (шапка тягне категорії й міста з API) error.tsx не ловить
export default function GlobalError() {
  useEffect(() => { const t = setTimeout(() => location.reload(), 10_000); return () => clearTimeout(t); }, []);
  return (
    <html lang="uk">
      <body>
        <main className="container" style={{ padding: "48px 16px" }}>
          <h1>Магазин прокидається…</h1>
          <p>Сервер запускається після паузи, це займає до хвилини-двох. Сторінка оновиться автоматично.</p>
          <p><button className="btn" onClick={() => location.reload()}>Спробувати зараз</button></p>
        </main>
      </body>
    </html>
  );
}
