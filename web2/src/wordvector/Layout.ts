import {
  computeBounds,
  elementSize,
  hasOwn,
  projectX,
  projectY,
  type Axis,
  type Bounds,
  type Point,
  type RenderMode,
  type VectorPos,
  type Vectors,
} from "./basedependency";
import { DEFAULT_X_POS, TOKEN_SPACING_X, TOKEN_TOP_PAD, TOKEN_SPACING_Y } from "./config";

/**
 * Owns every position a token can have:
 *  - cloud: fixed by the word vector (per unique word)
 *  - seq:   the sentence-order line along x or y (per token)
 *  - live:  persistent, mutable positions (per token) that the force simulation writes into
 */
export class Layout {
  private cloud: VectorPos = {};
  private seq: Record<Axis, Point[]> = { x: [], y: [] };
  private liveList: Point[] | null = null;
  private axis: Axis = "x";
  private readonly wordContainer: HTMLElement;
  private readonly lineContainer: HTMLElement;

  constructor(wordContainer: HTMLElement, lineContainer: HTMLElement) {
    this.wordContainer = wordContainer;
    this.lineContainer = lineContainer;
  }

  get live(): Point[] | null {
    return this.liveList;
  }

  get ready(): boolean {
    return this.liveList !== null;
  }

  /** `scores[i]` is token i's connectivity; it decides the height in the x-axis layout. */
  build(vectors: Vectors, tokens: string[]): void {
    const bounds = computeBounds(vectors);

    this.cloud = bounds ? this.buildCloud(vectors, bounds) : {};
    this.seq = {
      x: this.buildSeqX(tokens),
      y: bounds ? this.buildSeqY(vectors, bounds, tokens) : [],
    };
    this.applyExtent(tokens.length);

    this.resetLive(this.axis);
  }

  computeTargetY(scores: number[]): number[] {
    return scores.map((v) => {
      return v * TOKEN_SPACING_Y + TOKEN_TOP_PAD;
    });
  }

  resetLive(axis: Axis): void {
    this.axis = axis;
    this.liveList = this.seq[axis].map((p) => ({ px: p.px, py: p.py }));
  }

  /** Where a token is drawn in the given mode. */
  point(mode: RenderMode, index: number, word: string): Point | undefined {
    return mode === 0 ? this.cloud[word] : this.liveList?.[index];
  }

  private buildCloud(vectors: Vectors, bounds: Bounds): VectorPos {
    const { width, height } = elementSize(this.wordContainer, 800, 600);
    const positions: VectorPos = {};

    for (const word in vectors) {
      const [x, y] = vectors[word];
      positions[word] = {
        px: projectX(x, bounds, width),
        py: projectY(y, bounds, height),
      };
    }
    return positions;
  }

  /** Along x in sentence order; y from connectivity (more connected = higher up). */

  // OR ypos can be:
  // - wordvec embedding
  // - score: connectivity
  // - POS
  // frequency of appearance in passage (exclude common words)
  private buildSeqX(tokens: string[]): Point[] {
    // let max = 0;
    // for (const v of scores) if (v > max) max = v;
    let xpos = 0;
    return tokens.map((_, i): Point => {
      const lastToken = this.wordContainer.querySelector(`[data-index="${i - 1}"]`);
      const lastTokenWidth = lastToken ? lastToken.getBoundingClientRect().width : 0;
      xpos += lastTokenWidth + TOKEN_SPACING_X;
      return { px: xpos, py: 0 };
    });
  }

  /** Along y in sentence order; x still comes from the word vectors. */
  private buildSeqY(vectors: Vectors, bounds: Bounds, tokens: string[]): Point[] {
    const { width } = elementSize(this.wordContainer, 600, 600);

    return tokens.map((rawWord, i): Point => {
      const vec = hasOwn(vectors, rawWord.toLocaleLowerCase()) ? vectors[rawWord.toLocaleLowerCase()] : null;
      return { px: vec ? projectX(vec[0], bounds, width) : DEFAULT_X_POS, py: i * TOKEN_SPACING_Y };
    });
  }

  private applyExtent(count: number): void {
    const extent = `${Math.max(0, count - 1) * TOKEN_SPACING_X}px`;
    this.lineContainer.style.width = extent;
    // this.lineContainer.style.height = extent;
  }
}

export function originX(parent: HTMLElement | null): { left: number; top: number } {
  if (!parent) return { left: 0, top: 0 };
  const r = parent.getBoundingClientRect();
  return { left: parent.scrollLeft - r.left - parent.clientLeft, top: r.top + parent.clientTop - parent.scrollTop };
}
