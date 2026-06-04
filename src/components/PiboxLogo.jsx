/**
 * Logo SVG de PIBOX — replica la identidad visual oficial:
 * "pib" + cubo 3D isométrico + "x" + arco sonriente
 */
export default function PiboxLogo({ size = "md", white = true }) {
  const sizes = {
    xs:  { w: 80,  h: 34 },
    sm:  { w: 110, h: 46 },
    md:  { w: 150, h: 64 },
    lg:  { w: 220, h: 92 },
    xl:  { w: 300, h: 126 },
  };
  const { w, h } = sizes[size] || sizes.md;
  const fill = white ? "#ffffff" : "#7C22D4";

  return (
    <svg
      viewBox="0 0 220 90"
      width={w}
      height={h}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PIBOX"
      role="img"
    >
      {/* ── Texto "pib" ── */}
      <text
        x="4" y="62"
        fontFamily="'Arial Black', 'Arial Bold', Arial, sans-serif"
        fontWeight="900"
        fontSize="58"
        fill={fill}
        letterSpacing="-2"
      >
        pib
      </text>

      {/* ── Cubo isométrico (reemplaza la "o") ── */}
      {/* cara superior */}
      <polygon
        points="118,10 142,22 118,34 94,22"
        fill={fill}
        opacity="1"
      />
      {/* cara izquierda */}
      <polygon
        points="94,22 118,34 118,56 94,44"
        fill={fill}
        opacity="0.6"
      />
      {/* cara derecha */}
      <polygon
        points="142,22 118,34 118,56 142,44"
        fill={fill}
        opacity="0.8"
      />

      {/* ── Texto "x" ── */}
      <text
        x="148" y="62"
        fontFamily="'Arial Black', 'Arial Bold', Arial, sans-serif"
        fontWeight="900"
        fontSize="58"
        fill={fill}
        letterSpacing="-2"
      >
        x
      </text>

      {/* ── Arco sonriente ── */}
      <path
        d="M 10 74 Q 110 100 210 74"
        stroke={fill}
        strokeWidth="4.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
