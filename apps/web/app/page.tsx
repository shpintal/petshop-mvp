import Link from "next/link";
import { api } from "@/lib/api";
import type { Category, SearchResult } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { JsonLd } from "@/components/JsonLd";
import { SITE } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const [cats, fresh, top] = await Promise.all([
    api<Category[]>("/categories", { revalidate: 300 }),
    api<SearchResult>("/products?sort=new&pageSize=8"),
    api<SearchResult>("/products?sort=rating&pageSize=8&category=cat-food"),
  ]);
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "WebSite", name: "PetShop", url: SITE,
        potentialAction: { "@type": "SearchAction", target: `${SITE}/search?q={search_term_string}`, "query-input": "required name=search_term_string" } }} />
      <section className="hero">
        <h1>Корми та зоотовари для ваших улюбленців</h1>
        <p>Доставка кур&apos;єром завтра · самовивіз із магазину · знижки за карткою до 10 % · підбір корму за профілем тварини</p>
        <Link className="btn secondary" href="/account">Підібрати корм для улюбленця</Link>
      </section>
      <h2>Категорії</h2>
      <div className="tiles">{cats.flatMap((c) => [c, ...c.children]).filter((c) => c.kind !== "accessory" || !c.children.length).slice(0, 16)
        .map((c) => <Link key={c.slug} className="tile" href={`/c/${c.slug}`}>{c.nameUk}</Link>)}</div>
      <h2>Новинки</h2>
      <div className="grid">{fresh.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      <h2>Найкраще оцінені корми для котів</h2>
      <div className="grid">{top.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
    </>
  );
}
