import type { Point } from "./basedependency";
import { TOKEN_SPACING_X, TOKEN_TOP_PAD, TOKEN_SPACING_Y, TOP_PADDING, LEFT_PADDING } from "./config";

const ROW_GAP = 8;

export type Size = { width: number; height: number };
export type MeasureFn = (id: number, maxWidth: number) => Size;

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
    this.liveList = Array.from({ length: tokenCount }, () => ({ px: 0, py: 0 }));
  }

  computeTargetY(scores: number[]): number[] {
    return scores.map((v) => v * TOKEN_SPACING_Y + TOKEN_TOP_PAD);
  }

  sentenceTargets(
    start: number,
    end: number,
    targetY: (token: number) => number,
    useSrl = false,
    measure?: MeasureFn,
  ): { points: Point[]; width: number; crossExtent: number } {
    return this.sentenceTargetsFor(
      Array.from({ length: end - start }, (_, i) => start + i),
      targetY,
      useSrl,
      measure,
    );
  }

  sentenceTargetsFor(
    indices: number[],
    targetY: (token: number) => number,
    useSrl = false,
    measure?: MeasureFn,
    containerWidth: number = this.wordContainer.clientWidth,
  ): { points: Point[]; width: number; crossExtent: number } {
    const minPitch = TOKEN_SPACING_X * (useSrl ? 1.6 : 1);
    const hasWidth = containerWidth > 0;
    const usable = hasWidth ? Math.max(50, containerWidth) : Infinity;

    let y = TOP_PADDING;
    let maxRight = 0;

    const points: Point[] = indices.map((id) => {
      const { width, height } = measure ? measure(id, usable) : { width: 0, height: 0 };
      const half = width / 2;

      let x = targetY(id) + LEFT_PADDING;
      if (hasWidth) {
        x = Math.min(Math.max(x + half), containerWidth - half);
      }

      const point: Point = { px: y, py: x };

      y += Math.max(minPitch, height + ROW_GAP);
      maxRight = Math.max(maxRight, x + half);

      return point;
    });

    return {
      points,
      width: y,
      crossExtent: maxRight,
    };
  }
}

export function originX(parent: HTMLElement | null): { left: number; top: number } {
  if (!parent) return { left: 0, top: 0 };
  const r = parent.getBoundingClientRect();
  return {
    left: parent.scrollLeft - r.left - parent.clientLeft,
    top: r.top + parent.clientTop - parent.scrollTop,
  };
}
