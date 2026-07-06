import { useState } from "react";
import { fmtMoney } from "./utils";
import { useMoneda } from "./MonedaContext";
import deptData from "../../data/colombiaDepts.json";

// ── Normalización para comparación insensible a acentos y mayúsculas ─────────
function normCity(s) {
  return String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Tabla maestra: [nombre canónico, departamento]
// Se expande automáticamente a variantes sin acento en el Map de abajo.
const MASTER = [
  // ── Bogotá D.C. ────────────────────────────────────────────────────────────
  ["Bogotá","BogotáD.C."],["Bogotá D.C.","BogotáD.C."],
  // ── Cundinamarca ───────────────────────────────────────────────────────────
  ["Soacha","Cundinamarca"],["Funza","Cundinamarca"],["Mosquera","Cundinamarca"],
  ["Sopó","Cundinamarca"],["Cajicá","Cundinamarca"],["Chía","Cundinamarca"],
  ["Tocancipá","Cundinamarca"],["Zipaquirá","Cundinamarca"],["Facatativá","Cundinamarca"],
  ["Madrid","Cundinamarca"],["Cota","Cundinamarca"],["Sibaté","Cundinamarca"],
  ["La Calera","Cundinamarca"],["Gachancipá","Cundinamarca"],["Tenjo","Cundinamarca"],
  ["Tabio","Cundinamarca"],["Bojacá","Cundinamarca"],["El Rosal","Cundinamarca"],
  ["Subachoque","Cundinamarca"],["Fusagasugá","Cundinamarca"],["Girardot","Cundinamarca"],
  ["Villeta","Cundinamarca"],["Guaduas","Cundinamarca"],["Ubaté","Cundinamarca"],
  ["Cáqueza","Cundinamarca"],["Chocontá","Cundinamarca"],["Sesquilé","Cundinamarca"],
  ["Cogua","Cundinamarca"],["Nemocón","Cundinamarca"],["Gachetá","Cundinamarca"],
  ["Pacho","Cundinamarca"],["Arbeláez","Cundinamarca"],["Anapoima","Cundinamarca"],
  ["Apulo","Cundinamarca"],["Agua de Dios","Cundinamarca"],["Guatavita","Cundinamarca"],
  ["Suesca","Cundinamarca"],["Zipacón","Cundinamarca"],["La Mesa","Cundinamarca"],
  ["Tocaima","Cundinamarca"],["Viotá","Cundinamarca"],["Ricaurte","Cundinamarca"],
  ["San Antonio del Tequendama","Cundinamarca"],["Silvania","Cundinamarca"],
  ["Grenada","Cundinamarca"],["Medina","Cundinamarca"],["Paratebueno","Cundinamarca"],
  // ── Antioquia ──────────────────────────────────────────────────────────────
  ["Medellín","Antioquia"],["Bello","Antioquia"],["Itagüí","Antioquia"],
  ["Envigado","Antioquia"],["Sabaneta","Antioquia"],["La Estrella","Antioquia"],
  ["Caldas","Antioquia"],["Copacabana","Antioquia"],["Girardota","Antioquia"],
  ["Barbosa","Antioquia"],["Rionegro","Antioquia"],["Apartadó","Antioquia"],
  ["Turbo","Antioquia"],["Caucasia","Antioquia"],["Puerto Berrío","Antioquia"],
  ["Santa Rosa de Osos","Antioquia"],["Yarumal","Antioquia"],["Andes","Antioquia"],
  ["Jericó","Antioquia"],["Santa Fe de Antioquia","Antioquia"],["Marinilla","Antioquia"],
  ["El Retiro","Antioquia"],["Guarne","Antioquia"],["La Ceja","Antioquia"],
  ["El Carmen de Viboral","Antioquia"],["Sonsón","Antioquia"],["Fredonia","Antioquia"],
  ["Amagá","Antioquia"],["Yolombó","Antioquia"],["Don Matías","Antioquia"],
  ["Segovia","Antioquia"],["Remedios","Antioquia"],["Tarazá","Antioquia"],
  ["Apartado","Antioquia"],["San Pedro de los Milagros","Antioquia"],
  ["El Bagre","Antioquia"],["Zaragoza","Antioquia"],["Cisneros","Antioquia"],
  ["Carolina del Príncipe","Antioquia"],["Anorí","Antioquia"],
  // ── Atlántico ──────────────────────────────────────────────────────────────
  ["Barranquilla","Atlántico"],["Soledad","Atlántico"],["Malambo","Atlántico"],
  ["Sabanalarga","Atlántico"],["Puerto Colombia","Atlántico"],["Galapa","Atlántico"],
  ["Baranoa","Atlántico"],["Usiacurí","Atlántico"],["Santo Tomás","Atlántico"],
  ["Palmar de Varela","Atlántico"],["Ponedera","Atlántico"],["Polonuevo","Atlántico"],
  ["Repeló","Atlántico"],["Luruaco","Atlántico"],["Campo de la Cruz","Atlántico"],
  ["Candelaria","Atlántico"],
  // ── Bolívar ────────────────────────────────────────────────────────────────
  ["Cartagena","Bolívar"],["Magangué","Bolívar"],["El Carmen de Bolívar","Bolívar"],
  ["Mompox","Bolívar"],["Arjona","Bolívar"],["Turbaco","Bolívar"],
  ["El Banco","Bolívar"],["Margarita","Bolívar"],["Mahates","Bolívar"],
  ["Villanueva","Bolívar"],["San Jacinto","Bolívar"],["Achí","Bolívar"],
  ["San Juan Nepomuceno","Bolívar"],["San Pablo","Bolívar"],
  // ── Boyacá ─────────────────────────────────────────────────────────────────
  ["Tunja","Boyacá"],["Duitama","Boyacá"],["Sogamoso","Boyacá"],
  ["Chiquinquirá","Boyacá"],["Paipa","Boyacá"],["Monguí","Boyacá"],
  ["Villa de Leyva","Boyacá"],["Samacá","Boyacá"],["Ramiriquí","Boyacá"],
  ["Tibasosa","Boyacá"],["Nobsa","Boyacá"],["Tuta","Boyacá"],
  ["Ventaquemada","Boyacá"],["Socha","Boyacá"],["Puerto Boyacá","Boyacá"],
  ["Guateque","Boyacá"],["Miraflores","Boyacá"],["Garagoa","Boyacá"],
  // ── Caldas ─────────────────────────────────────────────────────────────────
  ["Manizales","Caldas"],["La Dorada","Caldas"],["Chinchiná","Caldas"],
  ["Villamaría","Caldas"],["Riosucio","Caldas"],["Manzanares","Caldas"],
  ["Salamina","Caldas"],["Supía","Caldas"],["Neira","Caldas"],
  ["Anserma","Caldas"],["Pensilvania","Caldas"],["Aguadas","Caldas"],
  ["Pácora","Caldas"],["Filadelfia","Caldas"],
  // ── Caquetá ────────────────────────────────────────────────────────────────
  ["Florencia","Caquetá"],["San Vicente del Caguán","Caquetá"],
  ["Puerto Rico","Caquetá"],["El Doncello","Caquetá"],["La Montañita","Caquetá"],
  ["Belén de los Andaquíes","Caquetá"],["Albania","Caquetá"],
  ["Curillo","Caquetá"],["El Paujil","Caquetá"],
  // ── Casanare ───────────────────────────────────────────────────────────────
  ["Yopal","Casanare"],["Aguazul","Casanare"],["Tauramena","Casanare"],
  ["Monterrey","Casanare"],["Paz de Ariporo","Casanare"],
  ["Orocué","Casanare"],["Maní","Casanare"],["Trinidad","Casanare"],
  ["San Luis de Palenque","Casanare"],["Nunchía","Casanare"],
  // ── Cauca ──────────────────────────────────────────────────────────────────
  ["Popayán","Cauca"],["Santander de Quilichao","Cauca"],["Puerto Tejada","Cauca"],
  ["Padilla","Cauca"],["Miranda","Cauca"],["Corinto","Cauca"],
  ["Piendamó","Cauca"],["El Bordo","Cauca"],["Patía","Cauca"],
  ["Mercaderes","Cauca"],["Cajibío","Cauca"],["Timbío","Cauca"],
  // ── Cesar ──────────────────────────────────────────────────────────────────
  ["Valledupar","Cesar"],["Aguachica","Cesar"],["La Paz","Cesar"],
  ["Bosconia","Cesar"],["Codazzi","Cesar"],["El Copey","Cesar"],
  ["Curumaní","Cesar"],["Chiriguaná","Cesar"],["Pailitas","Cesar"],
  ["Pelaya","Cesar"],["La Gloria","Cesar"],["Astrea","Cesar"],
  ["El Paso","Cesar"],["Chimichagua","Cesar"],["San Diego","Cesar"],
  ["Manaure Balcón del Cesar","Cesar"],
  // ── Chocó ──────────────────────────────────────────────────────────────────
  ["Quibdó","Chocó"],["Istmina","Chocó"],["Tadó","Chocó"],
  ["Bahía Solano","Chocó"],["Condoto","Chocó"],["Acandí","Chocó"],
  ["Riosucio","Chocó"],["Unguía","Chocó"],["Bojayá","Chocó"],
  // ── Córdoba ────────────────────────────────────────────────────────────────
  ["Montería","Córdoba"],["Cereté","Córdoba"],["Sahagún","Córdoba"],
  ["Lorica","Córdoba"],["Montelíbano","Córdoba"],["Planeta Rica","Córdoba"],
  ["Tierralta","Córdoba"],["Ciénaga de Oro","Córdoba"],["Ayapel","Córdoba"],
  ["Cotorra","Córdoba"],["San Antero","Córdoba"],["San Bernardo del Viento","Córdoba"],
  ["Moñitos","Córdoba"],["Los Córdobas","Córdoba"],["Puerto Escondido","Córdoba"],
  ["Purísima","Córdoba"],["Chima","Córdoba"],["Chimá","Córdoba"],
  // ── Guainía ────────────────────────────────────────────────────────────────
  ["Inírida","Guainía"],
  // ── Guaviare ───────────────────────────────────────────────────────────────
  ["San José del Guaviare","Guaviare"],["Calamar","Guaviare"],
  ["El Retorno","Guaviare"],["Miraflores","Guaviare"],
  // ── Huila ──────────────────────────────────────────────────────────────────
  ["Neiva","Huila"],["Pitalito","Huila"],["Garzón","Huila"],
  ["La Plata","Huila"],["Campoalegre","Huila"],["Rivera","Huila"],
  ["Palermo","Huila"],["Gigante","Huila"],["San Agustín","Huila"],
  ["Hobo","Huila"],["Yaguará","Huila"],["Aipe","Huila"],
  ["Algeciras","Huila"],["Timaná","Huila"],["Acevedo","Huila"],
  ["Isnos","Huila"],
  // ── La Guajira ─────────────────────────────────────────────────────────────
  ["Riohacha","LaGuajira"],["Rioacha","LaGuajira"],["Río de Hacha","LaGuajira"],
  ["Rio Hacha","LaGuajira"],["Riohacha D.C.","LaGuajira"],
  ["Maicao","LaGuajira"],["Uribia","LaGuajira"],
  ["Manaure","LaGuajira"],["San Juan del Cesar","LaGuajira"],
  ["Barrancas","LaGuajira"],["Fonseca","LaGuajira"],["Albania","LaGuajira"],
  ["Hatonuevo","LaGuajira"],["Distraccion","LaGuajira"],["Distracción","LaGuajira"],
  ["El Molino","LaGuajira"],["Urumita","LaGuajira"],
  ["La Jagua del Pilar","LaGuajira"],["Villanueva","LaGuajira"],
  ["Dibulla","LaGuajira"],["Manaure Balcon del Cesar","LaGuajira"],
  // ── Magdalena ──────────────────────────────────────────────────────────────
  ["Santa Marta","Magdalena"],["Ciénaga","Magdalena"],["Fundación","Magdalena"],
  ["Plato","Magdalena"],["Aracataca","Magdalena"],["Zona Bananera","Magdalena"],
  ["Pivijay","Magdalena"],["El Difícil","Magdalena"],["Salamina","Magdalena"],
  ["Tenerife","Magdalena"],["El Banco","Magdalena"],["Guamal","Magdalena"],
  ["Remolino","Magdalena"],["Sitio Nuevo","Magdalena"],["San Sebastián de Buenavista","Magdalena"],
  // ── Meta ───────────────────────────────────────────────────────────────────
  ["Villavicencio","Meta"],["Acacías","Meta"],["Granada","Meta"],
  ["Puerto Gaitán","Meta"],["Cumaral","Meta"],["Restrepo","Meta"],
  ["San Martín","Meta"],["Puerto López","Meta"],["Castilla la Nueva","Meta"],
  ["El Dorado","Meta"],["Guamal","Meta"],["Lejanías","Meta"],
  ["Puerto Concordia","Meta"],["Vista Hermosa","Meta"],["Mesetas","Meta"],
  // ── Nariño ─────────────────────────────────────────────────────────────────
  ["Pasto","Nariño"],["Tumaco","Nariño"],["Ipiales","Nariño"],
  ["Túquerres","Nariño"],["La Unión","Nariño"],["Samaniego","Nariño"],
  ["El Charco","Nariño"],["Barbacoas","Nariño"],["Ricaurte","Nariño"],
  ["Cumbal","Nariño"],["Buesaco","Nariño"],["Chachagüí","Nariño"],
  ["Linares","Nariño"],["El Tablón de Gómez","Nariño"],["Sandoná","Nariño"],
  ["La Florida","Nariño"],["Ancuyá","Nariño"],
  // ── Norte de Santander ─────────────────────────────────────────────────────
  ["Cúcuta","NortedeSantander"],["Ocaña","NortedeSantander"],
  ["Pamplona","NortedeSantander"],["Villa del Rosario","NortedeSantander"],
  ["Los Patios","NortedeSantander"],["El Zulia","NortedeSantander"],
  ["Tibú","NortedeSantander"],["Sardinata","NortedeSantander"],
  ["Convención","NortedeSantander"],["Cáchira","NortedeSantander"],
  ["Chinácota","NortedeSantander"],["Abrego","NortedeSantander"],
  ["La Playa","NortedeSantander"],["San Calixto","NortedeSantander"],
  // ── Putumayo ───────────────────────────────────────────────────────────────
  ["Mocoa","Putumayo"],["Puerto Asís","Putumayo"],["Orito","Putumayo"],
  ["Sibundoy","Putumayo"],["Valle del Guamuez","Putumayo"],
  ["San Miguel","Putumayo"],["Puerto Caicedo","Putumayo"],
  ["Villagarzón","Putumayo"],["Puerto Leguízamo","Putumayo"],
  // ── Quindío ────────────────────────────────────────────────────────────────
  ["Armenia","Quindío"],["Calarcá","Quindío"],["Montenegro","Quindío"],
  ["Quimbaya","Quindío"],["La Tebaida","Quindío"],["Circasia","Quindío"],
  ["Filandia","Quindío"],["Salento","Quindío"],["Buenavista","Quindío"],
  ["Génova","Quindío"],["Pijao","Quindío"],
  // ── Risaralda ──────────────────────────────────────────────────────────────
  ["Pereira","Risaralda"],["Dosquebradas","Risaralda"],
  ["Santa Rosa de Cabal","Risaralda"],["La Virginia","Risaralda"],
  ["Marsella","Risaralda"],["Quinchía","Risaralda"],["Pueblo Rico","Risaralda"],
  ["Mistrató","Risaralda"],["Balboa","Risaralda"],["Santuario","Risaralda"],
  ["Apía","Risaralda"],["Guática","Risaralda"],["Belén de Umbría","Risaralda"],
  // ── San Andrés ─────────────────────────────────────────────────────────────
  ["San Andrés","SanAndrésyProvidencia"],["Providencia","SanAndrésyProvidencia"],
  // ── Santander ──────────────────────────────────────────────────────────────
  ["Bucaramanga","Santander"],["Floridablanca","Santander"],["Girón","Santander"],
  ["Piedecuesta","Santander"],["Barrancabermeja","Santander"],["San Gil","Santander"],
  ["Socorro","Santander"],["Vélez","Santander"],["Málaga","Santander"],
  ["Charalá","Santander"],["Lebrija","Santander"],["Rionegro","Santander"],
  ["San Vicente de Chucurí","Santander"],["El Playón","Santander"],
  ["Oiba","Santander"],["Barbosa","Santander"],["Concepción","Santander"],
  ["Puerto Wilches","Santander"],["Cimitarra","Santander"],
  // ── Sucre ──────────────────────────────────────────────────────────────────
  ["Sincelejo","Sucre"],["Corozal","Sucre"],["Tolú","Sucre"],
  ["Sampués","Sucre"],["Morroa","Sucre"],["Ovejas","Sucre"],
  ["San Marcos","Sucre"],["San Onofre","Sucre"],["El Roble","Sucre"],
  ["Palmito","Sucre"],["Majagual","Sucre"],["Guaranda","Sucre"],
  ["San Pedro","Sucre"],["Buenavista","Sucre"],["Galeras","Sucre"],
  // ── Tolima ─────────────────────────────────────────────────────────────────
  ["Ibagué","Tolima"],["Espinal","Tolima"],["Melgar","Tolima"],
  ["Honda","Tolima"],["Líbano","Tolima"],["Chaparral","Tolima"],
  ["Purificación","Tolima"],["Lérida","Tolima"],["Mariquita","Tolima"],
  ["Fresno","Tolima"],["Venadillo","Tolima"],["Armero","Tolima"],
  ["Guayabal","Tolima"],["Flandes","Tolima"],["Saldaña","Tolima"],
  ["Ambalema","Tolima"],["Alvarado","Tolima"],
  // ── Valle del Cauca ────────────────────────────────────────────────────────
  ["Cali","ValledelCauca"],["Buenaventura","ValledelCauca"],["Palmira","ValledelCauca"],
  ["Tuluá","ValledelCauca"],["Buga","ValledelCauca"],["Cartago","ValledelCauca"],
  ["Yumbo","ValledelCauca"],["Jamundí","ValledelCauca"],["Dagua","ValledelCauca"],
  ["Candelaria","ValledelCauca"],["Pradera","ValledelCauca"],["Florida","ValledelCauca"],
  ["Sevilla","ValledelCauca"],["Zarzal","ValledelCauca"],["La Victoria","ValledelCauca"],
  ["Roldanillo","ValledelCauca"],["El Cerrito","ValledelCauca"],["Ginebra","ValledelCauca"],
  ["Guacarí","ValledelCauca"],["Vijes","ValledelCauca"],["Bugalagrande","ValledelCauca"],
  ["Trujillo","ValledelCauca"],["Riofrio","ValledelCauca"],["Riofrío","ValledelCauca"],
  ["Obando","ValledelCauca"],["Versalles","ValledelCauca"],["El Águila","ValledelCauca"],
  ["Ansermanuevo","ValledelCauca"],["El Cairo","ValledelCauca"],["Ulloa","ValledelCauca"],
  ["Alcalá","ValledelCauca"],["Caicedonia","ValledelCauca"],["El Dovio","ValledelCauca"],
  // ── Vaupés ─────────────────────────────────────────────────────────────────
  ["Mitú","Vaupés"],
  // ── Vichada ────────────────────────────────────────────────────────────────
  ["Puerto Carreño","Vichada"],["Cumaribo","Vichada"],
  ["La Primavera","Vichada"],["Santa Rosalía","Vichada"],
  // ── Arauca ─────────────────────────────────────────────────────────────────
  ["Arauca","Arauca"],["Saravena","Arauca"],["Arauquita","Arauca"],
  ["Tame","Arauca"],["Fortul","Arauca"],["Puerto Rondón","Arauca"],
  ["Cravo Norte","Arauca"],
  // ── Amazonas ───────────────────────────────────────────────────────────────
  ["Leticia","Amazonas"],["Puerto Nariño","Amazonas"],
];

// Alias adicionales para nombres truncados/corruptos del flat file
// (el exportador elimina vocales acentuadas en lugar de reemplazarlas)
const ALIASES = [
  // Antioquia
  ["Itagi",        "Antioquia"],   // Itagüí
  ["Envigad",      "Antioquia"],   // Envigado (truncado)
  ["Sabanet",      "Antioquia"],   // Sabaneta
  // Cundinamarca
  ["Facatativ",    "Cundinamarca"],// Facatativá
  ["Cajic",        "Cundinamarca"],// Cajicá
  ["Zipaquir",     "Cundinamarca"],// Zipaquirá
  ["Sopo",         "Cundinamarca"],// Sopó (ya en MASTER sin tilde)
  ["Tocancip",     "Cundinamarca"],// Tocancipá
  ["Sibate",       "Cundinamarca"],// Sibaté
  ["Fusagasug",    "Cundinamarca"],// Fusagasugá
  ["Gachancip",    "Cundinamarca"],// Gachancipá
  ["Nemoc",        "Cundinamarca"],// Nemocón
  ["Bojac",        "Cundinamarca"],// Bojacá
  // La Guajira
  ["Rioacha",      "LaGuajira"],   // Riohacha (variante común)
  // Valle del Cauca
  ["Jamundi",      "ValledelCauca"],// Jamundí
  ["Tulua",        "ValledelCauca"],// Tuluá
  ["Guacari",      "ValledelCauca"],// Guacarí
  // Otros
  ["Quibdo",       "Chocó"],       // Quibdó
  ["Mitu",         "Vaupés"],      // Mitú
  ["Inirida",      "Guainía"],     // Inírida
  ["Popayan",      "Cauca"],       // Popayán
  ["Monteria",     "Córdoba"],     // Montería
  ["Ibague",       "Tolima"],      // Ibagué
  ["Cucuta",       "NortedeSantander"], // Cúcuta
  ["Medellin",     "Antioquia"],   // Medellín
  ["Bogota",       "BogotáD.C."],  // Bogotá
  ["Tuquer",       "Nariño"],      // Túquerres
  ["Curuman",      "Cesar"],       // Curumaní
  ["Valledupar",   "Cesar"],       // ya correcto
];

// Construir lookup normalizado: variante sin acento → departamento
const CITY_TO_DEPT_NORM = new Map();
for (const [city, dept] of MASTER) {
  CITY_TO_DEPT_NORM.set(normCity(city), dept);
}
// Aliases con menor prioridad (no sobreescriben el MASTER)
for (const [city, dept] of ALIASES) {
  const key = normCity(city);
  if (!CITY_TO_DEPT_NORM.has(key)) CITY_TO_DEPT_NORM.set(key, dept);
}

// Lookup principal: primero exacto, luego normalizado
function cityToDept(cityName) {
  if (!cityName) return null;
  const norm = normCity(cityName);
  return CITY_TO_DEPT_NORM.get(norm) || null;
}

// Alias CITY_TO_DEPT mantenido por compatibilidad con el resto del código
const CITY_TO_DEPT = Object.fromEntries(MASTER);

// ── Display names for departments ─────────────────────────────────────────
const DEPT_DISPLAY = {
  "BogotáD.C.": "Bogotá D.C.",
  "LaGuajira": "La Guajira",
  "NortedeSantander": "N. de Santander",
  "ValledelCauca": "Valle del Cauca",
  "SanAndrésyProvidencia": "San Andrés",
  "Atlántico": "Atlántico",
  "Bolívar": "Bolívar",
  "Boyacá": "Boyacá",
  "Caquetá": "Caquetá",
  "Chocó": "Chocó",
  "Córdoba": "Córdoba",
  "Guainía": "Guainía",
  "Nariño": "Nariño",
  "Quindío": "Quindío",
  "Vaupés": "Vaupés",
};

const displayName = (key) => DEPT_DISPLAY[key] || key;

// ── Purple color scale (empieza saturado para distinguir de sin-datos) ────
const PURPLE_SCALE = ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#3b0764"];
const NO_DATA_COLOR = "#e5e7eb";  // gris neutro claramente distinto del morado

// Escala logarítmica: evita que Bogotá aplaste todos los demás departamentos
function getColor(gmv, maxGmv) {
  if (!gmv || gmv === 0) return NO_DATA_COLOR;
  const logVal = Math.log1p(gmv);
  const logMax = Math.log1p(maxGmv);
  const ratio   = logMax > 0 ? logVal / logMax : 0;
  const idx = Math.min(Math.floor(ratio * PURPLE_SCALE.length), PURPLE_SCALE.length - 1);
  return PURPLE_SCALE[idx];
}

// ── Component ─────────────────────────────────────────────────────────────
export default function MapaCiudades({ data }) {
  const { moneda, trm } = useMoneda();
  const M = (n) => fmtMoney(n, moneda, trm);
  const [hover, setHover] = useState(null);

  // Aggregate city data into departments
  const deptGmv = {};
  const deptCities = {};
  const sinMapear = []; // ciudades del flat file sin departamento conocido
  data.facturacionCiudad.forEach((c) => {
    const deptKey = cityToDept(c.ciudad);
    if (!deptKey) { sinMapear.push(c); return; }
    deptGmv[deptKey] = (deptGmv[deptKey] || 0) + c.gmv;
    if (!deptCities[deptKey]) deptCities[deptKey] = [];
    deptCities[deptKey].push(c);
  });

  const maxGmv = Math.max(...Object.values(deptGmv), 1);
  const totalGmv = Object.values(deptGmv).reduce((a, b) => a + b, 0);

  // Ranking sorted by GMV
  const ranking = Object.entries(deptGmv)
    .map(([key, gmv]) => ({ key, gmv, pct: ((gmv / totalGmv) * 100) }))
    .sort((a, b) => b.gmv - a.gmv);

  // Department paths from JSON
  const departments = deptData.departments;

  return (
    <section className="bg-white rounded-2xl shadow-md px-5 pt-2 pb-2">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">

        {/* ── Mapa SVG ── */}
        <div className="lg:col-span-2 flex flex-col">
          <svg
            viewBox={deptData.viewBox}
            width="100%"
            preserveAspectRatio="xMidYMin meet"
            style={{ height: "calc(100vh - 90px)", maxHeight: 860, filter: "drop-shadow(0 2px 8px rgba(124,34,212,0.08))" }}
          >
            {Object.entries(departments).map(([key, pathD]) => {
              const gmv = deptGmv[key] || 0;
              const isHover = hover === key;
              return (
                <path key={key} d={pathD}
                  fill={isHover ? "#7C22D4" : getColor(gmv, maxGmv)}
                  stroke="#9ca3af" strokeWidth={isHover ? 1.8 : 0.6}
                  opacity={isHover ? 0.9 : 1}
                  style={{ cursor: "pointer", transition: "fill 0.2s" }}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
            {ranking.map(({ key }) => {
              const pathD = departments[key];
              if (!pathD) return null;
              const coords = pathD.match(/[\d.]+/g);
              if (!coords || coords.length < 4) return null;
              const xs = [], ys = [];
              for (let i = 0; i < coords.length - 1; i += 2) {
                xs.push(parseFloat(coords[i])); ys.push(parseFloat(coords[i + 1]));
              }
              const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
              const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
              return (
                <text key={`lbl-${key}`} x={cx} y={cy} textAnchor="middle"
                  fontSize={hover === key ? 13 : 10} fontWeight="700"
                  fill={hover === key ? "#fff" : "#4c1d95"}
                  style={{ pointerEvents: "none" }}>
                  {displayName(key).split(" ")[0]}
                </text>
              );
            })}
          </svg>

          {/* Leyenda */}
          <div className="flex items-center gap-2 mt-1 justify-center">
            <span className="text-[10px] text-gray-400">Menor</span>
            <div className="flex h-2 rounded-full overflow-hidden" style={{ width: 100 }}>
              {PURPLE_SCALE.map((c, i) => <div key={i} style={{ flex: 1, background: c }} />)}
            </div>
            <span className="text-[10px] text-gray-400">Mayor</span>
            <div className="flex items-center gap-1 ml-2">
              <div className="w-2.5 h-2.5 rounded" style={{ background: NO_DATA_COLOR, border: "1px solid #d1d5db" }} />
              <span className="text-[10px] text-gray-400">Sin datos</span>
            </div>
          </div>
        </div>

        {/* ── Panel derecho: título + detail card + ranking ── */}
        {/* paddingTop = 17.1% del alto del SVG (La Guajira empieza en y=171/1000 del viewBox) */}
        <div className="lg:col-span-1 sticky top-4 flex flex-col gap-2"
          style={{ paddingTop: "min(calc((100vh - 90px) * 0.171), 148px)" }}>
          <h2 className="text-lg font-bold text-purple-800">Facturación por Departamento</h2>

          {/* Detail card (aparece al hacer hover — dentro de la vista) */}
          <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${hover ? "border-purple-200 bg-purple-50" : "border-gray-100 bg-gray-50"}`}
            style={{ minHeight: 72 }}>
            {hover ? (
              <div className="px-3 py-2.5">
                <p className="text-sm font-extrabold text-purple-800 leading-tight">{displayName(hover)}</p>
                {deptGmv[hover] ? (
                  <>
                    <p className="text-base font-extrabold text-purple-900 mt-0.5">{M(deptGmv[hover])}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500">Participación</span>
                      <span className="text-xs font-bold text-purple-600">{((deptGmv[hover] / totalGmv) * 100).toFixed(1)}%</span>
                      <span className="text-[10px] text-gray-400">·</span>
                      <span className="text-[10px] text-gray-500 truncate">{(deptCities[hover] || []).map(c => c.ciudad).join(", ")}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">Sin datos de facturación</p>
                )}
              </div>
            ) : (
              <p className="px-3 py-3 text-[10px] text-gray-400 italic">Pasa el cursor sobre un departamento</p>
            )}
          </div>

          {/* Ranking ultra-compacto */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Ranking</p>
            <div className="space-y-0.5 overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
              {ranking.map(({ key, gmv, pct }, i) => (
                <div key={key}
                  className={`rounded-lg px-2.5 py-1.5 cursor-pointer transition ${hover === key ? "bg-purple-100" : "hover:bg-purple-50"}`}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                >
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[11px] font-bold text-purple-700 truncate">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {displayName(key)}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1 bg-purple-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 rounded-full"
                        style={{ width: `${(gmv / maxGmv) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-purple-900 shrink-0 whitespace-nowrap">
                      {M(gmv)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Ciudades sin departamento mapeado ── */}
      {sinMapear.length > 0 && (
        <details className="mt-3 border border-amber-200 rounded-xl bg-amber-50 px-4 py-2">
          <summary className="text-xs font-semibold text-amber-700 cursor-pointer select-none">
            ⚠️ {sinMapear.length} ciudad{sinMapear.length !== 1 ? "es" : ""} sin departamento mapeado
            <span className="text-amber-500 font-normal ml-1">(clic para ver — avisa para agregarlas)</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sinMapear
              .sort((a, b) => b.gmv - a.gmv)
              .map((c, i) => (
                <span key={i} className="bg-white border border-amber-200 rounded-full px-2.5 py-0.5 text-[11px] text-amber-800 font-medium">
                  {c.ciudad} · {M(c.gmv)}
                </span>
              ))}
          </div>
        </details>
      )}
    </section>
  );
}
