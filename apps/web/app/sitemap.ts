import type { MetadataRoute } from "next";
import { api } from "@/lib/api";
import type { Category, SearchResult } from "@/lib/types";
import { SITE } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cats = await api<Category[]>("/categories", { revalidate: 3600 });
  const flat = cats.flatMap((c) => [c, ...c.children]);
  const items: SearchResult["items"] = []; let page = 1;
  for (;;) { const r = await api<SearchResult>(`/products?pageSize=96&page=${page}`, { revalidate: 3600 }); items.push(...r.items); if (page * r.pageSize >= r.total) break; page++; }
  return [{ url: SITE, changeFrequency: "daily", priority: 1 }, { url: `${SITE}/stores`, changeFrequency: "weekly" },
    ...flat.map((c) => ({ url: `${SITE}/c/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...items.map((p) => ({ url: `${SITE}/p/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.6 }))];
}
