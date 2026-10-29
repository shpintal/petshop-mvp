import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { api } from "@/lib/api";
import type { Category, City } from "@/lib/types";
import { SITE } from "@/lib/format";
import { currentCity } from "@/lib/city";
import { SearchBox } from "@/components/client/SearchBox";
import { CitySelect } from "@/components/client/CitySelect";
import { CartBadge } from "@/components/client/CartBadge";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "PetShop — корми та зоотовари з доставкою", template: "%s | PetShop" },
  description: "Корми, ласощі, аксесуари та ветаптека для собак, котів, птахів і гризунів. Доставка завтра, самовивіз з магазинів, картка лояльності.",
  openGraph: { type: "website", locale: "uk_UA", siteName: "PetShop" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [cats, cities, city] = await Promise.all([api<Category[]>("/categories", { revalidate: 300 }), api<City[]>("/cities", { revalidate: 3600 }), currentCity()]);
  return (
    <html lang="uk">
      <body>
        <header className="site">
          <div className="container">
            <div className="topbar">
              <Link href="/" className="logo">PetShop</Link>
              <SearchBox />
              <CitySelect cities={cities} current={city} />
              <Link href="/account" className="btn secondary">Кабінет</Link>
              <CartBadge />
            </div>
            <nav className="nav" aria-label="Каталог">
              {cats.map((c) => <Link key={c.slug} href={`/c/${c.slug}`}>{c.nameUk}</Link>)}
              <Link href="/stores">Магазини</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site"><div className="container">
          <p>PetShop — демонстраційний прототип омніканального зоомагазину. Дані синтетичні.</p>
          <p><Link href="/stores">Магазини</Link> · <Link href="/account">Особистий кабінет</Link> · Доставка: кур&apos;єр завтра, Нова Пошта, самовивіз</p>
        </div></footer>
      </body>
    </html>
  );
}
