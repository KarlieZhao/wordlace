import { BaseDependencyRenderer } from "./basedependency";
import { SubwayLayer } from "./depsubwaylayer";
import { DependencyGraph } from "./depgraph";
import { EdgeLayer, type EdgeInput } from "./edgelayer";
import { HoverController } from "./hovercontroll";
import { Layout } from "./layout";
import { WordLayer } from "./wordlayer";
import { type WordMetadata } from "./basedependency";

interface ProjectedNode {
  id: number;
  start: number;
  end: number;
  text: string;
  entityType?: string;
}

type NerSpan = [string, string, number, number];

export class WordVecRenderer extends BaseDependencyRenderer {
  private readonly wordContainer: HTMLDivElement;
  private readonly lineContainer: HTMLDivElement;

  private readonly graph = new DependencyGraph();
  private readonly layout: Layout;
  private readonly words: WordLayer;
  private readonly edges: EdgeLayer;
  private readonly hover: HoverController;
  private readonly subway: SubwayLayer;

  private wordMetadata: WordMetadata[] = [];
  private sentenceIndex = 0;
  private loaded = false;
  private lockedToken: number | null = null;

  private targetYById: number[] = [];
  private wordEls: HTMLElement[] = [];

  /** Original token ID -> projected node ID. */
  private tokenToNode: number[] = [];

  /** Projected nodes, grouped by sentence. */
  private nodesBySentence: ProjectedNode[][] = [];

  private wordClickCallback: (sentence: number, token: number) => void;

  constructor(
    wordClickCallback: (sentence: number, token: number) => void,
    focusCallback: (indices: ReadonlySet<number> | null) => void,
  ) {
    super(".vector-plot");

    this.wordClickCallback = wordClickCallback;

    this.wordContainer = document.querySelector(".word-plot") as HTMLDivElement;

    this.lineContainer = this.container as HTMLDivElement;

    const subwayContainer = document.querySelector(".dependency-subway-container") as HTMLElement;

    this.layout = new Layout(this.wordContainer);
    this.words = new WordLayer(this.wordContainer);

    this.edges = new EdgeLayer(this.lineContainer, (i) => this.layout.live[i]);

    this.hover = new HoverController(this.words, this.edges);

    this.words.onFocusChange((indices) => {
      if (indices === null) {
        focusCallback(null);
        return;
      }

      // Expand projected entity nodes back to their original tokens.
      const originalIndices = new Set<number>();

      for (const id of indices) {
        const node = this.getNode(id);
        if (!node) continue;

        for (let i = node.start; i < node.end; i++) {
          originalIndices.add(i);
        }
      }

      focusCallback(originalIndices);
    });

    const getHoveredWordPos = (index: number): { left: number; top: number; width: number } => {
      const el = this.wordEls[index];

      if (!el) return { left: 0, top: 0, width: 0 };

      return {
        left: parseFloat(el.style.left) - el.offsetWidth / 2,
        top: parseFloat(el.style.top),
        width: el.offsetWidth,
      };
    };

    this.subway = new SubwayLayer(subwayContainer, this.words, this.edges, getHoveredWordPos);

    this.words.onHover((token) => {
      if (this.lockedToken !== null) return;

      this.hover.setHoveredWord(token);
      this.subway.setHoveredWord(token);
      this.subway.render();
    });

    this.words.onClick((token) => {
      if (this.lockedToken === null || token === null) return;

      this.hover.setHoveredWord(token);
      this.subway.setHoveredWord(token);
      this.subway.render();

      this.wordClickCallback(this.sentenceIndex, token);
    });
  }

  /* -------------------------- public API -------------------------- */

  async init(raw: any): Promise<void> {
    this.graph.load(raw.tok, raw);

    const tokens = this.graph.tokens;
    const lemmas = raw.lem.flat();
    const posTags = raw.pos.flat();

    this.wordMetadata = tokens.map((word: string, index: number) => ({
      lemma: lemmas[index] ?? word,
      pos: posTags[index] ?? "",
    }));

    this.buildProjection(raw.ner ?? []);

    this.subway.loadMetadata(this.wordMetadata);

    const projectedTokens = this.nodesBySentence.flat();

    this.words.build(
      projectedTokens.map((node) => node.text),
      projectedTokens.map((node) => node.id),
    );

    this.cacheWordEls();

    this.layout.build(tokens.length);

    this.targetYById = this.layout.computeTargetY(this.graph.connectivity());

    // Give entity nodes a vertical position based on their constituent tokens.
    for (const node of projectedTokens) {
      if (node.end - node.start <= 1) continue;

      let total = 0;

      for (let i = node.start; i < node.end; i++) {
        total += this.targetYById[i];
      }

      this.targetYById[node.id] = total / (node.end - node.start);
    }

    this.loaded = true;
  }

  get sentenceCount(): number {
    return this.graph.sentenceCount;
  }

  get currentSentence(): number {
    return this.sentenceIndex;
  }

  get lockedTokenIndex(): number | null {
    return this.lockedToken;
  }

  hoverToken(token: number | null): void {
    if (!this.loaded || this.lockedToken !== null) return;

    const node = token === null ? null : this.tokenToNode[token];

    this.hover.setHoveredWord(node);
    this.subway.setHoveredWord(node);
  }

  onClickToken(token: number): void {
    const node = this.tokenToNode[token] ?? token;

    this.lockedToken = this.lockedToken === node ? null : node;

    this.hover.setHoveredWord(node);
    this.subway.setHoveredWord(node);
  }

  render(index: number): void {
    if (!this.loaded || index < 0 || index >= this.graph.sentenceCount) {
      return;
    }

    this.sentenceIndex = index;
    this.hover.clear();

    const nodes = this.nodesBySentence[index];
    const indices = nodes.map((node) => node.id);

    this.showOnly(indices);

    const { points } = this.layout.sentenceTargetsFor(indices, (id) => this.targetYById[id]);

    points.forEach((point, i) => {
      this.layout.live[indices[i]] = point;
    });

    this.wrapSentence(nodes);
    this.placeSentence(nodes);
    this.buildEdges(index, nodes);
  }

  /* --------------------------- projection --------------------------- */

  private buildProjection(ner: NerSpan[][]): void {
    this.tokenToNode = [];
    this.nodesBySentence = [];

    for (let sentence = 0; sentence < this.graph.sentenceCount; sentence++) {
      const [globalStart, globalEnd] = this.graph.sentenceRange(sentence);

      const spans = [...(ner[sentence] ?? [])]
        .filter((span) => {
          const [, , start, end] = span;

          return (
            Number.isInteger(start) &&
            Number.isInteger(end) &&
            start >= 0 &&
            end > start &&
            end <= globalEnd - globalStart
          );
        })
        .sort((a, b) => a[2] - b[2] || b[3] - a[3]);

      const nodes: ProjectedNode[] = [];
      let cursor = 0;

      const addNode = (start: number, end: number, text: string, entityType?: string) => {
        const id = globalStart + start;

        const node: ProjectedNode = {
          id,
          start: id,
          end: globalStart + end,
          text,
          entityType,
        };

        nodes.push(node);

        for (let i = start; i < end; i++) {
          this.tokenToNode[globalStart + i] = id;
        }

        if (entityType) {
          this.wordMetadata[id] = {
            lemma: text,
            pos: entityType,
          };
        }
      };

      for (const [text, label, start, end] of spans) {
        if (start < cursor) continue;
        while (cursor < start) {
          const globalIndex = globalStart + cursor;
          const word = this.graph.tokens[globalIndex];

          addNode(cursor, cursor + 1, word);

          cursor++;
        }
        const entityText = text || this.graph.tokens.slice(globalStart + start, globalStart + end).join(" ");

        addNode(start, end, entityText, label);

        cursor = end;
      }
      while (cursor < globalEnd - globalStart) {
        const globalIndex = globalStart + cursor;
        const word = this.graph.tokens[globalIndex];
        addNode(cursor, cursor + 1, word);
        cursor++;
      }

      this.nodesBySentence.push(nodes);
    }
  }

  private getNode(id: number): ProjectedNode | undefined {
    const sentenceNodes = this.nodesBySentence[this.sentenceIndex];

    return sentenceNodes?.find((node) => node.id === id);
  }

  /* --------------------------- internals --------------------------- */

  private buildEdges(sentence: number, nodes: ProjectedNode[]): void {
    const inputs: EdgeInput[] = [];

    for (const edge of this.graph.edges(sentence)) {
      const originalHead = this.graph.globalIndex(sentence, edge.head);

      const originalChild = this.graph.globalIndex(sentence, edge.child);

      const head = this.tokenToNode[originalHead];
      const child = this.tokenToNode[originalChild];

      if (head === undefined || child === undefined) continue;

      // Discard edges internal to a collapsed entity.
      if (head === child) continue;

      inputs.push({
        edge,
        sentence,
        head,
        child,
      });
    }

    const indices = nodes.map((node) => node.id);
    const { width, height } = this.measureExtent(nodes);

    this.edges.build(inputs, [sentence], sentence, { width, height });

    this.subway.setSentenceWords(indices);
    this.subway.render();
  }

  private wrapSentence(nodes: ProjectedNode[]): void {
    const live = this.layout.live;

    for (const node of nodes) {
      const p = live[node.id];

      if (!p) continue;

      // Swap axes: original Y becomes X, original X becomes Y.
      const x = p.py;
      const y = p.px;

      p.px = x;
      p.py = y;
    }
  }

  private placeSentence(nodes: ProjectedNode[]): void {
    const live = this.layout.live;

    for (const node of nodes) {
      const p = live[node.id];

      if (!p) continue;

      this.words.place(node.id, p.px, p.py);
    }
  }

  private measureExtent(nodes: ProjectedNode[]): { width: number; height: number } {
    const live = this.layout.live;

    let maxX = 0;
    let maxY = 0;

    for (const node of nodes) {
      const p = live[node.id];
      const el = this.wordEls[node.id];

      if (!p || !el) continue;

      maxX = Math.max(maxX, p.px + el.offsetHeight);
      maxY = Math.max(maxY, p.py + el.offsetWidth);
    }

    const PAD = 60;

    return {
      width: maxX + PAD,
      height: maxY + PAD,
    };
  }

  private cacheWordEls(): void {
    this.wordEls = [];

    this.wordContainer.querySelectorAll<HTMLElement>("[data-index]").forEach((el) => {
      el.style.transition = "none";

      this.wordEls[Number(el.dataset.index)] = el;
    });
  }

  private showOnly(indices: number[]): void {
    const visible = new Set(indices);

    this.wordEls.forEach((el, i) => {
      if (el) el.style.display = visible.has(i) ? "" : "none";
    });
  }
}
