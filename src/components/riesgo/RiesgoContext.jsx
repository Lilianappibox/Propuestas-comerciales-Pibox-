import { createContext, useContext, useState } from "react";

export const OP_TYPES = [
  { value: "", label: "Todos los tipos" },
  { value: "On Demand",              label: "On Demand" },
  { value: "Bavaria Paquetes Tada",  label: "Bavaria Paquetes Tada" },
  { value: "Horas",                  label: "Horas" },
  { value: "Paqueteria",             label: "Paquetería" },
  { value: "Freight",                label: "Freight" },
];

const RiesgoContext = createContext({ filterOpType: "", setFilterOpType: () => {} });

export function RiesgoProvider({ children }) {
  const [filterOpType, setFilterOpType] = useState("");
  return (
    <RiesgoContext.Provider value={{ filterOpType, setFilterOpType }}>
      {children}
    </RiesgoContext.Provider>
  );
}

export function useRiesgoFilter() {
  return useContext(RiesgoContext);
}

// Devuelve true si la empresa tiene actividad en el tipo de operación
export function empresaMatchesOpType(empresa, filterOpType) {
  if (!filterOpType) return true;
  return Object.keys(empresa.ops || {}).some(
    (op) => op.toLowerCase().includes(filterOpType.toLowerCase())
  );
}

// Extrae métricas op-específicas de una empresa; fallback al total si no hay datos granulares
export function getOpMetrics(empresa, filterOpType) {
  if (!filterOpType || !empresa) return null;
  const opData = empresa.ops?.[filterOpType];
  if (!opData || typeof opData !== "object") return null;
  return opData; // { total, gmv, completados, cancelados, paquetes }
}
