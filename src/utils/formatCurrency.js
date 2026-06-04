export const fmt = (n) =>
  n === 0 || n === "" || n == null
    ? "—"
    : "$" + Number(n).toLocaleString("es-CO");

export const fmtNum = (n) =>
  n == null || n === "" ? "—" : Number(n).toLocaleString("es-CO");
