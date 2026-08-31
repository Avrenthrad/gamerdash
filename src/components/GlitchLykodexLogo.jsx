// Brand mark with a restrained RGB-split glitch — decorative only,
// the base img keeps the real alt text for screen readers.
// logo-mark.png is the same glyph as logo.png with the exterior black
// knocked out so it floats on the auth constellation field.

import logoMark from "../assets/logo-mark.png";

export default function GlitchLykodexLogo({ className = "", size = 112, alt = "Lykodex" }) {
  return (
    <div
      className={`glitch-lykodex-logo${className ? ` ${className}` : ""}`}
      style={{ "--glitch-size": `${size}px` }}
    >
      <img src={logoMark} alt={alt} className="glitch-lykodex-logo__base" decoding="async" />
      <img src={logoMark} alt="" className="glitch-lykodex-logo__layer glitch-lykodex-logo__layer--red" aria-hidden="true" decoding="async" />
      <img src={logoMark} alt="" className="glitch-lykodex-logo__layer glitch-lykodex-logo__layer--cyan" aria-hidden="true" decoding="async" />
    </div>
  );
}
