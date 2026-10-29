export const uah = (kop: number) => (kop / 100).toLocaleString("uk-UA", { minimumFractionDigits: kop % 100 ? 2 : 0, maximumFractionDigits: 2 }) + " ₴";
export const date = (iso: string) => new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("uk-UA", { weekday: "short", day: "numeric", month: "long" });
export const SPECIES: Record<string, string> = { dog: "Собаки", cat: "Коти", bird: "Птахи", rodent: "Гризуни" };
export const SITE = process.env.SITE_URL ?? "http://localhost:3000";
