import type { WordMetadata } from "./basedependency";
import type { EdgeLayer } from "./edgelayer";
import { POS_LABELS } from "./labels";
import type { WordLayer } from "./wordlayer";

interface SubwayRow {
  other: number;
  word: string;
  labels: string[];
  side: "left" | "right";
  direction: "from" | "to";
  metadata: WordMetadata;
}

const LABEL_LINE_HEIGHT = 20;
const ROW_MIN_HEIGHT = 40;

export class SubwayLayer {
  readonly root: HTMLElement;
  private readonly words: WordLayer;
  private readonly edges: EdgeLayer;
  private readonly getWordPos: (index: number) => { left: number; top: number };
  private sentenceWords: number[] = [];
  private hoveredWord: number | null = null;
  private metadata: WordMetadata[] | null = null;

  constructor(
    container: HTMLElement,
    words: WordLayer,
    edges: EdgeLayer,
    getWordPos: (index: number) => { left: number; top: number },
  ) {
    this.root = container;
    this.root.classList.add("dependency-subway");
    this.words = words;
    this.edges = edges;
    this.getWordPos = getWordPos;
  }
  loadMetadata(metadata: WordMetadata[]): void {
    this.metadata = metadata;
  }

  setSentenceWords(indices: number[]): void {
    this.sentenceWords = indices;
  }

  setHoveredWord(token: number | null): void {
    if (this.hoveredWord === token) return;
    this.hoveredWord = token;
    this.render();
    this.edges.setColors(this.hoveredWord);
  }

  render(): void {
    const focus = this.hoveredWord; //?? this.defaultWord();

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
    const { left, top } = this.getWordPos(focus);

    const vectorSVG = document.querySelector(".vector-edges");
    if (!vectorSVG) return;
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
    const GAP = 55;

    this.root.style.marginTop = `${-GAP}px`;
    this.root.classList.add("is-visible");
    const spineHeight = GAP + this.root.clientHeight + vectorSVG.clientHeight - top;
    spine.style.height = `${spineHeight}px`;
    spine.style.top = `${top - vectorSVG.clientHeight - GAP}px`;
    if (top > window.innerHeight / 2 - 200) {
      this.root.style.position = "absolute";
      this.root.style.top = `${top - vectorSVG.clientHeight + 120 + GAP}px`; // todo: figure out the math
    } else {
      this.root.style.position = "relative";
      this.root.style.top = "0px";
    }
  }

  private buildRows(focus: number): SubwayRow[] {
    const byOther = [];
    for (const e of this.edges.incident(focus)) {
      const [head, child] = this.edges.endpoints(e);
      const other = head === focus ? child : head;
      // const side: "left" | "right" = focus - other > 0 ? "left" : "right";
      const fromOrTo: "from" | "to" = focus === child ? "from" : "to";
      const side: "left" | "right" = fromOrTo === "from" ? "right" : "left";
      const group = {
        wordIndex: other,
        label: this.edges.relationLabel(e),
        side,
        direction: fromOrTo,
        metadata: this.metadata ? this.metadata[other] : { lemma: "", pos: "" },
      };
      byOther.push(group);
    }

    // group them so that items with same wordindex + side are combined
    const groupedRows = new Map<
      string,
      { wordIndex: number; labels: string[]; side: "left" | "right"; direction: "from" | "to"; metadata: WordMetadata }
    >();
    byOther.forEach((row) => {
      const group = groupedRows.get(`${row.wordIndex}-${row.direction}`);
      if (group) {
        group.labels.push(row.label);
      } else {
        groupedRows.set(`${row.wordIndex}-${row.direction}`, {
          wordIndex: row.wordIndex,
          labels: [row.label],
          side: row.side,
          direction: row.direction,
          metadata: row.metadata,
        });
      }
    });

    const rows = [...groupedRows.values()]
      .sort((a, b) => a.wordIndex - b.wordIndex)
      .map((g) => ({
        other: g.wordIndex,
        word: this.words.getText(g.wordIndex),
        labels: g.labels,
        side: g.side,
        direction: g.direction,
        metadata: g.metadata,
      }));
    return rows;
  }

  private buildRow(row: SubwayRow, spineX: number, height: number): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "subway-row";
    wrap.style.height = `${height + 15}px`;

    const branch = document.createElement("div");
    branch.className = `subway-branch subway-branch--${row.side} subway-branch--${row.direction}`;
    branch.style.left = `${spineX}px`;

    const labels = document.createElement("div");
    labels.className = "subway-labels";

    for (const text of row.labels) {
      const s = document.createElement("span");
      s.textContent = text;
      labels.appendChild(s);
    }

    const connector = document.createElement("div");
    connector.className = "subway-connector";

    const dot = document.createElement("span");
    dot.className = "subway-dot";
    const line = document.createElement("div");
    const wordWrapper = document.createElement("div");
    wordWrapper.className = "subway-word-wrapper";

    const word = document.createElement("span");
    word.className = "subway-word";
    word.textContent = row.word;

    const metadata = document.createElement("span");
    metadata.className = "subway-metadata";
    metadata.textContent = `${row.metadata.lemma}, ${POS_LABELS[row.metadata.pos]}`;

    wordWrapper.append(word, metadata);

    branch.append(labels, connector);
    wrap.appendChild(branch);

    const longestLabelWidth = getLongestLabelWidth(row.labels) + 30;
    line.style.width = `${longestLabelWidth}px`;
    line.className = "subway-line";
    line.style.width = `${longestLabelWidth}px`;

    if (row.side === "right") {
      connector.append(dot, line, wordWrapper);
    } else {
      connector.append(wordWrapper, line, dot);
    }

    return wrap;
  }
}

function getLongestLabelWidth(texts: string[]): number {
  const measureContainer = document.createElement("div");
  measureContainer.className = "subway-labels";

  Object.assign(measureContainer.style, {
    position: "absolute",
    visibility: "hidden",
    width: "max-content",
    height: "auto",
    pointerEvents: "none",
    top: "0",
    left: "0",
  });

  for (const text of texts) {
    const span = document.createElement("span");
    span.textContent = text;
    measureContainer.appendChild(span);
  }

  document.body.appendChild(measureContainer);
  const width = Math.max(0, ...Array.from(measureContainer.children, (el) => el.getBoundingClientRect().width));
  measureContainer.remove();
  return width;
}
