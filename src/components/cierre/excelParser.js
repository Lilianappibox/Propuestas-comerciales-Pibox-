import * as XLSX from "xlsx";

/**
 * Lee un File de Excel/CSV y devuelve array de objetos
 * (primera fila = cabeceras, resto = datos)
 */
export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/** Normaliza una cadena para comparar cabeceras */
const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Busca en un objeto la primera clave cuya versión normalizada coincida */
function val(row, ...aliases) {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const n = norm(alias);
    const found = keys.find((k) => norm(k) === n);
    if (found !== undefined && row[found] !== "") return row[found];
  }
  return "";
}

const num  = (v) => { const n = Number(String(v).replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; };
const str  = (v) => String(v ?? "").trim();

// ─────────────────────────────────────────────────────────────────────────────
// Parsers por tab
// ─────────────────────────────────────────────────────────────────────────────

/**
 * General — fila con clave/valor  O  cabeceras reconocibles
 * Soporta dos formatos:
 *   A) Una fila por campo:  | Campo | Valor |
 *   B) Una sola fila con columnas: | Mes | Año | Meta Equipo | GMV Real | ...
 */
export function parseGeneral(rows, formActual) {
  if (!rows.length) return null;

  const next = JSON.parse(JSON.stringify(formActual));

  // Formato B: una sola fila con muchas columnas
  const first = rows[0];
  const firstKeys = Object.keys(first).map(norm);
  const isFormatoB = firstKeys.some((k) =>
    ["mes", "anio", "ano", "metaequipo", "gmvreal"].includes(k)
  );

  const dataRow = isFormatoB ? first : null;

  // Formato A: dos columnas "Campo" / "Valor" (o "Key"/"Value")
  const isFormatoA =
    !isFormatoB &&
    rows.some((r) => {
      const keys = Object.keys(r).map(norm);
      return (
        (keys.includes("campo") || keys.includes("key") || keys.includes("nombre")) &&
        (keys.includes("valor") || keys.includes("value"))
      );
    });

  const getValA = (label) => {
    const row = rows.find((r) => {
      const k = val(r, "campo", "key", "nombre");
      return norm(k) === norm(label);
    });
    return row ? val(row, "valor", "value") : "";
  };

  const g = (labelB, ...labelsA) => {
    if (isFormatoB) return val(dataRow, labelB, ...labelsA);
    if (isFormatoA) return getValA(labelB) || labelsA.map(getValA).find((v) => v !== "") || "";
    return "";
  };

  const setIfVal = (target, key, raw, isStr = false) => {
    const v = isStr ? str(raw) : num(raw);
    if (isStr ? v !== "" : v !== 0) target[key] = v;
  };

  setIfVal(next, "mes",    g("Mes", "mes"),           true);
  setIfVal(next, "periodo",g("Periodo", "período"),   true);
  setIfVal(next, "anio",   g("Año", "Anio", "Year"));

  const c = next.cumplimientoEquipo;
  setIfVal(c, "meta",           g("Meta Equipo", "Meta", "meta equipo"));
  setIfVal(c, "gmv",            g("GMV Real", "GMV", "gmv real"));
  setIfVal(c, "utilidadBruta",  g("Utilidad Bruta", "utilidad"));
  setIfVal(c, "mesPasadoMeta",  g("Meta Mes Pasado", "meta mes anterior"));
  setIfVal(c, "mesPasadoGmv",   g("GMV Mes Pasado",  "gmv mes anterior"));
  setIfVal(c, "anioPasadoMeta", g("Meta Año Pasado",  "meta año anterior"));
  setIfVal(c, "anioPasadoGmv",  g("GMV Año Pasado",   "gmv año anterior"));

  return next;
}

/**
 * KAMs — columnas: Nombre, Meta, GMV, OKR
 */
export function parseKAMs(rows, formActual) {
  if (!rows.length) return null;
  const kams = rows
    .filter((r) => str(val(r, "nombre", "kam", "name")) !== "")
    .map((r) => {
      const meta = num(val(r, "meta", "Meta ($)", "meta $"));
      const gmv  = num(val(r, "gmv",  "GMV ($)",  "gmv $"));
      return {
        nombre:      str(val(r, "nombre", "kam", "name")),
        meta,
        gmv,
        okr:         num(val(r, "okr",  "OKR %", "okr%")),
        cumplimiento: meta > 0 ? parseFloat(((gmv / meta) * 100).toFixed(2)) : 0,
        crecimientoVsMes: 0, crecimientoVsMesPct: 0,
        crecimientoVsAnio: 0, crecimientoVsAnioPct: 0,
      };
    });
  if (!kams.length) return null;
  return { ...JSON.parse(JSON.stringify(formActual)), kams };
}

/**
 * Top 10 — columnas: Cliente, KAM, GMV Actual, GMV Anterior, Crecimiento %, Participación %
 */
export function parseTop10(rows, formActual) {
  if (!rows.length) return null;
  const totalGmv = rows.reduce((a, r) => a + num(val(r, "gmv actual", "gmvactual", "gmv mes actual", "gmv")), 0);
  const top10 = rows
    .filter((r) => str(val(r, "cliente", "client")) !== "")
    .map((r) => {
      const gmvActual   = num(val(r, "gmv actual", "gmvactual", "gmv mes actual", "gmv"));
      const gmvAnterior = num(val(r, "gmv anterior", "gmvanterior", "gmv mes anterior"));
      const crec = val(r, "crecimiento", "crec", "crec %", "crecimiento %");
      const part = val(r, "participacion", "participación", "part %", "part");
      return {
        cliente:      str(val(r, "cliente", "client")),
        kam:          str(val(r, "kam", "kAM")),
        gmvActual,
        gmvAnterior,
        crecimiento:  crec !== "" ? num(crec) : gmvAnterior > 0
          ? parseFloat((((gmvActual - gmvAnterior) / gmvAnterior) * 100).toFixed(2))
          : 0,
        participacion: part !== "" ? num(part) : totalGmv > 0
          ? parseFloat(((gmvActual / totalGmv) * 100).toFixed(2))
          : 0,
      };
    });
  if (!top10.length) return null;
  return { ...JSON.parse(JSON.stringify(formActual)), top10Clientes: top10 };
}

/**
 * Clientes Nuevos — columnas: KAM, Cliente, GMV, Servicios
 */
export function parseClientesNuevos(rows, formActual) {
  if (!rows.length) return null;
  const clientesNuevos = rows
    .filter((r) => str(val(r, "cliente", "client")) !== "")
    .map((r) => ({
      kam:      str(val(r, "kam")),
      cliente:  str(val(r, "cliente", "client")),
      gmv:      num(val(r, "gmv")),
      servicios: num(val(r, "servicios", "services", "num servicios")),
    }));
  if (!clientesNuevos.length) return null;
  return { ...JSON.parse(JSON.stringify(formActual)), clientesNuevos };
}

/**
 * Clientes Perdidos — columnas: KAM, Cliente, GMV Mes Anterior
 */
export function parseClientesPerdidos(rows, formActual) {
  if (!rows.length) return null;
  const clientesPerdidos = rows
    .filter((r) => str(val(r, "cliente", "client")) !== "")
    .map((r) => ({
      kam:              str(val(r, "kam")),
      cliente:          str(val(r, "cliente", "client")),
      gmvMesAnterior:   num(val(r, "gmv mes anterior", "gmv anterior", "gmvanterior", "gmv")),
    }));
  if (!clientesPerdidos.length) return null;
  return { ...JSON.parse(JSON.stringify(formActual)), clientesPerdidos };
}

/**
 * Líneas — columnas: Línea, GMV, Servicios
 */
export function parseLineas(rows, formActual) {
  if (!rows.length) return null;
  const facturacionLinea = rows
    .filter((r) => str(val(r, "linea", "línea", "line", "servicio")) !== "")
    .map((r) => ({
      linea:     str(val(r, "linea", "línea", "line", "servicio")),
      gmv:       num(val(r, "gmv")),
      servicios: num(val(r, "servicios", "services", "cantidad")),
    }));
  if (!facturacionLinea.length) return null;
  return { ...JSON.parse(JSON.stringify(formActual)), facturacionLinea };
}

/**
 * Ciudades — columnas: Ciudad, GMV, Participación %
 */
export function parseCiudades(rows, formActual) {
  if (!rows.length) return null;
  const totalGmv = rows.reduce((a, r) => a + num(val(r, "gmv")), 0);
  const facturacionCiudad = rows
    .filter((r) => str(val(r, "ciudad", "city")) !== "")
    .map((r) => {
      const gmv  = num(val(r, "gmv"));
      const part = val(r, "participacion", "participación", "part %", "part");
      return {
        ciudad:       str(val(r, "ciudad", "city")),
        gmv,
        participacion: part !== "" ? num(part) : totalGmv > 0
          ? parseFloat(((gmv / totalGmv) * 100).toFixed(2))
          : 0,
        lat: num(val(r, "lat", "latitud")) || 0,
        lng: num(val(r, "lng", "lon", "longitud")) || 0,
      };
    });
  if (!facturacionCiudad.length) return null;
  return { ...JSON.parse(JSON.stringify(formActual)), facturacionCiudad };
}

/**
 * Tendencias — columnas: Mes, GMV, Meta
 */
export function parseTendencias(rows, formActual) {
  if (!rows.length) return null;
  const tendencias = rows
    .filter((r) => str(val(r, "mes", "month", "periodo")) !== "")
    .map((r) => ({
      mes:  str(val(r, "mes", "month", "periodo")),
      gmv:  num(val(r, "gmv")),
      meta: num(val(r, "meta", "objetivo")),
    }));
  if (!tendencias.length) return null;
  return { ...JSON.parse(JSON.stringify(formActual)), tendencias };
}

// Mapa tab → función parser
export const PARSERS = {
  general:           parseGeneral,
  kams:              parseKAMs,
  "top 10":          parseTop10,
  "clientes nuevos": parseClientesNuevos,
  "clientes perdidos": parseClientesPerdidos,
  lineas:            parseLineas,
  ciudades:          parseCiudades,
  tendencias:        parseTendencias,
};
