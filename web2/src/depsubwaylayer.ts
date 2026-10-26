import type { EdgeLayer } from "./edgelayer";
import type { WordLayer } from "./wordlayer";

interface SubwayRow {
  other: number;
  word: string;
  labels: string[];
  side: "left" | "right";
  direction: "from" | "to"
}

const LABEL_LINE_HEIGHT = 20;
const ROW_MIN_HEIGHT = 40;

export class SubwayLayer {
  readonly root: HTMLElement;
  private readonly words: WordLayer;
  private readonly edges: EdgeLayer;
  private readonly getWordX: (index: number) => { left: number, top: number };
  private sentenceWords: number[] = [];
  private hoveredWord: number | null = null;

  constructor(container: HTMLElement, words: WordLayer, edges: EdgeLayer, getWordX: (index: number) => { left: number, top: number }) {
    this.root = container;
    this.root.classList.add("dependency-subway");
    this.words = words;
    this.edges = edges;
    this.getWordX = getWordX;
  }

  setSentenceWords(indices: number[]): void {
    this.sentenceWords = indices;
    this.render();
  }

  setHoveredWord(token: number | null): void {
    if (this.hoveredWord === token) return;
    this.hoveredWord = token;
    this.render();
    this.edges.setColors(this.hoveredWord);
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

  /** Word with the most incident edges */
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
    const { left, top } = this.getWordX(focus);
    const vectorSVG = document.querySelector(".vector-edges")
    const spine = document.createElement("div");
    spine.className = "subway-spine";
    spine.style.left = `${left}px`;
    this.root.appendChild(spine);

    const rows = this.buildRows(focus);
    let totalHeight = 0;
    for (const row of rows) {
      const height = Math.max(ROW_MIN_HEIGHT, row.labels.length * LABEL_LINE_HEIGHT + 5);
      totalHeight += height;
      this.root.appendChild(this.buildRow(row, left, height));
    }

    this.root.style.marginTop = `${vectorSVG?.clientHeight}px`;
    this.root.classList.add("is-visible");
  }

  private buildRows(focus: number): SubwayRow[] {
    const byOther = [];
    for (const e of this.edges.incident(focus)) {
      const [head, child] = this.edges.endpoints(e);
      const other = head === focus ? child : head;
      const side: "left" | "right" = focus - other > 0 ? "left" : "right";
      const fromOrTo: "from" | "to" = focus === child ? "from" : "to";
      const group = { wordIndex: other, label: this.edges.relationLabel(e), side, direction: fromOrTo };
      byOther.push(group);
    }

    // group them so that items with same wordindex + side are combined
    const groupedRows = new Map<string, { wordIndex: number; labels: string[]; side: "left" | "right", direction: "from" | "to" }>();
    byOther.forEach(row => {
      const group = groupedRows.get(`${row.wordIndex}-${row.direction}`);
      if (group) {
        group.labels.push(row.label)
      } else {
        groupedRows.set(`${row.wordIndex}-${row.direction}`, { wordIndex: row.wordIndex, labels: [row.label], side: row.side, direction: row.direction });
      }
    })

    const rows = [...groupedRows.values()]
      .sort((a, b) => a.wordIndex - b.wordIndex)
      .map((g) => ({ other: g.wordIndex, word: this.words.getText(g.wordIndex), labels: g.labels, side: g.side, direction: g.direction }));
    return rows;
  }

  private buildRow(row: SubwayRow, spineX: number, height: number): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "subway-row";
    wrap.style.height = `${height}px`;

    const branch = document.createElement("div");
    branch.className = `subway-branch subway-branch--${row.side} subway-branch--${row.direction}`;
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