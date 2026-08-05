import XLSX from "../../utils/xlsxHelper";

/**
 * Lee un File de Excel/CSV y devuelve array de arrays (header en row 0)
 * Más rápido para archivos grandes — no crea objetos por fila
 */
export function parseExcelRaw(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

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

/** Normaliza una cadena para comparar cabeceras:
 *  - trim, lowercase
 *  - elimina tildes
 *  - elimina emojis y cualquier carácter no alfanumérico
 */
const norm = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // tildes
    .replace(/[^\x00-\x7F]/g, "")      // emojis / no-ASCII
    .replace(/[^a-z0-9]/g, "");        // espacios, símbolos

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
// Limpia emojis y espacios extra del texto
const str  = (v) => String(v ?? "")
  .trim()
  .replace(/[^\x00-\x7F]/g, "")   // emojis
  .trim();

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

  // Aliases amplios para cada columna
  const getCliente   = (r) => val(r, "cliente", "client", "company", "empresa", "nombre", "name");
  const getGmvActual = (r) => val(r, "gmv actual", "gmvactual", "gmv mes actual", "gmvmesactual", "gmv");
  const getGmvAnt    = (r) => val(r, "gmv anterior", "gmvanterior", "gmv mes anterior", "gmvmesanterior");
  const getKam       = (r) => val(r, "kam");

  const totalGmv = rows.reduce((a, r) => a + num(getGmvActual(r)), 0);

  const top10 = rows
    .filter((r) => str(getCliente(r)) !== "")
    .map((r) => {
      const gmvActual   = num(getGmvActual(r));
      const gmvAnterior = num(getGmvAnt(r));
      const crec = val(r, "crecimiento", "crec", "crec %", "crecimiento %");
      const part = val(r, "participacion", "participacion %", "participación", "part %", "part");
      return {
        cliente:       str(getCliente(r)),
        kam:           str(getKam(r)),
        gmvActual,
        gmvAnterior,
        crecimiento:   crec !== "" ? num(crec) : gmvAnterior > 0
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
    .filter((r) => str(val(r, "cliente", "client", "company", "empresa", "nombre")) !== "")
    .map((r) => ({
      kam:       str(val(r, "kam")),
      cliente:   str(val(r, "cliente", "client", "company", "empresa", "nombre")),
      gmv:       num(val(r, "gmv")),
      servicios: num(val(r, "servicios", "services", "num servicios", "cantidad servicios")),
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
    .filter((r) => str(val(r, "cliente", "client", "company", "empresa", "nombre")) !== "")
    .map((r) => ({
      kam:            str(val(r, "kam")),
      cliente:        str(val(r, "cliente", "client", "company", "empresa", "nombre")),
      gmvMesAnterior: num(val(r, "gmv mes anterior", "gmv anterior", "gmvanterior", "gmv")),
    }));
  if (!clientesPerdidos.length) return null;
  return { ...JSON.parse(JSON.stringify(formActual)), clientesPerdidos };
}

/**
 * Líneas — columnas: Línea, GMV, Servicios, Paquetes, GMV Anterior, Servicios Anterior, Paquetes Anterior
 */
export function parseLineas(rows, formActual) {
  if (!rows.length) return null;
  const facturacionLinea = rows
    .filter((r) => str(val(r, "lineas", "líneas", "linea", "línea", "line", "servicio", "categoria")) !== "")
    .map((r) => ({
      linea:        str(val(r, "lineas", "líneas", "linea", "línea", "line", "servicio", "categoria")),
      gmv:          num(val(r, "gmv actual", "gmvactual", "gmv")),
      servicios:    num(val(r, "servicios", "services", "cantidad", "num servicios")),
      paquetes:     num(val(r, "paquetes", "packages", "num paquetes", "cantidad paquetes")),
      gmvAnt:       num(val(r, "gmv anterior", "gmvanterior", "gmv mes anterior")),
      serviciosAnt: num(val(r, "servicios anterior", "serviciosanterior", "servicios ant", "serv anterior")),
      paquetesAnt:  num(val(r, "paquetes anterior", "paquetesanterior", "paquetes ant", "paq anterior")),
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
      mes:       str(val(r, "mes", "month", "periodo")),
      gmv:       num(val(r, "gmv")),
      meta:      num(val(r, "meta", "objetivo")),
      servicios: num(val(r, "servicios", "services", "cantidad servicios")),
    }));
  if (!tendencias.length) return null;
  return { ...JSON.parse(JSON.stringify(formActual)), tendencias };
}

/**
 * Mapeo account_manager (en data plana) → nombre KAM (en el sistema).
 * La comparación se hace en minúsculas sin tildes para ser tolerante a variantes.
 */
export const KAM_MAP = {
  "cuentas farmer":     "Johana Navarrete",
  "pipe pibox":         "Bavaria",
  "nathy olivera":      "Natalia Olivera",
  "pibox":              "Keeping Deal",
  "juliana rojas corp": "Juliana Rojas",
  "jaime giron useche": "Jaime Girón",
};

function homologarKAM(rawKam) {
  const key = String(rawKam ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return KAM_MAP[key] || rawKam;
}

/**
 * Agrega un archivo plano (rows de parseExcelFile) en un resumen por empresa,
 * línea y ciudad — solo servicios Completed.
 * Devuelve { companies, lineas, ciudades }
 */
export function aggregateBase(rows) {
  const companies = {}; // { nombre → { kam, gmv, servicios, paquetes } }
  const lineas    = {}; // { op_type → { gmv, servicios, paquetes } }
  const ciudades  = {}; // { city → gmv }

  for (const r of rows) {
    const status = String(r["service_status"] ?? "").trim();
    if (status !== "Completed") continue;

    const company = String(r["company"]         ?? "").trim();
    const kam     = homologarKAM(r["account_manager"]);
    const opType  = String(r["operation_type"]  ?? "").trim();
    const city    = String(r["city"]            ?? "").trim();
    const gmvVal  = Number(String(r["gmv"]      ?? "0").replace(/[^0-9.-]/g, "")) || 0;
    const pkgs    = Number(String(r["packages"] ?? "0").replace(/[^0-9.-]/g, "")) || 0;

    if (company) {
      if (!companies[company]) companies[company] = { kam, gmv: 0, servicios: 0, paquetes: 0 };
      companies[company].gmv       += gmvVal;
      companies[company].servicios += 1;
      companies[company].paquetes  += pkgs;
      if (kam) companies[company].kam = kam;
    }
    if (opType) {
      if (!lineas[opType]) lineas[opType] = { gmv: 0, servicios: 0, paquetes: 0 };
      lineas[opType].gmv       += gmvVal;
      lineas[opType].servicios += 1;
      lineas[opType].paquetes  += pkgs;
    }
    if (city) ciudades[city] = (ciudades[city] || 0) + gmvVal;
  }
  return { companies, lineas, ciudades };
}

/**
 * parseBasePlana — combina mes actual y mes anterior (opcional) para producir:
 * top10Clientes, clientesNuevos, clientesPerdidos, facturacionLinea, facturacionCiudad.
 *
 * @param {object} actual    - resultado de aggregateBase(rowsActual)
 * @param {object|null} anterior - resultado de aggregateBase(rowsAnterior), o null
 * @param {object} formActual
 */
export function parseBasePlana(actual, anterior, formActual) {
  const next = JSON.parse(JSON.stringify(formActual));
  const { companies, lineas, ciudades } = actual;
  const prevCompanies = anterior?.companies || {};
  const prevLineas    = anterior?.lineas    || {};

  // ── Resolvedor de nombre KAM ──────────────────────────────────────────
  // KAM_MAP ya homologó los valores crudos (ej: "Cuentas Farmer" → "Johana Navarrete").
  // Pero si el kams[] del formulario tiene "Cuentas Farmer" en vez de "Johana Navarrete",
  // revertimos al nombre original para que el match funcione en ambos casos.
  const validKamNames = new Set((next.kams || []).map(k => k.nombre));
  const reverseKamMap = {}; // "Johana Navarrete" → "Cuentas Farmer", etc.
  for (const [raw, mapped] of Object.entries(KAM_MAP)) {
    // raw está en minúsculas normalizadas; reconstruimos el display del valor original
    // comparando contra las entradas del propio KAM_MAP
    reverseKamMap[mapped] = raw;
  }
  const normStr = (s) => String(s).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function resolveKam(kamField) {
    if (!kamField) return kamField;
    if (validKamNames.has(kamField)) return kamField; // match directo

    // Reverse KAM_MAP: nombre mapeado → clave original → buscar en validKamNames
    const rawKey = reverseKamMap[kamField];
    if (rawKey) {
      const match = [...validKamNames].find(k => normStr(k) === rawKey);
      if (match) return match;
    }

    // Match case-insensitive directo
    const kamNorm = normStr(kamField);
    const ciMatch = [...validKamNames].find(k => normStr(k) === kamNorm);
    if (ciMatch) return ciMatch;

    // Word-match: "Jaime Andrés Girón Medina" → "Jaime Girón"
    // Requiere al menos 2 palabras del nombre más corto en el más largo
    const kamWords = kamNorm.split(/\s+/).filter(Boolean);
    const wmMatch = [...validKamNames].find(k => {
      const kWords = normStr(k).split(/\s+/).filter(Boolean);
      const [shorter, longer] = kamWords.length <= kWords.length ? [kamWords, kWords] : [kWords, kamWords];
      return shorter.length >= 2 && shorter.every(w => longer.includes(w));
    });
    if (wmMatch) return wmMatch;

    return kamField;
  }

  // Re-aplica resolveKam a cada empresa (companies ya tiene el nombre homologado)
  for (const d of Object.values(companies))     d.kam = resolveKam(d.kam);
  for (const d of Object.values(prevCompanies)) d.kam = resolveKam(d.kam);

  // ── Top 10 ─────────────────────────────────────────────────────────────
  const totalGmv = Object.values(companies).reduce((a, c) => a + c.gmv, 0);
  next.top10Clientes = Object.entries(companies)
    .sort((a, b) => b[1].gmv - a[1].gmv)
    .slice(0, 10)
    .map(([nombre, d]) => {
      const ant = prevCompanies[nombre]?.gmv || 0;
      return {
        cliente:       nombre,
        kam:           d.kam,
        gmvActual:     Math.round(d.gmv),
        gmvAnterior:   Math.round(ant),
        crecimiento:   ant > 0 ? parseFloat((((d.gmv - ant) / ant) * 100).toFixed(2)) : 0,
        participacion: totalGmv > 0 ? parseFloat(((d.gmv / totalGmv) * 100).toFixed(2)) : 0,
      };
    });

  // ── Clientes Nuevos (en actual, no en anterior) ────────────────────────
  next.clientesNuevos = anterior
    ? Object.entries(companies)
        .filter(([nombre]) => !prevCompanies[nombre])
        .sort((a, b) => b[1].gmv - a[1].gmv)
        .map(([nombre, d]) => ({ kam: d.kam, cliente: nombre, gmv: Math.round(d.gmv), servicios: d.servicios }))
    : [];

  // ── Clientes Perdidos (en anterior, no en actual) ─────────────────────
  next.clientesPerdidos = anterior
    ? Object.entries(prevCompanies)
        .filter(([nombre]) => !companies[nombre])
        .sort((a, b) => b[1].gmv - a[1].gmv)
        .map(([nombre, d]) => ({ kam: d.kam, cliente: nombre, gmvMesAnterior: Math.round(d.gmv) }))
    : [];

  // ── Líneas ─────────────────────────────────────────────────────────────
  next.facturacionLinea = Object.entries(lineas)
    .sort((a, b) => b[1].gmv - a[1].gmv)
    .map(([opType, d]) => {
      const ant = prevLineas[opType] || { gmv: 0, servicios: 0, paquetes: 0 };
      return {
        linea:        opType,
        gmv:          Math.round(d.gmv),
        servicios:    d.servicios,
        paquetes:     d.paquetes,
        gmvAnt:       Math.round(ant.gmv),
        serviciosAnt: ant.servicios,
        paquetesAnt:  ant.paquetes,
      };
    });

  // ── Ciudades ───────────────────────────────────────────────────────────
  const totalCiudad = Object.values(ciudades).reduce((a, v) => a + v, 0);
  next.facturacionCiudad = Object.entries(ciudades)
    .sort((a, b) => b[1] - a[1])
    .map(([ciudad, gmv]) => ({
      ciudad,
      gmv:           Math.round(gmv),
      participacion: totalCiudad > 0 ? parseFloat(((gmv / totalCiudad) * 100).toFixed(2)) : 0,
      lat: 0,
      lng: 0,
    }));

  // ── KAM Detalle — top 10 por KAM, activos, crecimiento ────────────────
  const kamGroups = {}; // { kamNombre → { gmv, gmvAnt, companies: { nombre → {gmv, gmvAnt} } } }
  for (const [nombre, d] of Object.entries(companies)) {
    const k = d.kam || "Sin KAM";
    if (!kamGroups[k]) kamGroups[k] = { gmv: 0, gmvAnt: 0, companies: {} };
    kamGroups[k].gmv += d.gmv;
    kamGroups[k].companies[nombre] = { gmv: d.gmv, gmvAnt: prevCompanies[nombre]?.gmv || 0 };
  }
  for (const [nombre, d] of Object.entries(prevCompanies)) {
    const k = d.kam || "Sin KAM";
    if (!kamGroups[k]) kamGroups[k] = { gmv: 0, gmvAnt: 0, companies: {} };
    kamGroups[k].gmvAnt += d.gmv;
  }
  next.kamDetalle = {};
  for (const [kamNombre, kd] of Object.entries(kamGroups)) {
    const totalKamGmv = kd.gmv;
    const top10 = Object.entries(kd.companies)
      .sort((a, b) => b[1].gmv - a[1].gmv)
      .slice(0, 10)
      .map(([nombre, cd]) => ({
        cliente:       nombre,
        gmvActual:     Math.round(cd.gmv),
        gmvAnterior:   Math.round(cd.gmvAnt),
        crecimiento:   cd.gmvAnt > 0 ? parseFloat((((cd.gmv - cd.gmvAnt) / cd.gmvAnt) * 100).toFixed(2)) : 0,
        participacion: totalKamGmv > 0 ? parseFloat(((cd.gmv / totalKamGmv) * 100).toFixed(2)) : 0,
      }));
    next.kamDetalle[kamNombre] = {
      gmv:            Math.round(kd.gmv),
      gmvAnt:         Math.round(kd.gmvAnt),
      clientesActivos: Object.keys(kd.companies).length,
      top10,
    };
  }

  // ── Actualizar kams[].gmv y gmvAnt con valores reales de la data plana ──
  if (next.kams?.length) {
    // Lookup normalizado para tolerar diferencias de capitalización entre
    // el nombre en el formulario y la clave generada por homologarKAM
    const normK = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const detByNorm = {};
    for (const [key, val] of Object.entries(next.kamDetalle)) {
      detByNorm[normK(key)] = val;
    }
    next.kams = next.kams.map(k => {
      let kd = next.kamDetalle[k.nombre] || detByNorm[normK(k.nombre)];

      // Word-match fallback: busca en kamDetalle si ningún lookup exacto funcionó
      if (!kd) {
        const kWords = normK(k.nombre).split(/\s+/).filter(Boolean);
        const wmEntry = Object.entries(next.kamDetalle).find(([detKey]) => {
          const dWords = normK(detKey).split(/\s+/).filter(Boolean);
          const [shorter, longer] = kWords.length <= dWords.length ? [kWords, dWords] : [dWords, kWords];
          return shorter.length >= 2 && shorter.every(w => longer.includes(w));
        });
        if (wmEntry) kd = wmEntry[1];
      }

      if (!kd) return k;
      const gmv = kd.gmv;
      return {
        ...k,
        gmv,
        gmvAnt: kd.gmvAnt,
        cumplimiento: k.meta > 0 ? parseFloat(((gmv / k.meta) * 100).toFixed(2)) : 0,
      };
    });
  }

  return next;
}

// Mapa tab → función parser
export const PARSERS = {
  general:           parseGeneral,
  kams:              parseKAMs,
  "top 10":          parseTop10,
  "clientes nuevos": parseClientesNuevos,
  "clientes perdidos": parseClientesPerdidos,
  "líneas":          parseLineas,
  ciudades:          parseCiudades,
  tendencias:        parseTendencias,
};
