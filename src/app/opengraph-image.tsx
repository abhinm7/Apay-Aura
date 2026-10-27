import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Link preview banner (WhatsApp, iMessage, X, Slack...). Rendered at build time.
export const alt = "apay — send aura to your friends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same values as the --bg, --brand, --brand-light and --muted tokens in globals.css
// (the image renderer can't read CSS variables).
const BG = "#f5f5f7";
const BRAND = "#0f2a5c";
const BRAND_LIGHT = "#3b9ae8";
const MUTED = "#6e6e78";

const font = (file: string) => readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans", file));

// The ✦ mark, drawn as a path so it doesn't depend on the font having the glyph.
function AuraMark({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d="M50 0C54 36 64 46 100 50C64 54 54 64 50 100C46 64 36 54 0 50C36 46 46 36 50 0Z" fill={color} />
    </svg>
  );
}

export default async function OpengraphImage() {
  const [bold, medium] = await Promise.all([font("Geist-Bold.ttf"), font("Geist-Medium.ttf")]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
          // Soft brand glows in the corners.
          backgroundImage: `radial-gradient(circle at 12% 10%, ${BRAND_LIGHT}26, transparent 40%), radial-gradient(circle at 90% 95%, ${BRAND}1f, transparent 45%)`,
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div
            style={{
              width: 150,
              height: 150,
              borderRadius: 40,
              background: BRAND,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 20px 50px ${BRAND}40`,
            }}
          >
            <AuraMark size={74} color="#ffffff" />
          </div>
          <div style={{ display: "flex", fontSize: 168, fontWeight: 700, letterSpacing: -6, lineHeight: 1 }}>
            <span style={{ color: BRAND }}>a</span>
            <span style={{ color: BRAND_LIGHT }}>pay</span>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: 44, fontSize: 42, fontWeight: 500, color: MUTED, letterSpacing: -0.5 }}>
          Send aura to your friends
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: bold, weight: 700, style: "normal" },
        { name: "Geist", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
