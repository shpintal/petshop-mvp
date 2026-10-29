import type { ProductDoc } from "../catalog/catalog.service.js";

export const SEARCH_PROVIDER = Symbol("SEARCH_PROVIDER");
export type SortKey = "popular" | "price_asc" | "price_desc" | "new" | "rating";
export interface SearchQuery {
  q?: string; category?: string; species?: string; brand?: string[]; foodClass?: string[]; lifeStage?: string[]; proteinSource?: string[];
  grainFree?: boolean; sterilised?: boolean; sensitiveDigestion?: boolean; priceMin?: number; priceMax?: number; inStockCity?: string;
  sort?: SortKey; page: number; pageSize: number;
}
export interface FacetValue { value: string; label: string; count: number; selected: boolean; }
export interface SearchResult {
  items: ProductDoc[]; total: number; page: number; pageSize: number;
  facets: Record<"brand" | "foodClass" | "lifeStage" | "proteinSource" | "grainFree" | "sterilised", FacetValue[]>;
  priceRange: { min: number; max: number } | null;
}
/** ADR-0006: контракт пошуку. Реалізації: PgTrigram (MVP), Meilisearch, Hybrid (pgvector + BM25). */
export interface SearchProvider {
  search(q: SearchQuery): Promise<SearchResult>;
  suggest(q: string, limit?: number): Promise<{ products: Pick<ProductDoc, "slug" | "nameUk" | "minPrice">[]; categories: { slug: string; nameUk: string }[] }>;
}
