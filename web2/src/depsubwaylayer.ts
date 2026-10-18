import type { EdgeLayer } from "./EdgeLayer";
import type { WordLayer } from "./WordLayer";

interface SubwayRow {
  other: number;
  word: string;
  labels: string[];
  side: "left" | "right";
}

const LABEL_LINE_HEIGHT = 20;
const ROW_MIN_HEIGHT = 40;

/**
 * "Subway map" view of one word's direct dependency links.
 *
 * Focus word resolution (no external caller decides this):
 *  - If a word is currently hovered, show that word.
 *  - Otherwise, show the "default" word: whichever word in the current
 *    sentence has the most incident edges, ties broken by earliest
 *    position in the sentence.
 *
 * Diagram, once a focus word is resolved:
 *  - A vertical spine positioned at the focus word's x in the full-line
 *    sentence render (via `getWordX`).
 *  - One row per word linked to the focus word (as head or child),
 *    top-to-bottom in sentence order.
 *  - A row sits LEFT of the spine when the focus word is the head of that
 *    relation (focus -> linked word), RIGHT when the focus word is the
 *    child (linked word -> focus).
 *  - Relation label(s) render above each row's connector line.
 */
export class SubwayLayer {
  readonly root: HTMLElement;
  private readonly words: WordLayer;
  private readonly edges: EdgeLayer;
  private readonly getWordX: (index: number) => number;

  /** Current sentence's tokens, in sentence order. Drives the default word + row order. */
  private sentenceWords: number[] = [];
  private hoveredWord: number | null = null;

  constructor(container: HTMLElement, words: WordLayer, edges: EdgeLayer, getWordX: (index: number) => number) {
    this.root = container;
    this.root.classList.add("dependency-subway");
    this.words = words;
    this.edges = edges;
    this.getWordX = getWordX;
  }

  /**
   * Call whenever the active sentence's edges are (re)built. `indices` must
   * be the sentence's token indices in sentence order.
   */
  setSentenceWords(indices: number[]): void {
    this.sentenceWords = indices;
    this.render();
  }

  /** Forward from word hover. `null` reverts to the default focus word. */
  setHoveredWord(token: number | null): void {
    if (this.hoveredWord === token) return;
    this.hoveredWord = token;
    this.render();
  }

  private render(): void {
    const focus = this.hoveredWord ?? this.defaultWord();

    this.root.innerHTML = "";
    if (focus === null) {
      this.root.classList.remove("is-visible");
      return;
    }

    this.draw(focus);
  }

  /** Word with the most incident edges; ties go to the earliest in sentence order. */
  private defaultWord(): number | null {
    let best: number | null = null;
    let bestCount = -1;
    for (const token of this.sentenceWords) {
      const count = this.edges.incident(token).length;
      if (count > bestCount) {
        best = token;
        bestCount = count;
      }
    }

    return best;
  }

  private draw(focus: number): void {
    const x = this.getWordX(focus);
    const spine = document.createElement("div");
    spine.className = "subway-spine";
    spine.style.left = `${x}px`;
    this.root.appendChild(spine);

    const rows = this.buildRows(focus);
    for (const row of rows) {
      const height = Math.max(ROW_MIN_HEIGHT, row.labels.length * LABEL_LINE_HEIGHT + 5);
      this.root.appendChild(this.buildRow(row, x, height));
    }

    this.root.classList.add("is-visible");
  }

  private buildRows(focus: number): SubwayRow[] {
    const byOther = new Map<number, { other: number; labels: string[]; side: "left" | "right" }>();

    for (const e of this.edges.incident(focus)) {
      const [head, child] = this.edges.endpoints(e);
      const other = head === focus ? child : head;
      const side: "left" | "right" = other < focus ? "left" : "right";

      const group = byOther.get(other) ?? { other, labels: [], side };
      group.labels.push(this.edges.relationLabel(e));
      byOther.set(other, group);
    }

    return [...byOther.values()]
      .sort((a, b) => b.other - a.other)
      .map((g) => ({ other: g.other, word: this.words.getText(g.other), labels: g.labels, side: g.side }));
  }

  private buildRow(row: SubwayRow, spineX: number, height: number): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "subway-row";
    wrap.style.height = `${height}px`;

    const branch = document.createElement("div");
    branch.className = `subway-branch subway-branch--${row.side}`;
    branch.style.left = `${spineX}px`;

    const labels = document.createElement("div");
    labels.className = "subway-labels";
    let longestLabelLen = 0;
    for (const text of row.labels) {
      const s = document.createElement("span");
      s.textContent = text;
      labels.appendChild(s);
      if (text.length > longestLabelLen) longestLabelLen = text.length;
    }

    const connector = document.createElement("div");
    connector.className = "subway-connector";

    const dot = document.createElement("span");
    dot.className = "subway-dot";
    const line = document.createElement("div");
    line.className = "subway-line";
    line.style.width = `${longestLabelLen * 7}px`;
    const word = document.createElement("span");
    word.className = "subway-word";
    word.textContent = row.word;

    if (row.side === "right") {
      connector.append(dot, line, word);
    } else {
      connector.append(word, line, dot);
    }

    branch.append(labels, connector);
    wrap.appendChild(branch);
    return wrap;
  }
}
