import type { Metadata } from "next";
import { api } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { Catalog, buildQuery } from "@/components/Catalog";
type Props = { searchParams: Promise<Record<string, string | undefined>> };
export const metadata: Metadata = { title: "Пошук", robots: { index: false, follow: true } };
export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams; const q = (sp.q ?? "").slice(0, 100);
  if (!q) return <h1>Введіть запит для пошуку</h1>;
  const data = await api<SearchResult>(`/products${buildQuery(sp, { pageSize: "24" })}`, { revalidate: 30 });
  return (<><h1>Результати пошуку: «{q}»</h1>{data.total === 0 ? <p>Нічого не знайдено. Спробуйте інше формулювання.</p> : <Catalog base="/search" sp={sp} data={data} />}</>);
}
