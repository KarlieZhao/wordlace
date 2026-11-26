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
  // private readonly getWordPos: (index: number) => { left: number; top: number; width: number };

  private sentenceWords: number[] = [];
  private hoveredWord: number | null = null;
  private metadata: WordMetadata[] | null = null;
  private containerWidth: number = 0;

  constructor(
    container: HTMLElement,
    words: WordLayer,
    edges: EdgeLayer,
    // getWordPos: (index: number) => { left: number; top: number; width: number },
  ) {
    this.root = container;
    this.root.classList.add("dependency-subway");

    this.words = words;
    this.edges = edges;
    // this.getWordPos = getWordPos;

    window.addEventListener("resize", () => {
      this.resize();
    });
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
    this.containerWidth = this.root.getBoundingClientRect().width;
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
    this.root.innerHTML = "";
    if (!vectorSVG) return;

    const word = document.createElement("div");
    word.classList.add("the-word");
    word.textContent = this.words.getText(focus);

    const spineTop = document.createElement("div");
    spineTop.className = "subway-spine spine-top";

    const spineBottom = document.createElement("div");
    spineBottom.className = "subway-spine spine-btm";

    const rows = this.buildRows(focus); // already sorted by word index

    const above: SubwayRow[] = [],
      below: SubwayRow[] = [];

    rows.forEach((r) => {
      if (r.other < focus) above.push(r);
      else below.push(r);
    });

    // words before the selected word: above
    for (const row of above) {
      this.root.appendChild(this.buildRow(row));
    }

    const topHeight = this.root.clientHeight;
    spineTop.style.height = `${topHeight}px`;
    // selected word
    this.root.appendChild(word);
    word.style.transform = `translateX(${-Math.min(word.clientWidth / 2, 30)}px) translateY(-2.5rem)`;

    // words after the selected word: below
    for (const row of below) {
      this.root.appendChild(this.buildRow(row));
    }
    this.root.classList.add("is-visible");
    this.placeSpine(spineTop, spineBottom, word);

    if (above.length > 0) {
      this.root.appendChild(spineTop);
    }
    if (below.length > 0) {
      spineBottom.style.height = `${this.root.clientHeight - topHeight}px`;
      this.root.appendChild(spineBottom);
    }
  }

  private resize() {
    const spineTop = this.root.querySelector(".spine-top") as null | HTMLDivElement;
    const spineBottom = this.root.querySelector(".spine-btm") as null | HTMLDivElement;
    if (!spineTop && !spineBottom) return;
    this.placeSpine(spineTop, spineBottom);
  }

  private placeSpine(
    spineTop: null | HTMLDivElement,
    spineBottom: null | HTMLDivElement,
    word: HTMLDivElement | null = this.root.querySelector(".the-word"),
  ) {
    if (spineTop) {
      // spineTop.style.left = `${rootBbox.left}px`;
      spineTop.style.top = `${(window.innerHeight - this.root.clientHeight) / 2}px`;
    }
    if (spineBottom && word) {
      const wordBbox = word.getBoundingClientRect();
      spineBottom.style.top = `${wordBbox.top + wordBbox.height + 15}px`;
    }
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

  private buildRow(row: SubwayRow): HTMLElement {
    const labelCount = row.links.reduce((n, link) => n + link.labels.length, 0);
    const gap = row.links.length > 1 ? LINE_GAP : 0;
    const height = Math.max(ROW_MIN_HEIGHT, labelCount * LABEL_LINE_HEIGHT + gap + 5);

    const wrap = document.createElement("div");
    wrap.className = "subway-row";
    wrap.style.height = `${height}px`;
    wrap.style.marginTop = `${height / 2}px`;
    wrap.style.marginBottom = `${height / 2}px`;

    const fromLink = row.links.find((link) => link.direction === "from");
    const toLink = row.links.find((link) => link.direction === "to");

    const connector = document.createElement("div");
    connector.classList.add("subway-connector", `subway-branch`, `subway-branch--${row.side}`);

    const dot = document.createElement("span");
    dot.className = "subway-dot";

    const lineWidth = getLongestLabelWidth(row.links.flatMap((l) => l.labels)) + 30;

    const lines = document.createElement("div");
    lines.className = "subway-lines";

    if (fromLink) lines.appendChild(this.buildLabels(fromLink));

    for (const link of row.links) {
      const line = document.createElement("div");
      line.className = `subway-line subway-line--${link.direction}`;
      // above: arrow on the left pointing left; below: arrow on the right pointing right
      line.classList.add(link.direction === "from" ? "subway-line--arrow-left" : "subway-line--arrow-right");
      line.style.width = `${lineWidth}px`;
      lines.appendChild(line);
    }

    if (toLink) lines.appendChild(this.buildLabels(toLink));

    const wordWrapper = document.createElement("div");
    wordWrapper.className = "subway-word-wrapper";

    const word = document.createElement("span");
    word.className = "subway-word";
    word.textContent = row.word;

    const metadata = document.createElement("div");
    metadata.className = "subway-metadata";
    const maxW = Math.max(100, this.containerWidth - lineWidth + 10);
    metadata.style.width = `${maxW}px`;
    const lemma = document.createElement("b");
    lemma.textContent = row.metadata.lemma;

    const pos = document.createElement("span");
    pos.textContent = POS_LABELS[row.metadata.pos] ?? row.metadata.pos;

    metadata.append(lemma, document.createElement("br"), pos);
    wordWrapper.append(word, metadata);

    connector.append(dot, lines, wordWrapper);
    wrap.appendChild(connector);

    return wrap;
  }

  private buildLabels(link: SubwayLink): HTMLElement {
    const container = document.createElement("div");
    container.className = `subway-labels subway-labels--${link.direction}`;
    const labels = [...new Set(link.labels)];
    for (const text of labels) {
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
