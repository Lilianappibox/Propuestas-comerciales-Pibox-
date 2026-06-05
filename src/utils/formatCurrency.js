export const fmt = (n) => {
  if (n === "N.A" || n === "NA") return "N.A";
  if (n === 0 || n === "" || n == null) return "—";
  return "$" + Number(n).toLocaleString("es-CO");
};

export const fmtNum = (n) => {
  if (n === "N.A" || n === "NA") return "N.A";
  if (n == null || n === "") return "—";
  return Number(n).toLocaleString("es-CO");
};
