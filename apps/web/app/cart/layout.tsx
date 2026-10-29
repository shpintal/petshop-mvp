import type { Metadata } from "next";
export const metadata: Metadata = { title: "Кошик", robots: { index: false, follow: false } };
export default function L({ children }: { children: React.ReactNode }) { return children; }
