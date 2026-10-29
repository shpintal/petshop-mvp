"use client";
import { useEffect } from "react";
// API на безкоштовному хостингу може ще прокидатися — перезавантажуємо сторінку автоматично
// (reset() лише перемальовує клієнт і не перезапитує серверні компоненти)
export default function Error() {
  useEffect(() => { const t = setTimeout(() => location.reload(), 10_000); return () => clearTimeout(t); }, []);
  return <div style={{ padding: "48px 0" }}><h1>Магазин прокидається…</h1><p>Сервер запускається після паузи, це займає до хвилини-двох. Сторінка оновиться автоматично.</p><p><button className="btn" onClick={() => location.reload()}>Спробувати зараз</button></p></div>;
}
