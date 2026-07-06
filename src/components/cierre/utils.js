// ── Formateadores de moneda ────────────────────────────────────────────────

/**
 * Formatea un número como pesos COP con cifra COMPLETA.
 * Ej: 1632779901 → $1.632.779.901
 */
export const fmt = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Formatea un número como dólares USD con cifra COMPLETA.
 * Ej: 412345.67 → $412,345.67
 */
export const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Formatea según la moneda activa (COP o USD).
 * trm = tasa de cambio COP/USD
 */
export const fmtMoney = (n, moneda = "COP", trm = 4200) => {
  if (moneda === "USD") return fmtUSD(n / trm);
  return fmt(n);
};

/**
 * Versión abreviada para ejes de gráficos (M, B, K).
 */
export const fmtM = (n, moneda = "COP", trm = 4200) => {
  const val = moneda === "USD" ? n / trm : n;
  const sym = moneda === "USD" ? "$" : "$";
  if (Math.abs(val) >= 1e9) return `${sym}${(val / 1e9).toFixed(2)}B`;
  if (Math.abs(val) >= 1e6) return `${sym}${(val / 1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1e3) return `${sym}${(val / 1e3).toFixed(0)}K`;
  return moneda === "USD" ? fmtUSD(val) : fmt(val);
};

export const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export const colorCumplimiento = (p) => {
  if (p >= 100) return "#22c55e"; // verde
  if (p >= 80)  return "#f59e0b"; // amarillo
  return "#ef4444";               // rojo
};

export const PIBOX_PURPLE = "#8B2FC9";
export const PIBOX_PINK   = "#E040FB";
export const PIBOX_LIGHT  = "#CE93D8";
