export interface Category { id: number; slug: string; nameUk: string; kind: string; species: string | null; children: Category[]; }
export interface ProductDoc { id: number; slug: string; nameUk: string; brandName: string; brandSlug: string; species: string; ratingAvg: number;
  reviewsCount: number; isNew: boolean; minPrice: number; oldPrice: number | null; unitPricePerKg: number | null; packLabels: string[]; foodClass: string | null; }
export interface FacetValue { value: string; label: string; count: number; selected: boolean; }
export interface SearchResult { items: ProductDoc[]; total: number; page: number; pageSize: number; facets: Record<string, FacetValue[]>; priceRange: { min: number; max: number } | null; }
export interface Availability { total: number; warehouse: number; storesInStock: number; stores: { locationId: number; name: string; address: string; qty: number }[]; }
export interface Variant { id: number; sku: string; ean: string | null; packLabel: string; weightG: number | null; price: number; oldPrice: number | null; unitPricePerKg: number | null; freeShipping: boolean; availability: Availability; }
export interface Review { id: number; author: string; rating: number; body: string; createdAt: string; }
export interface Product { id: number; slug: string; nameUk: string; descriptionUk: string; species: string; lifeStage: string; foodClass: string | null; proteinSource: string | null;
  proteinPct: number | null; fatPct: number | null; grainFree: boolean; sterilised: boolean; sensitiveDigestion: boolean; allergens: string[]; attributes: Record<string, string>;
  ratingAvg: number; reviewsCount: number; brand: { slug: string; name: string; country: string }; breadcrumbs: { slug: string; nameUk: string }[];
  variants: Variant[]; reviews: { items: Review[]; distribution: Record<string, number> }; }
export interface DeliveryOption { method: string; label: string; available: boolean; cost: number; free: boolean; reason: string; etaDate: string | null;
  zone?: { id: number; name: string }; pickupPoints?: { locationId: number; name: string; address: string; etaDate: string; source: string }[]; branches?: { ref: string; name: string }[]; }
export interface Store { id: number; slug: string; name: string; address: string; phone: string | null; opensAt: string; closesAt: string; rating: number | null; reviewsCount: number; isNew: boolean; lat: number | null; lng: number | null; city: { slug: string; nameUk: string }; }
export interface City { id: number; slug: string; nameUk: string; ownCourier: boolean; }
