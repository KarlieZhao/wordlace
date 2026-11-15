import type { Point } from "./basedependency";
import { TOKEN_SPACING_X, TOKEN_TOP_PAD, TOKEN_SPACING_Y, TOP_PADDING, LEFT_PADDING } from "./config";

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
  ): { points: Point[]; width: number } {
    return this.sentenceTargetsFor(
      Array.from({ length: end - start }, (_, i) => start + i),
      targetY,
      useSrl,
    );
  }

  sentenceTargetsFor(
    indices: number[],
    targetY: (token: number) => number,
    useSrl = false,
  ): { points: Point[]; width: number } {
    const points: Point[] = [];
    let x = TOP_PADDING;

    for (const id of indices) {
      points.push({ px: x, py: targetY(id) + LEFT_PADDING });
      x += TOKEN_SPACING_X * (useSrl ? 1.6 : 1);
    }
    return { points, width: x - TOKEN_SPACING_X };
  }

  // private getWordElWidth(index: number): number {
  //   const el = this.wordContainer.querySelector(`[data-index="${index}"]`);
  //   return el ? el.getBoundingClientRect().width : 0;
  // }
}

export function originX(parent: HTMLElement | null): {
  left: number;
  top: number;
} {
  if (!parent) return { left: 0, top: 0 };

  const r = parent.getBoundingClientRect();

  return {
    left: parent.scrollLeft - r.left - parent.clientLeft,
    top: r.top + parent.clientTop - parent.scrollTop,
  };
}
