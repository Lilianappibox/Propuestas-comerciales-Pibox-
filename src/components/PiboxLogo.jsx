import logoSrc from "../assets/pibox-logo.png";

/**
 * Logo oficial PIBOX (imagen real PNG).
 * - white=true  → filtro CSS que vuelve el logo blanco (para fondos oscuros/gradiente)
 * - white=false → logo morado original (para fondos blancos)
 */
export default function PiboxLogo({ size = "md", white = true, className = "" }) {
  const widths = { xs: 72, sm: 110, md: 150, lg: 200, xl: 280 };
  const w = widths[size] || widths.md;

  return (
    <img
      src={logoSrc}
      alt="pibox"
      width={w}
      style={{
        filter: white
          ? "brightness(0) invert(1)"   // morado → blanco
          : "none",                      // morado original
        display: "block",
        userSelect: "none",
      }}
      className={className}
      draggable={false}
    />
  );
}
