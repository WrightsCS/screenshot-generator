import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

/**
 * Resolves a raw screenshot path by trying common extensions.
 * The screenshot name in slides.json omits the extension (e.g. "1").
 * We search for PNG, JPG, JPEG in order.
 */
export function resolveScreenshotPath(
  screenshotName: string,
  platform: "ios" | "android",
  rawScreenshotsDir: string
): string | null {
  const platformDir = platform === "ios" ? "iOS" : "Android";
  const dir = path.join(rawScreenshotsDir, platformDir);
  const extensions = [".png", ".jpg", ".jpeg", ".webp"];

  for (const ext of extensions) {
    const candidate = path.join(dir, `${screenshotName}${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  // Also try the name as-is (in case it already includes an extension)
  const asIs = path.join(dir, screenshotName);
  if (fs.existsSync(asIs)) return asIs;

  return null;
}

/**
 * Loads a screenshot from disk, resizes it to the given dimensions,
 * and returns a raw RGBA Buffer suitable for @napi-rs/canvas's
 * `createImageData`.
 */
export async function loadAndResizeScreenshot(
  screenshotPath: string,
  targetWidth: number,
  targetHeight: number
): Promise<{ data: Buffer; width: number; height: number }> {
  const resized = await sharp(screenshotPath)
    .resize(targetWidth, targetHeight, {
      fit: "cover",
      position: "centre",
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: resized.data,
    width: resized.info.width,
    height: resized.info.height,
  };
}

/**
 * Converts a raw RGBA buffer to a PNG buffer using sharp.
 * Used to encode the final canvas output.
 */
export async function rawToPng(
  data: Uint8Array,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(Buffer.from(data), {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 6, adaptiveFiltering: false })
    .toBuffer();
}

/**
 * Writes a PNG buffer to disk, creating parent directories as needed.
 */
export async function writePng(buffer: Buffer, outputPath: string): Promise<void> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
}

/**
 * Returns basic image metadata (width, height) for a file.
 */
export async function getImageMeta(
  imagePath: string
): Promise<{ width: number; height: number }> {
  const meta = await sharp(imagePath).metadata();
  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}
