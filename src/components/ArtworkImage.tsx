import type { Artwork } from "@/types";

// Small painted thumbnails for the demo works. Each piece is drawn by hand in
// SVG with a paper grain filter so it reads like a photo of a real object,
// not a color swatch. Unknown works fall back to a two tone field.

type Piece = (props: { a: string; b: string }) => React.ReactNode;

const PIECES: Record<string, Piece> = {
  // Mara Okafor: horizon paintings in thin, layered oil.
  wrk_tidewater: () => (
    <>
      <rect width="100" height="100" fill="#1d3557" />
      <rect y="0" width="100" height="38" fill="#e9a66b" />
      <rect y="30" width="100" height="14" fill="#c97b4a" opacity="0.85" />
      <rect y="44" width="100" height="6" fill="#f2d0a4" opacity="0.7" />
      <rect y="50" width="100" height="50" fill="#22406a" />
      <rect y="62" width="100" height="3" fill="#e9a66b" opacity="0.35" />
      <rect y="74" width="100" height="2" fill="#e9a66b" opacity="0.2" />
      <circle cx="68" cy="26" r="7" fill="#fbe3c0" opacity="0.9" />
    </>
  ),
  wrk_salt: () => (
    <>
      <rect width="100" height="100" fill="#ebe5d8" />
      <rect y="0" width="100" height="55" fill="#e4ddcd" />
      <rect y="55" width="100" height="2" fill="#9aa5a4" opacity="0.6" />
      <rect y="57" width="100" height="43" fill="#c9cfcc" />
      <rect y="70" width="100" height="30" fill="#8d9b9c" opacity="0.55" />
      <rect
        x="12"
        y="20"
        width="76"
        height="1.5"
        fill="#b8b2a3"
        opacity="0.6"
      />
    </>
  ),
  // Theo Lindqvist: flat acrylic and gouache, hard edges.
  wrk_lamps: () => (
    <>
      <rect width="100" height="100" fill="#2b2a30" />
      {[18, 40, 62, 84].map((x, i) => (
        <g key={x}>
          <rect
            x={x - 0.6}
            y="0"
            width="1.2"
            height={22 + i * 6}
            fill="#8a8580"
          />
          <path
            d={`M${x - 9} ${22 + i * 6} L${x + 9} ${22 + i * 6} L${x + 5} ${12 + i * 6} L${x - 5} ${12 + i * 6} Z`}
            fill="#f0c04a"
          />
          <ellipse
            cx={x}
            cy={40 + i * 6}
            rx="12"
            ry="20"
            fill="#f0c04a"
            opacity="0.12"
          />
        </g>
      ))}
      <rect y="86" width="100" height="14" fill="#1d1c21" />
    </>
  ),
  wrk_harbor: () => (
    <>
      <rect width="100" height="100" fill="#dcdcd6" />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect
            key={`${r}${c}`}
            x={8 + c * 22}
            y={8 + r * 22}
            width="18"
            height="18"
            fill={(r * 3 + c) % 5 === 0 ? "#c2553a" : "#3b6b6e"}
            opacity={0.55 + ((r + c) % 3) * 0.15}
          />
        )),
      )}
    </>
  ),
  // Ines Duarte: soft landscape and cast bronze.
  wrk_orchard: () => (
    <>
      <rect width="100" height="100" fill="#c8bea6" />
      <rect y="62" width="100" height="38" fill="#6f7f4c" />
      {[14, 34, 54, 74, 92].map((x, i) => (
        <g key={x}>
          <rect
            x={x - 1}
            y={44 + (i % 2) * 4}
            width="2"
            height="22"
            fill="#4a3b2a"
          />
          <circle cx={x} cy={40 + (i % 2) * 4} r="11" fill="#4f6d3a" />
          <circle cx={x + 4} cy={36 + (i % 2) * 4} r="6" fill="#647f45" />
        </g>
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <rect
          key={i}
          x={(i * 37) % 100}
          y={(i * 23) % 60}
          width="0.6"
          height="9"
          fill="#ffffff"
          opacity="0.35"
          transform={`rotate(12 ${(i * 37) % 100} ${(i * 23) % 60})`}
        />
      ))}
    </>
  ),
  wrk_threshold: () => (
    <>
      <rect width="100" height="100" fill="#e7e2da" />
      <rect y="78" width="100" height="22" fill="#d6d0c6" />
      <ellipse cx="50" cy="84" rx="26" ry="3" fill="#000" opacity="0.15" />
      <path
        d="M30 84 L30 40 Q30 18 50 18 Q70 18 70 40 L70 84 L60 84 L60 42 Q60 30 50 30 Q40 30 40 42 L40 84 Z"
        fill="#7a5130"
      />
      <path
        d="M33 82 L33 41 Q33 22 50 22 L50 26 Q37 26 37 41 L37 82 Z"
        fill="#a87545"
        opacity="0.7"
      />
    </>
  ),
};

export function ArtworkImage({
  artwork,
  size = 40,
  className = "",
}: {
  artwork: Pick<Artwork, "id" | "swatch" | "title">;
  size?: number;
  className?: string;
}) {
  const [a, b] = artwork.swatch;
  const Piece = PIECES[artwork.id];
  const grain = `grain-${artwork.id}`;
  return (
    <svg
      role="img"
      aria-label={artwork.title}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.18)] ${className}`}
    >
      <defs>
        <filter id={grain} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed={artwork.id.length}
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"
            result="speck"
          />
          <feComposite
            in="speck"
            in2="SourceGraphic"
            operator="in"
            result="g"
          />
          <feBlend in="SourceGraphic" in2="g" mode="multiply" />
        </filter>
      </defs>
      <g filter={`url(#${grain})`}>
        {Piece ? (
          <Piece a={a} b={b} />
        ) : (
          <>
            <rect width="100" height="100" fill={a} />
            <rect y="58" width="100" height="42" fill={b} />
          </>
        )}
      </g>
    </svg>
  );
}
