/**
 * generateScreenshots.ts
 *
 * Main entry point for the App Store / Google Play marketing screenshot generator.
 *
 * Usage:
 *   npm run generate
 *
 * What it does:
 *  1. Loads config/slides.json
 *  2. Iterates over every device spec (3 iOS sizes + Android phone)
 *  3. For each device × slide combination:
 *     a. Resolves the matching raw screenshot
 *     b. Renders the full marketing image via layoutEngine
 *     c. Writes a PNG to output/{platform}/{device}/slide_{n}.png
 */

import * as fs from "fs";
import * as path from "path";
import { devices } from "./devices";
import { renderSlide } from "./layoutEngine";
import { resolveScreenshotPath, writePng } from "./imageProcessor";
import { Config, RenderContext } from "./types";

// ─── Paths ────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(PROJECT_ROOT, "config", "slides.json");
const RAW_SCREENSHOTS_DIR = path.join(PROJECT_ROOT, "raw-screenshots");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");

// ─── Logging helpers ──────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";

function log(msg: string): void {
  console.log(msg);
}
function logInfo(msg: string): void {
  console.log(`  ${CYAN}→${RESET} ${msg}`);
}
function logSuccess(msg: string): void {
  console.log(`  ${GREEN}✓${RESET} ${msg}`);
}
function logWarn(msg: string): void {
  console.warn(`  ${YELLOW}⚠${RESET}  ${msg}`);
}
function logError(msg: string): void {
  console.error(`  ${RED}✗${RESET} ${msg}`);
}
function logHeader(msg: string): void {
  console.log(`\n${BOLD}${MAGENTA}${msg}${RESET}`);
}
function logDivider(): void {
  console.log(`${DIM}${"─".repeat(60)}${RESET}`);
}

// ─── Config loader ────────────────────────────────────────────────────────────

function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found: ${CONFIG_PATH}`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  return JSON.parse(raw) as Config;
}

// ─── Output path builder ──────────────────────────────────────────────────────

function outputPath(
  platform: string,
  deviceName: string,
  slideIndex: number
): string {
  return path.join(
    OUTPUT_DIR,
    platform,
    deviceName,
    `slide_${String(slideIndex + 1).padStart(2, "0")}.png`
  );
}

// ─── Per-device generator ─────────────────────────────────────────────────────

async function generateForDevice(
  config: Config,
  deviceName: string
): Promise<{ generated: number; skipped: number }> {
  const device = devices.find((d) => d.name === deviceName);
  if (!device) throw new Error(`Unknown device: ${deviceName}`);

  const platform = device.platform === "ios" ? "ios" : "android";
  const { slides, theme, layout } = config;

  let generated = 0;
  let skipped = 0;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const screenshotPath =
      resolveScreenshotPath(slide.screenshot, device.platform, RAW_SCREENSHOTS_DIR) ?? "";

    if (!screenshotPath) {
      logWarn(
        `Screenshot "${slide.screenshot}" not found for ${device.label} — using placeholder`
      );
      skipped++;
    }

    const ctx: RenderContext = {
      slide,
      device,
      screenshotPath,
      theme,
      layout,
      slideIndex: i,
    };

    try {
      const buffer = await renderSlide(ctx, slides.length);
      const dest = outputPath(platform, device.name, i);
      await writePng(buffer, dest);
      logSuccess(
        `${device.label}  slide ${i + 1}/${slides.length}  →  ${path.relative(PROJECT_ROOT, dest)}`
      );
      generated++;
    } catch (err) {
      logError(`Failed slide ${i + 1} on ${device.label}: ${(err as Error).message}`);
    }
  }

  return { generated, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();

  logHeader("╔════════════════════════════════════════════╗");
  logHeader("║   App Store / Play Store Screenshot Gen   ║");
  logHeader("╚════════════════════════════════════════════╝");

  // ── Load config ──
  log("\n📋 Loading configuration…");
  let config: Config;
  try {
    config = loadConfig();
    logSuccess(`Loaded ${config.slides.length} slides from config/slides.json`);
  } catch (err) {
    logError((err as Error).message);
    process.exit(1);
  }

  logInfo(`App: ${BOLD}${config.appName}${RESET}`);
  logInfo(`Devices: ${devices.map((d) => d.label).join("  ·  ")}`);
  logInfo(`Raw screenshots: ${RAW_SCREENSHOTS_DIR}`);
  logInfo(`Output directory: ${OUTPUT_DIR}`);

  // ── Verify raw screenshots dir exists ──
  if (!fs.existsSync(RAW_SCREENSHOTS_DIR)) {
    logWarn(
      `raw-screenshots directory not found at ${RAW_SCREENSHOTS_DIR}.` +
        ` Place your screenshots in raw-screenshots/iOS/ and raw-screenshots/Android/`
    );
  }

  // ── Ensure output directories exist ──
  for (const device of devices) {
    const platform = device.platform === "ios" ? "ios" : "android";
    fs.mkdirSync(path.join(OUTPUT_DIR, platform, device.name), { recursive: true });
  }

  // ── Generate per device ──
  let totalGenerated = 0;
  let totalSkipped = 0;
  const deviceOrder = devices.map((d) => d.name);

  // Group by platform for nicer console output
  const iosDevices = devices.filter((d) => d.platform === "ios");
  const androidDevices = devices.filter((d) => d.platform === "android");

  log("");
  logHeader("📱 iOS Screenshots");
  logDivider();
  for (const device of iosDevices) {
    log(`\n  ${BOLD}${device.label}${RESET}  (${device.canvasWidth} × ${device.canvasHeight})`);
    const { generated, skipped } = await generateForDevice(config, device.name);
    totalGenerated += generated;
    totalSkipped += skipped;
  }

  log("");
  logHeader("🤖 Android Screenshots");
  logDivider();
  for (const device of androidDevices) {
    log(`\n  ${BOLD}${device.label}${RESET}  (${device.canvasWidth} × ${device.canvasHeight})`);
    const { generated, skipped } = await generateForDevice(config, device.name);
    totalGenerated += generated;
    totalSkipped += skipped;
  }

  // ── Summary ──
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log("");
  logDivider();
  log(`\n${BOLD}${GREEN}Done!${RESET}`);
  logInfo(`Generated : ${BOLD}${totalGenerated}${RESET} images`);
  if (totalSkipped > 0) {
    logInfo(`Skipped   : ${YELLOW}${totalSkipped}${RESET} (missing source screenshots)`);
  }
  logInfo(`Time      : ${elapsed}s`);
  logInfo(`Output    : ${OUTPUT_DIR}`);

  // Print tree of outputs
  log("");
  log(`${DIM}Output structure:${RESET}`);
  printOutputTree(OUTPUT_DIR, PROJECT_ROOT);
  log("");
}

function printOutputTree(dir: string, root: string, indent = "  "): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = path.relative(root, path.join(dir, entry.name));
    if (entry.isDirectory()) {
      log(`${indent}${DIM}${entry.name}/${RESET}`);
      printOutputTree(path.join(dir, entry.name), root, indent + "  ");
    } else if (entry.name.endsWith(".png")) {
      log(`${indent}${GREEN}${entry.name}${RESET}`);
    }
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  logError(`Fatal: ${(err as Error).message}`);
  console.error(err);
  process.exit(1);
});
