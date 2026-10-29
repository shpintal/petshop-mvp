"use client";
import { useEffect } from "react";
// API на безкоштовному хостингу може ще прокидатися — пробуємо ще раз автоматично
export default function Error({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => { const t = setTimeout(reset, 10_000); return () => clearTimeout(t); }, [reset]);
  return <div style={{ padding: "48px 0" }}><h1>Магазин прокидається…</h1><p>Сервер запускається після паузи, це займає до хвилини. Сторінка оновиться автоматично.</p><p><button className="btn" onClick={reset}>Спробувати зараз</button></p></div>;
}
