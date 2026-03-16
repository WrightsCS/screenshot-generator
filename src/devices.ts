import * as path from "path";
import { DeviceSpec } from "./types";

const ASSETS = path.resolve(__dirname, "..", "assets");
const FRAMES = path.join(ASSETS, "device-frames");

/**
 * Device specifications for App Store and Google Play marketing screenshots.
 *
 * Canvas sizes match App Store Connect / Play Console requirements:
 *  - iPhone 6.7"  : 1290 × 2796  (iPhone 14/15 Pro Max)
 *  - iPhone 6.5"  : 1242 × 2688  (iPhone 11/12 Pro Max)
 *  - iPhone 6.1"  : 1179 × 2556  (iPhone 14/15)
 *  - Android phone: 1080 × 1920  (16:9 Play Store minimum)
 *
 * Screen-hole ratios were measured by scanning the actual frame PNG for
 * the transparent (alpha < 30) region at the vertical and horizontal
 * mid-points of the image.
 *
 * iOS frame  (1611 × 3308)  →  hole: top 1.69%, bottom 1.72%, left 0%, right 0.06%
 * Android frame (1505 × 3042) →  hole: top 1.45%, bottom 1.48%, left 2.92%, right 0.07%
 */
export const devices: DeviceSpec[] = [
  // ─── iOS ─────────────────────────────────────────────────────────────────
  {
    name: "iphone67",
    label: 'iPhone 6.7"',
    canvasWidth: 1290,
    canvasHeight: 2796,
    framePng: path.join(FRAMES, "ios.png"),
    framePngWidth: 1611,
    framePngHeight: 3308,
    screenHole: { top: 0.0169, bottom: 0.0172, left: 0.0, right: 0.0006, cornerRadiusPct: 0.072 },
    platform: "ios",
  },
  {
    name: "iphone65",
    label: 'iPhone 6.5"',
    canvasWidth: 1242,
    canvasHeight: 2688,
    framePng: path.join(FRAMES, "ios.png"),
    framePngWidth: 1611,
    framePngHeight: 3308,
    screenHole: { top: 0.0169, bottom: 0.0172, left: 0.0, right: 0.0006, cornerRadiusPct: 0.072 },
    platform: "ios",
  },
  {
    name: "iphone61",
    label: 'iPhone 6.1"',
    canvasWidth: 1179,
    canvasHeight: 2556,
    framePng: path.join(FRAMES, "ios.png"),
    framePngWidth: 1611,
    framePngHeight: 3308,
    screenHole: { top: 0.0169, bottom: 0.0172, left: 0.0, right: 0.0006, cornerRadiusPct: 0.072 },
    platform: "ios",
  },

  // ─── Android ──────────────────────────────────────────────────────────────
  {
    name: "phone",
    label: "Android Phone (16:9)",
    canvasWidth: 1080,
    canvasHeight: 1920,
    framePng: path.join(FRAMES, "android.png"),
    framePngWidth: 1505,
    framePngHeight: 3042,
    screenHole: { top: 0.0145, bottom: 0.0148, left: 0.0292, right: 0.0007, cornerRadiusPct: 0.050 },
    platform: "android",
  },
];

export function iOSDevices(): DeviceSpec[] {
  return devices.filter((d) => d.platform === "ios");
}

export function androidDevices(): DeviceSpec[] {
  return devices.filter((d) => d.platform === "android");
}
