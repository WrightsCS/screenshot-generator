export interface SlideConfig {
  id: number;
  screenshot: string;
  headline: string;
  caption: string;
}

export interface ThemeConfig {
  gradientColors: string[];
  gradientAngle: number;
  accentColor: string;
  accentColorSecondary: string;
  headlineColor: string;
  captionColor: string;
  deviceShadowColor: string;
  fontFamily: string;
}

export interface LayoutConfig {
  topZonePct: number;
  deviceZonePct: number;
  bottomZonePct: number;
  deviceWidthPct: number;
  headlinePaddingPct: number;
  captionPaddingPct: number;
  headlineFontSizePct: number;
  captionFontSizePct: number;
}

export interface Config {
  appName: string;
  theme: ThemeConfig;
  layout: LayoutConfig;
  slides: SlideConfig[];
}

/**
 * Screen hole ratios describe where the transparent screen area sits
 * inside the device frame PNG, expressed as fractions of the PNG's
 * width/height.  All values are [0..1].
 *
 * screenX  = frameX + left   * scaledFrameW
 * screenY  = frameY + top    * scaledFrameH
 * screenW  = scaledFrameW * (1 - left - right)
 * screenH  = scaledFrameH * (1 - top  - bottom)
 */
export interface ScreenHoleRatio {
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Corner radius for clipping the screenshot, as fraction of screenW */
  cornerRadiusPct: number;
}

export interface DeviceSpec {
  /** Unique identifier used for output-folder naming */
  name: string;
  /** Human-readable label */
  label: string;
  /** Marketing canvas width in pixels (must match App Store / Play Store requirements) */
  canvasWidth: number;
  /** Marketing canvas height in pixels */
  canvasHeight: number;
  /** Path to the device frame PNG overlay (relative to the project root) */
  framePng: string;
  /**
   * Original dimensions of the frame PNG — used so we can compute
   * the scaled screen-hole rect without re-loading the file.
   */
  framePngWidth: number;
  framePngHeight: number;
  /** Where the transparent screen area lives inside the frame PNG */
  screenHole: ScreenHoleRatio;
  /** Platform for input screenshot lookup */
  platform: "ios" | "android";
}

export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
  cornerRadius: number;
}

export interface RenderContext {
  slide: SlideConfig;
  device: DeviceSpec;
  screenshotPath: string;
  theme: ThemeConfig;
  layout: LayoutConfig;
  slideIndex: number;
}
