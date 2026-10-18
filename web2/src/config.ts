import type { DepRepresentation } from "./basedependency";

export const TOKEN_SPACING_X = 15;
export const TOKEN_SPACING_Y = 15;

export const TOKEN_TOP_PAD = 20;
export const MARKER_SIZE = 4;
export const CURVATURE = 10;

export const DEFAULT_X_POS = 500;
export const DEFAULT_Y_POS = 500;

export const MOVE_TRANSITION_MS = 10 * 60 * 5.5;

export const LABEL_LINE_HEIGHT = 13;

export const REPRESENTATIONS: readonly DepRepresentation[] = ["dm", "pas", "psd"];

export const LEFT_PADDING = 40;

// dependency edges
export const CURVE_STEP = 0.35;
export const DEP_COLORS = {

  "dm-from": "#6899b8",
  "dm-to": "#c46580",
  "pas-from": "#457c9f",
  "pas-to": "#a12d4e",
  "psd-from": "#1C4E6E",
  "psd-to": "#7B0828",

  // "dm-from": "#b0c580",
  // "dm-to": "#f6c696",
  // "pas-from": "#8da061",
  // "pas-to": "#ffa954",
  // "psd-from": "#6b8138",
  // "psd-to": "#d17c26",
};

export const FORCE = {
  linkDistance: TOKEN_SPACING_X * 5,
  linkStrength: 0.001,
  collideRadius: 24,
  collideStrength: 0.9,
  chargeStrength: -30,
  chargeMaxDistance: TOKEN_SPACING_X * 2,
  anchorStrength: 0.65,
  alpha: 0.05,
  alphaDecay: 0.005,
  velocityDecay: 0.4,
};

export const TRANSITION_PROPS_WHILE_SIMULATING = "opacity, transform, color";

export type PointGetter = (tokenIndex: number) => { px: number; py: number } | undefined;

/**
 * Connectivity score of a token = LINK_WEIGHT * (number of edges touching it)
 *                               + WORD_WEIGHT * (number of distinct words it is connected to).
 * Higher scores sit higher on screen in the x-axis layout.
 */
export const CONNECTIVITY = { linkWeight: 1, wordWeight: 1 };
