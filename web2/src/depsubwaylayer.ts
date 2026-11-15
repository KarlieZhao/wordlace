import type { WordMetadata } from "./basedependency";
import type { EdgeLayer } from "./edgelayer";
import { POS_LABELS } from "./labels";
import type { WordLayer } from "./wordlayer";

interface SubwayLink {
  direction: "from" | "to";
  labels: string[];
}

interface SubwayRow {
  other: number;
  word: string;
  links: SubwayLink[];
  side: "left" | "right";
  metadata: WordMetadata;
}

const LABEL_LINE_HEIGHT = 20;
const ROW_MIN_HEIGHT = 40;
const LINE_GAP = 8;
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
      const labelCount = row.links.reduce((n, link) => n + link.labels.length, 0);
      const gap = row.links.length > 1 ? LINE_GAP : 0;
      const height = Math.max(ROW_MIN_HEIGHT, labelCount * LABEL_LINE_HEIGHT + gap + 5);

      this.root.appendChild(this.buildRow(row, height));
    }

    this.root.classList.add("is-visible");

    spine.style.left = `${this.root.getBoundingClientRect().left}px`;
    spine.style.top = `${(window.innerHeight - this.root.clientHeight) / 2}px`;
    spine.style.height = `${this.root.clientHeight}px`;
  }

  private buildRows(focus: number): SubwayRow[] {
    const side: "left" | "right" = "right";

    const grouped = new Map<number, { links: Map<"from" | "to", string[]>; metadata: WordMetadata }>();

    for (const edgeIndex of this.edges.incident(focus)) {
      const [head, child] = this.edges.endpoints(edgeIndex);
      const other = head === focus ? child : head;
      const direction: "from" | "to" = focus === child ? "from" : "to";
      const label = this.edges.relationLabel(edgeIndex);

      let group = grouped.get(other);
      if (!group) {
        group = {
          links: new Map(),
          metadata: this.metadata?.[other] ?? { lemma: "", pos: "" },
        };
        grouped.set(other, group);
      }

      const labels = group.links.get(direction);
      if (labels) labels.push(label);
      else group.links.set(direction, [label]);
    }

    return [...grouped.entries()]
      .sort(([a], [b]) => a - b)
      .map(([other, group]) => ({
        other,
        word: this.words.getText(other),
        side,
        metadata: group.metadata,
        links: (["from", "to"] as const)
          .filter((direction) => group.links.has(direction))
          .map((direction) => ({ direction, labels: group.links.get(direction)! })),
      }));
  }

  private buildRow(row: SubwayRow, height: number): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "subway-row";
    wrap.style.height = `${height + 15}px`;
    wrap.style.marginTop = `${height / 2}px`;

    const branch = document.createElement("div");
    branch.className = `subway-branch subway-branch--${row.side}`;
    const fromLink = row.links.find((link) => link.direction === "from");
    const toLink = row.links.find((link) => link.direction === "to");

    const labelsAbove = fromLink ? this.buildLabels(fromLink) : "";
    const labelsBelow = toLink ? this.buildLabels(toLink) : "";

    const connector = document.createElement("div");
    connector.className = "subway-connector";

    const dot = document.createElement("span");
    dot.className = "subway-dot";

    const lineWidth = getLongestLabelWidth(row.links.flatMap((l) => l.labels)) + 30;

    const lines = document.createElement("div");
    lines.className = "subway-lines";

    for (const link of row.links) {
      const line = document.createElement("div");
      line.className = `subway-line subway-line--${link.direction}`;
      line.style.width = `${lineWidth}px`;
      lines.appendChild(line);
    }

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

    // if (row.side === "right") {
    connector.append(dot, lines, wordWrapper);
    // } else {
    //   connector.append(wordWrapper, lines, dot);
    // }

    branch.append(labelsAbove, connector);
    if (labelsBelow) branch.appendChild(labelsBelow);
    wrap.appendChild(branch);

    return wrap;
  }
  private buildLabels(link: SubwayLink): HTMLElement {
    const container = document.createElement("div");
    container.className = `subway-labels subway-labels--${link.direction}`;

    for (const text of link.labels) {
      const span = document.createElement("span");
      span.textContent = text;
      container.appendChild(span);
    }

    return container;
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
