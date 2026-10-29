"use client";
import { useRouter } from "next/navigation";
export function CitySelect({ cities, current }: { cities: { slug: string; nameUk: string }[]; current: string }) {
  const router = useRouter();
  return (
    <select aria-label="Місто" defaultValue={current} onChange={(e) => { document.cookie = `city=${e.target.value}; path=/; max-age=31536000; samesite=lax`; router.refresh(); }}>
      {cities.map((c) => <option key={c.slug} value={c.slug}>{c.nameUk}</option>)}
    </select>
  );
}
