/** Гроші зберігаються в копійках. */
export const uah = (hryvnias: number): number => Math.round(hryvnias * 100);
export const formatUah = (kop: number): string =>
  (kop / 100).toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₴";
/** Відсоток від суми з округленням до копійки (банківське округлення не потрібне для роздрібу). */
export const pct = (amountKop: number, percent: number): number => Math.round((amountKop * percent) / 100);
