"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Suggest = { products: { slug: string; nameUk: string; minPrice: number }[]; categories: { slug: string; nameUk: string }[] };
export function SearchBox() {
  const [q, setQ] = useState(""); const [s, setS] = useState<Suggest | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setS(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => fetch(`/api/v1/search/suggest?q=${encodeURIComponent(q)}`, { signal: ctl.signal }).then((r) => r.json()).then(setS).catch(() => {}), 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);
  return (
    <form className="search" action="/search" role="search">
      <input name="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Пошук: корм, бренд, категорія…" aria-label="Пошук товарів" autoComplete="off" />
      {s && (s.products.length > 0 || s.categories.length > 0) && (
        <div className="suggest" role="listbox">
          {s.categories.map((c) => <Link key={c.slug} href={`/c/${c.slug}`} onClick={() => setS(null)}><b>{c.nameUk}</b><span className="muted">категорія</span></Link>)}
          {s.products.map((p) => <Link key={p.slug} href={`/p/${p.slug}`} onClick={() => setS(null)}><span>{p.nameUk}</span><span className="muted">{(p.minPrice / 100).toFixed(0)} ₴</span></Link>)}
        </div>
      )}
    </form>
  );
}
