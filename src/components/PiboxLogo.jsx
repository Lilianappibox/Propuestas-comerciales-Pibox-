/**
 * Logo PIBOX — recreación fiel del logo oficial:
 * "pib" + cubo 3D isométrico (reemplaza la "o") + "x" + arco sonriente
 */
export default function PiboxLogo({ size = "md", white = true }) {
  const sizes = {
    xs:  { w: 72,  h: 36  },
    sm:  { w: 108, h: 54  },
    md:  { w: 144, h: 72  },
    lg:  { w: 200, h: 100 },
    xl:  { w: 280, h: 140 },
  };
  const { w, h } = sizes[size] || sizes.md;
  const c = white ? "#ffffff" : "#7C22D4";   // color principal

  /*
   * ViewBox: 220 × 110
   * Baseline del texto: y = 73
   * Fuente ~65px, negrita máxima, minúsculas
   *
   * Layout horizontal (estimado con Arial Black 65px):
   *   "pib"  → x=4  … ~x=105
   *   cubo   → x=107 … x=147  (centro en x=127)
   *   "x"    → x=150 … ~x=197
   *
   * Cubo isométrico — vértices para un cubo de lado ≈20px:
   *   Centro:  (127, 51)
   *   Cara superior (rombo):  (127,31) (147,42) (127,52) (107,42)
   *   Cara derecha:           (147,42) (147,62) (127,72) (127,52)
   *   Cara izquierda:         (107,42) (127,52) (127,72) (107,62)
   *
   * Sonrisa: arco que va de x=4 a x=216, curva en y≈108
   */

  return (
    <svg
      viewBox="0 0 220 110"
      width={w}
      height={h}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="pibox"
      role="img"
    >
      {/* ── "pib" ────────────────────────────────────────── */}
      <text
        x="4"
        y="73"
        fontFamily="'Arial Black','Arial Bold',Arial,sans-serif"
        fontWeight="900"
        fontSize="65"
        fill={c}
        letterSpacing="-1"
      >
        pib
      </text>

      {/* ── Cubo isométrico 3D (reemplaza la "o") ──────── */}

      {/* Cara superior — más clara, máxima luminosidad */}
      <polygon
        points="127,31 147,42 127,52 107,42"
        fill={c}
        opacity="1"
      />
      {/* Cara derecha — luminosidad media */}
      <polygon
        points="147,42 147,62 127,72 127,52"
        fill={c}
        opacity="0.78"
      />
      {/* Cara izquierda — más oscura */}
      <polygon
        points="107,42 127,52 127,72 107,62"
        fill={c}
        opacity="0.55"
      />

      {/* ── "x" ─────────────────────────────────────────── */}
      <text
        x="150"
        y="73"
        fontFamily="'Arial Black','Arial Bold',Arial,sans-serif"
        fontWeight="900"
        fontSize="65"
        fill={c}
        letterSpacing="-1"
      >
        x
      </text>

      {/* ── Arco sonriente ──────────────────────────────── */}
      <path
        d="M 6 84 Q 110 112 214 84"
        stroke={c}
        strokeWidth="6.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
