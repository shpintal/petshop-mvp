"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function CartBadge() {
  const [n, setN] = useState(0);
  useEffect(() => { setN(Number(localStorage.getItem("cartCount") ?? 0)); const h = (e: Event) => setN((e as CustomEvent<number>).detail); window.addEventListener("cart", h); return () => window.removeEventListener("cart", h); }, []);
  return <Link className="btn secondary" href="/cart" aria-label={`Кошик, товарів: ${n}`}>Кошик{n > 0 && <span className="badge">{n}</span>}</Link>;
}
