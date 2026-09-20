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
import { DEFAULT_X_POS, DEFAULT_Y_POS, TOKEN_SPACING } from "./config";

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

  build(vectors: Vectors, tokens: string[]): void {
    const bounds = computeBounds(vectors);

    this.cloud = bounds ? this.buildCloud(vectors, bounds) : {};
    this.seq = {
      x: bounds ? this.buildSeq("x", vectors, bounds, tokens) : [],
      y: bounds ? this.buildSeq("y", vectors, bounds, tokens) : [],
    };

    this.resetLive(this.axis);
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

  private buildSeq(axis: Axis, vectors: Vectors, bounds: Bounds, tokens: string[]): Point[] {
    const { width, height } = elementSize(this.wordContainer, 600, 600);

    const positions = tokens.map((rawWord, i): Point => {
      const along = i * TOKEN_SPACING;
      const word = rawWord.toLocaleLowerCase();
      const vec = hasOwn(vectors, word) ? vectors[word] : null;

      return axis === "x"
        ? { px: along, py: vec ? projectY(vec[1], bounds, height) : DEFAULT_Y_POS }
        : { px: vec ? projectX(vec[0], bounds, width) : DEFAULT_X_POS, py: along };
    });

    const extent = `${Math.max(0, tokens.length - 1) * TOKEN_SPACING}px`;
    if (axis === "x") this.lineContainer.style.width = extent;
    else this.lineContainer.style.height = extent;

    return positions;
  }
}
