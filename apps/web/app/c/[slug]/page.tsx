import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { Catalog, buildQuery } from "@/components/Catalog";
import { JsonLd } from "@/components/JsonLd";
import { SITE } from "@/lib/format";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> };
type Cat = { slug: string; nameUk: string; breadcrumbs: { slug: string; nameUk: string }[] };
const ALLOWED = ["brand", "foodClass", "lifeStage", "proteinSource", "grainFree", "sterilised", "sort", "page"];

async function load(slug: string) { try { return await api<Cat>(`/categories/${slug}`, { revalidate: 300 }); } catch (e) { if (e instanceof ApiError && e.status === 404) notFound(); throw e; } }

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params; const sp = await searchParams; const c = await load(slug);
  const filtered = Object.keys(sp).some((k) => k !== "page");
  return { title: `${c.nameUk} — купити з доставкою`, description: `${c.nameUk}: ціни, відгуки, наявність у магазинах, доставка завтра.`,
    alternates: { canonical: `/c/${slug}${sp.page && sp.page !== "1" ? `?page=${sp.page}` : ""}` },
    robots: filtered ? { index: false, follow: true } : undefined };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params; const raw = await searchParams;
  const sp = Object.fromEntries(Object.entries(raw).filter(([k]) => ALLOWED.includes(k)));
  const [cat, data] = await Promise.all([load(slug), api<SearchResult>(`/products${buildQuery(sp, { category: slug, pageSize: "24" })}`)]);
  return (
    <>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: cat.breadcrumbs.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.nameUk, item: `${SITE}/c/${b.slug}` })) }} />
      <nav className="crumbs" aria-label="Хлібні крихти"><Link href="/">Головна</Link>{cat.breadcrumbs.map((b) => <span key={b.slug}>/ <Link href={`/c/${b.slug}`}>{b.nameUk}</Link></span>)}</nav>
      <h1>{cat.nameUk}</h1>
      <Catalog base={`/c/${slug}`} sp={sp} data={data} />
    </>
  );
}
