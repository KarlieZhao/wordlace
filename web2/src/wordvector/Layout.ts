import type { Point } from "./basedependency";
import { TOKEN_SPACING_X, TOKEN_TOP_PAD, TOKEN_SPACING_Y } from "./config";

export const LEFT_PADDING = 40;

/**
 * Owns token positions:
 *  - live:    where each token is currently drawn (per token).
 *  - targets: where a sentence's tokens should end up. Computed on the fly, never stored.
 */
export class Layout {
  private liveList: Point[] = [];
  private readonly wordContainer: HTMLElement;

  constructor(wordContainer: HTMLElement) {
    this.wordContainer = wordContainer;
  }

  get live(): Point[] {
    return this.liveList;
  }

  build(tokenCount: number): void {
    this.liveList = Array.from({ length: tokenCount }, () => ({ px: LEFT_PADDING, py: 0 }));
  }

  /** `scores[i]` is token i's dependency connectivity; it decides the row. */
  computeTargetY(scores: number[]): number[] {
    return scores.map((v) => v * TOKEN_SPACING_Y + TOKEN_TOP_PAD);
  }

  sentenceTargets(start: number, end: number, targetY: (token: number) => number): { points: Point[]; width: number } {
    const points: Point[] = [];
    let x = LEFT_PADDING;

    for (let i = start; i < end; i++) {
      points.push({ px: x, py: targetY(i) });
      x += this.widthOf(i) + TOKEN_SPACING_X;
    }

    return { points, width: x - TOKEN_SPACING_X + LEFT_PADDING };
  }

  setLive(start: number, targets: Point[]): void {
    targets.forEach((t, k) => {
      this.liveList[start + k] = t;
    });
  }

  private widthOf(index: number): number {
    const el = this.wordContainer.querySelector(`[data-index="${index}"]`);
    return el ? el.getBoundingClientRect().width : 0;
  }
}

export function originX(parent: HTMLElement | null): { left: number; top: number } {
  if (!parent) return { left: 0, top: 0 };
  const r = parent.getBoundingClientRect();
  return { left: parent.scrollLeft - r.left - parent.clientLeft, top: r.top + parent.clientTop - parent.scrollTop };
}
