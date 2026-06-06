import { createContext, useContext, useState } from "react";

const MonedaContext = createContext(null);

const SK_TRM    = "pibox_cierre_trm";
const SK_MONEDA = "pibox_cierre_moneda";

export function MonedaProvider({ children }) {
  const [trm, setTrm] = useState(() => {
    try { return Number(localStorage.getItem(SK_TRM)) || 4200; } catch { return 4200; }
  });
  const [moneda, setMoneda] = useState(() => {
    try { return localStorage.getItem(SK_MONEDA) || "COP"; } catch { return "COP"; }
  });

  const updateTrm = (v) => {
    const n = Math.max(1, Number(v));
    setTrm(n);
    localStorage.setItem(SK_TRM, n);
  };

  const toggleMoneda = () => {
    const next = moneda === "COP" ? "USD" : "COP";
    setMoneda(next);
    localStorage.setItem(SK_MONEDA, next);
  };

  return (
    <MonedaContext.Provider value={{ trm, setTrm: updateTrm, moneda, toggleMoneda }}>
      {children}
    </MonedaContext.Provider>
  );
}

export function useMoneda() {
  const ctx = useContext(MonedaContext);
  if (!ctx) throw new Error("useMoneda must be inside MonedaProvider");
  return ctx;
}
