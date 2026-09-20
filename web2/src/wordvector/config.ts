import type { DepRepresentation } from "./basedependency";

export const TOKEN_SPACING = 40;
export const MARKER_SIZE = 4;
export const CURVATURE = 10;

export const DEFAULT_X_POS = 500;
export const DEFAULT_Y_POS = 500;

export const MOVE_TRANSITION_MS = 10 * 60 * 5.5;

/** Vertical gap between stacked labels that sit on the same edge midpoint. */
export const LABEL_LINE_HEIGHT = 13;

export const REPRESENTATIONS: readonly DepRepresentation[] = ["dm", "pas", "psd"];

export const DEP_COLORS: Record<DepRepresentation, string> = {
  dm: "#828f99",
  pas: "#9ca9aa",
  psd: "#bdd8c8",
};

export const FORCE = {
  linkDistance: TOKEN_SPACING,
  linkStrength: 0.01,
  collideRadius: 24,
  collideStrength: 0.9,
  chargeStrength: -30,
  chargeMaxDistance: TOKEN_SPACING * 2,
  anchorStrength: 0.01,
  alpha: 0.8,
  alphaDecay: 0.01,
  velocityDecay: 0.4,
};

export const TRANSITION_PROPS_WHILE_SIMULATING = "opacity, transform, color";

export type PointGetter = (tokenIndex: number) => { px: number; py: number } | undefined;
