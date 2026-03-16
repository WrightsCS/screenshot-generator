import {
  createCanvas,
  Canvas,
  SKRSContext2D,
  GlobalFonts,
  loadImage,
  Image,
} from "@napi-rs/canvas";
import * as path from "path";
import * as fs from "fs";
import { DeviceSpec, RenderContext, ScreenRect, ThemeConfig, LayoutConfig } from "./types";
import { loadAndResizeScreenshot } from "./imageProcessor";

// ─── Font registration ────────────────────────────────────────────────────────

const ASSETS_DIR = path.resolve(__dirname, "..", "assets");
const FONTS_DIR = path.join(ASSETS_DIR, "fonts");

(function registerFonts() {
  // Bebas Kai — brand display font for headlines
  const bebasOtf = path.join(FONTS_DIR, "BebasKai.otf");
  const bebasTtf = path.join(FONTS_DIR, "BebasKai.ttf");
  if (fs.existsSync(bebasOtf)) {
    GlobalFonts.registerFromPath(bebasOtf, "BebasKai");
  } else if (fs.existsSync(bebasTtf)) {
    GlobalFonts.registerFromPath(bebasTtf, "BebasKai");
  }
  // Load system fonts for caption fallback
  (GlobalFonts as unknown as { loadSystemFonts?: () => void }).loadSystemFonts?.();
})();

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Draw a rounded rectangle path. Does NOT fill or stroke. */
function roundedRectPath(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const cr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + cr, y);
  ctx.lineTo(x + w - cr, y);
  ctx.arcTo(x + w, y, x + w, y + cr, cr);
  ctx.lineTo(x + w, y + h - cr);
  ctx.arcTo(x + w, y + h, x + w - cr, y + h, cr);
  ctx.lineTo(x + cr, y + h);
  ctx.arcTo(x, y + h, x, y + h - cr, cr);
  ctx.lineTo(x, y + cr);
  ctx.arcTo(x, y, x + cr, y, cr);
  ctx.closePath();
}

/** Parse hex / rgb / rgba into numeric RGBA components. */
function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  const hex6 = color.match(/^#([0-9a-f]{6})$/i);
  if (hex6) {
    const v = parseInt(hex6[1], 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, a: 1 };
  }
  const hex3 = color.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const [, c] = hex3;
    return { r: parseInt(c[0] + c[0], 16), g: parseInt(c[1] + c[1], 16), b: parseInt(c[2] + c[2], 16), a: 1 };
  }
  const rgba = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] !== undefined ? +rgba[4] : 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

// ─── Frame PNG cache ──────────────────────────────────────────────────────────

const frameCache: Map<string, Image> = new Map();

async function getFrame(framePng: string): Promise<Image> {
  if (!frameCache.has(framePng)) {
    const img = await loadImage(framePng);
    frameCache.set(framePng, img);
  }
  return frameCache.get(framePng)!;
}

// ─── Background ───────────────────────────────────────────────────────────────

function drawBackground(ctx: SKRSContext2D, W: number, H: number, theme: ThemeConfig): void {
  const colors = theme.gradientColors;
  const angle = ((theme.gradientAngle ?? 135) * Math.PI) / 180;
  const gx = Math.cos(angle) * W;
  const gy = Math.sin(angle) * H;

  const grad = ctx.createLinearGradient(0, 0, gx, gy);
  colors.forEach((c, i) => grad.addColorStop(i / Math.max(colors.length - 1, 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Warm accent glow — top-right
  const c1 = parseColor(theme.accentColor);
  const r1 = ctx.createRadialGradient(W * 0.80, H * 0.10, 0, W * 0.80, H * 0.10, W * 0.65);
  r1.addColorStop(0, `rgba(${c1.r},${c1.g},${c1.b},0.22)`);
  r1.addColorStop(0.45, `rgba(${c1.r},${c1.g},${c1.b},0.06)`);
  r1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = r1;
  ctx.fillRect(0, 0, W, H);

  // Secondary glow — bottom-left
  const c2 = parseColor(theme.accentColorSecondary ?? theme.accentColor);
  const r2 = ctx.createRadialGradient(W * 0.18, H * 0.87, 0, W * 0.18, H * 0.87, W * 0.55);
  r2.addColorStop(0, `rgba(${c2.r},${c2.g},${c2.b},0.16)`);
  r2.addColorStop(0.5, `rgba(${c2.r},${c2.g},${c2.b},0.03)`);
  r2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = r2;
  ctx.fillRect(0, 0, W, H);

  // Subtle scanline texture
  ctx.save();
  ctx.globalAlpha = 0.016;
  ctx.fillStyle = "#ffffff";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.restore();
}

// ─── Device frame compositing ─────────────────────────────────────────────────

/**
 * Calculates the position and size of the device frame and the screen rect
 * within it, given the canvas dimensions and layout config.
 *
 * Returns:
 *  frameRect  — where the frame PNG is drawn on canvas
 *  screenRect — where the screenshot goes (inside the frame)
 */
function calcFrameLayout(
  W: number,
  H: number,
  device: DeviceSpec,
  layout: LayoutConfig
): { frameX: number; frameY: number; frameW: number; frameH: number; screen: ScreenRect } {
  const topZoneH = H * layout.topZonePct;
  const deviceZoneH = H * layout.deviceZonePct;

  // Frame aspect ratio (from the original PNG)
  const frameAspect = device.framePngHeight / device.framePngWidth;
  const maxFW = W * layout.deviceWidthPct;
  const maxFH = deviceZoneH * 0.97;

  let frameW = maxFW;
  let frameH = frameW * frameAspect;
  if (frameH > maxFH) {
    frameH = maxFH;
    frameW = frameH / frameAspect;
  }

  const frameX = (W - frameW) / 2;
  const frameY = topZoneH + (deviceZoneH - frameH) / 2;

  // Screen rect within the drawn frame
  const { top, bottom, left, right, cornerRadiusPct } = device.screenHole;
  const screenX = frameX + left * frameW;
  const screenY = frameY + top * frameH;
  const screenW = frameW * (1 - left - right);
  const screenH = frameH * (1 - top - bottom);
  const cornerRadius = screenW * cornerRadiusPct;

  return {
    frameX, frameY, frameW, frameH,
    screen: { x: screenX, y: screenY, w: screenW, h: screenH, cornerRadius },
  };
}

// ─── Screenshot compositing ───────────────────────────────────────────────────

async function drawScreenshot(
  ctx: SKRSContext2D,
  screenshotPath: string,
  screen: ScreenRect
): Promise<void> {
  const targetW = Math.round(screen.w);
  const targetH = Math.round(screen.h);

  const { data, width, height } = await loadAndResizeScreenshot(screenshotPath, targetW, targetH);

  // Build ImageData from the raw RGBA buffer
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(data);

  // Blit via an off-screen canvas so we can use drawImage (which respects the clip)
  const tmp: Canvas = createCanvas(width, height);
  const tmpCtx = tmp.getContext("2d") as unknown as SKRSContext2D;
  tmpCtx.putImageData(imgData, 0, 0);

  // Clip to rounded screen shape, then draw
  ctx.save();
  roundedRectPath(ctx, screen.x, screen.y, screen.w, screen.h, screen.cornerRadius);
  ctx.clip();
  ctx.drawImage(tmp, screen.x, screen.y, screen.w, screen.h);
  ctx.restore();
}

/** Draw the device frame PNG overlay on top of the screenshot. */
async function drawDeviceFrame(
  ctx: SKRSContext2D,
  device: DeviceSpec,
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
  theme: ThemeConfig
): Promise<void> {
  const frame = await getFrame(device.framePng);

  // Drop-shadow behind the frame
  ctx.save();
  ctx.shadowColor = theme.deviceShadowColor ?? "rgba(0,0,0,0.60)";
  ctx.shadowBlur = frameW * 0.07;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = frameW * 0.035;
  // Draw a filled shape the same size as the frame to cast the shadow,
  // then draw the actual frame on top (shadow stays around it)
  ctx.globalAlpha = 0;
  ctx.fillRect(frameX, frameY, frameW, frameH);
  ctx.restore();

  // Draw the real frame PNG (transparent screen area lets screenshot show through)
  ctx.drawImage(frame, frameX, frameY, frameW, frameH);
}

// ─── Text ─────────────────────────────────────────────────────────────────────

/** Build the canvas font string, trying the brand font first. */
function makeFont(
  weight: "normal" | "bold",
  sizePx: number,
  fontFamily: string
): string {
  // BebasKai is an all-caps display font — use it for headlines only
  // For captions, fall back to system sans
  return `${weight} ${sizePx}px "${fontFamily}", -apple-system, "Helvetica Neue", Arial, sans-serif`;
}

/** Word-wrap text into lines that fit within maxWidth. */
function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number, font: string): string[] {
  ctx.font = font;
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Draw centered multi-line text. Returns the total pixel height consumed. */
function drawCenteredText(
  ctx: SKRSContext2D,
  text: string,
  centerX: number,
  topY: number,
  maxWidth: number,
  font: string,
  color: string,
  lineHeight: number
): number {
  const lines = wrapText(ctx, text, maxWidth, font);
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((line, i) => ctx.fillText(line, centerX, topY + i * lineHeight));
  ctx.restore();
  return lines.length * lineHeight;
}

// ─── Accent decoration ────────────────────────────────────────────────────────

function drawAccentBar(ctx: SKRSContext2D, cx: number, y: number, W: number, theme: ThemeConfig): void {
  const barW = W * 0.13;
  const barH = Math.max(2.5, W * 0.0022);
  const barX = cx - barW / 2;

  const grad = ctx.createLinearGradient(barX, y, barX + barW, y);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.25, theme.accentColor);
  grad.addColorStop(0.75, theme.accentColor);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.fillStyle = grad;
  roundedRectPath(ctx, barX, y, barW, barH, barH / 2);
  ctx.fill();
  ctx.restore();
}

/** Small dot-indicator row showing current slide position. */
function drawSlideCounter(
  ctx: SKRSContext2D,
  current: number,
  total: number,
  W: number,
  H: number,
  theme: ThemeConfig
): void {
  const dotR = Math.max(3.5, W * 0.0055);
  const gap = dotR * 3.2;
  const totalWidth = (total - 1) * gap + dotR * 2;
  const startX = (W - totalWidth) / 2 + dotR;
  const dotY = H - dotR - H * 0.018;

  for (let i = 0; i < total; i++) {
    ctx.save();
    if (i === current) {
      ctx.fillStyle = theme.accentColor;
      ctx.globalAlpha = 1.0;
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.22;
    }
    ctx.beginPath();
    ctx.arc(startX + i * gap, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Main render ──────────────────────────────────────────────────────────────

/**
 * Renders one marketing slide and returns the raw PNG Buffer.
 */
export async function renderSlide(ctx_: RenderContext, totalSlides: number): Promise<Buffer> {
  const { slide, device, screenshotPath, theme, layout, slideIndex } = ctx_;
  const { canvasWidth: W, canvasHeight: H } = device;

  const canvas: Canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as unknown as SKRSContext2D;

  // ── 1. Background ──────────────────────────────────────────────────────────
  drawBackground(ctx, W, H, theme);

  // ── 2. Frame + screen layout ───────────────────────────────────────────────
  const { frameX, frameY, frameW, frameH, screen } = calcFrameLayout(W, H, device, layout);

  // ── 3. Screenshot (behind the frame) ──────────────────────────────────────
  if (screenshotPath && fs.existsSync(screenshotPath)) {
    await drawScreenshot(ctx, screenshotPath, screen);
  } else {
    // Placeholder gradient when screenshot is missing
    ctx.save();
    roundedRectPath(ctx, screen.x, screen.y, screen.w, screen.h, screen.cornerRadius);
    ctx.clip();
    const ph = ctx.createLinearGradient(screen.x, screen.y, screen.x, screen.y + screen.h);
    ph.addColorStop(0, "#1e2a3a");
    ph.addColorStop(1, "#0d1520");
    ctx.fillStyle = ph;
    ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
    ctx.restore();
  }

  // ── 4. Device frame PNG overlay ───────────────────────────────────────────
  await drawDeviceFrame(ctx, device, frameX, frameY, frameW, frameH, theme);

  // ── 5. Headline ────────────────────────────────────────────────────────────
  const topZoneH = H * layout.topZonePct;
  const headlinePad = W * layout.headlinePaddingPct;
  const headlineMaxW = W - headlinePad * 2;
  const headlineFontSize = Math.round(W * layout.headlineFontSizePct);
  const headlineFont = makeFont("bold", headlineFontSize, theme.fontFamily);
  // Bebas Kai is a tight cap font — line-height can be tighter
  const headlineLineH = headlineFontSize * 1.08;

  const headlineLines = wrapText(ctx, slide.headline, headlineMaxW, headlineFont);
  const headlineBlockH = headlineLines.length * headlineLineH;
  const headlineY = (topZoneH - headlineBlockH) / 2 - headlineFontSize * 0.04;

  // Soft shadow for depth
  ctx.save();
  (ctx as unknown as SKRSContext2D).shadowColor = "rgba(0,0,0,0.60)";
  (ctx as unknown as SKRSContext2D).shadowBlur = 22;
  (ctx as unknown as SKRSContext2D).shadowOffsetY = 5;
  drawCenteredText(ctx, slide.headline, W / 2, headlineY, headlineMaxW, headlineFont, theme.headlineColor, headlineLineH);
  ctx.restore();

  // Accent bar below headline
  const accentY = headlineY + headlineBlockH + headlineFontSize * 0.42;
  drawAccentBar(ctx, W / 2, accentY, W, theme);

  // ── 6. Caption ─────────────────────────────────────────────────────────────
  const captionZoneStart = topZoneH + H * layout.deviceZonePct;
  const captionZoneH = H - captionZoneStart;
  const captionFontSize = Math.round(W * layout.captionFontSizePct);
  const captionFont = makeFont("normal", captionFontSize, theme.fontFamily);
  const captionLineH = captionFontSize * 1.50;
  const captionMaxW = W * (1 - layout.captionPaddingPct * 2);

  const captionLines = wrapText(ctx, slide.caption, captionMaxW, captionFont);
  const captionBlockH = captionLines.length * captionLineH;
  const dotReserve = H * 0.030;
  const captionY = captionZoneStart + (captionZoneH - dotReserve - captionBlockH) / 2;

  ctx.save();
  ctx.globalAlpha = 0.90;
  (ctx as unknown as SKRSContext2D).shadowColor = "rgba(0,0,0,0.45)";
  (ctx as unknown as SKRSContext2D).shadowBlur = 10;
  drawCenteredText(ctx, slide.caption, W / 2, captionY, captionMaxW, captionFont, theme.captionColor, captionLineH);
  ctx.restore();

  // ── 7. Slide position dots ─────────────────────────────────────────────────
  drawSlideCounter(ctx, slideIndex, totalSlides, W, H, theme);

  // ── 8. Export ──────────────────────────────────────────────────────────────
  return canvas.toBuffer("image/png");
}
