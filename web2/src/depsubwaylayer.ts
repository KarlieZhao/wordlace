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
  private readonly getWordPos: (index: number) => { left: number; top: number; width: number };

  private sentenceWords: number[] = [];
  private hoveredWord: number | null = null;
  private metadata: WordMetadata[] | null = null;

  constructor(
    container: HTMLElement,
    words: WordLayer,
    edges: EdgeLayer,
    getWordPos: (index: number) => { left: number; top: number; width: number },
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
    const focus = this.hoveredWord;

    this.root.innerHTML = "";

    if (focus === null) {
      this.root.classList.remove("is-visible");
      return;
    }

    this.draw(focus);
  }

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
    const vectorSVG = document.querySelector(".vector-edges");
    if (!vectorSVG) return;

    const word = document.createElement("div");
    word.classList.add("the-word");
    word.textContent = this.words.getText(focus);

    this.root.appendChild(word);

    word.style.transform = `translateX(${-word.clientWidth / 2}px) translateY(-2.5rem)`;

    const spine = document.createElement("div");
    spine.className = "subway-spine";
    this.root.appendChild(spine);

    for (const row of this.buildRows(focus)) {
      const height = Math.max(ROW_MIN_HEIGHT, row.labels.length * LABEL_LINE_HEIGHT + 5);

      this.root.appendChild(this.buildRow(row, height));
    }

    this.root.classList.add("is-visible");

    spine.style.left = `${this.root.getBoundingClientRect().left}px`;
    spine.style.top = `${(window.innerHeight - this.root.clientHeight) / 2}px`;
    spine.style.height = `${this.root.clientHeight}px`;
  }

  private buildRows(focus: number): SubwayRow[] {
    const byOther = [];

    for (const edgeIndex of this.edges.incident(focus)) {
      const [head, child] = this.edges.endpoints(edgeIndex);
      const other = head === focus ? child : head;

      const direction: "from" | "to" = focus === child ? "from" : "to";

      const side: "left" | "right" = direction === "from" ? "right" : "left";

      byOther.push({
        wordIndex: other,
        label: this.edges.relationLabel(edgeIndex),
        side,
        direction,
        metadata: this.metadata?.[other] ?? {
          lemma: "",
          pos: "",
        },
      });
    }

    const groupedRows = new Map<
      string,
      {
        wordIndex: number;
        labels: string[];
        side: "left" | "right";
        direction: "from" | "to";
        metadata: WordMetadata;
      }
    >();

    byOther.forEach((row) => {
      const key = `${row.wordIndex}-${row.direction}`;
      const group = groupedRows.get(key);

      if (group) {
        group.labels.push(row.label);
      } else {
        groupedRows.set(key, {
          wordIndex: row.wordIndex,
          labels: [row.label],
          side: row.side,
          direction: row.direction,
          metadata: row.metadata,
        });
      }
    });

    return [...groupedRows.values()]
      .sort((a, b) => a.wordIndex - b.wordIndex)
      .map((group) => ({
        other: group.wordIndex,
        word: this.words.getText(group.wordIndex),
        labels: group.labels,
        side: group.side,
        direction: group.direction,
        metadata: group.metadata,
      }));
  }

  private buildRow(row: SubwayRow, height: number): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "subway-row";
    wrap.style.height = `${height + 15}px`;

    const branch = document.createElement("div");
    branch.className = `subway-branch subway-branch--${row.side} ` + `subway-branch--${row.direction}`;

    const labels = document.createElement("div");
    labels.className = "subway-labels";

    for (const text of row.labels) {
      const span = document.createElement("span");
      span.textContent = text;
      labels.appendChild(span);
    }

    const connector = document.createElement("div");
    connector.className = "subway-connector";

    const dot = document.createElement("span");
    dot.className = "subway-dot";

    const line = document.createElement("div");
    line.className = "subway-line";

    const wordWrapper = document.createElement("div");
    wordWrapper.className = "subway-word-wrapper";

    const word = document.createElement("span");
    word.className = "subway-word";
    word.textContent = row.word;

    const metadata = document.createElement("span");
    metadata.className = "subway-metadata";

    const lemma = document.createElement("b");
    lemma.textContent = row.metadata.lemma;

    const pos = document.createElement("span");
    pos.textContent = POS_LABELS[row.metadata.pos] ?? row.metadata.pos;

    metadata.append(lemma, document.createElement("br"), pos);
    wordWrapper.append(word, metadata);

    branch.append(labels, connector);
    wrap.appendChild(branch);

    const longestLabelWidth = getLongestLabelWidth(row.labels) + 30;
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
