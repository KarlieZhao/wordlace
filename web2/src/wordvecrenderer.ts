import { computeCurve, type CurveGeometry, type WordMetadata } from "./basedependency";
import { SubwayLayer } from "./depsubwaylayer";
import { DependencyGraph } from "./depgraph";
import { EdgeLayer, type EdgeInput } from "./edgelayer";
import { HoverController } from "./hovercontroll";
import { Layout } from "./layout";
import { WordLayer } from "./wordlayer";
import { escapeXml, POS_COLOR_MAP } from "./utils";

interface Span {
  start: number;
  end: number;
  text: string;
  label: string;
  source: "ner" | "srl";
}

interface ProjectedNode {
  id: number;
  start: number;
  end: number;
  text: string;
  labels: string[];
}
export interface FocusInfo {
  key: ReadonlySet<number>;
  connected: ReadonlySet<number>;
}

export class WordVecRenderer {
  private container: HTMLDivElement;
  private readonly wordContainer: HTMLDivElement;
  private readonly vectorContainer: HTMLDivElement | null;

  private readonly graph = new DependencyGraph();
  private readonly layout: Layout;
  private readonly words: WordLayer;
  private readonly edges: EdgeLayer;
  private readonly hover: HoverController;
  private readonly subway: SubwayLayer;

  private wordMetadata: WordMetadata[] = [];
  private displayMetadata: WordMetadata[] = [];

  private nerSpans: unknown[][] = [];
  private srlSpans: unknown[][] = [];
  private useSrl = true;

  private sentenceIndex = 0;
  private loaded = false;
  private lockedToken: number | null = null;

  private targetYById: number[] = [];
  private wordEls: HTMLElement[] = [];

  // original token id -> projected node id
  private tokenToNode: number[] = [];

  //  project nodes grouped by sentence
  private nodesBySentence: ProjectedNode[][] = [];

  private roleByToken: (string | null)[] = [];
  private colorByRole = false;
  private focusNode: number | null = null;
  private centerOnFocus = true;

  constructor(focusCallback: (focus: FocusInfo | null) => void) {
    this.container = document.querySelector(".right-section") as HTMLDivElement;
    this.vectorContainer = document.querySelector(".vector-plot") as HTMLDivElement;
    this.wordContainer = document.querySelector(".word-plot") as HTMLDivElement;
    const subwayContainer = document.querySelector(".dependency-subway-container") as HTMLElement;
    const centerContainer = document.querySelector(".dep-graph-container") as HTMLDivElement;

    centerContainer.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target === e.currentTarget) {
        this.removeLockToken();
      }
    });

    this.layout = new Layout(this.wordContainer);
    this.words = new WordLayer(this.wordContainer);
    this.edges = new EdgeLayer(this.vectorContainer, (i) => this.layout.live[i]);
    this.hover = new HoverController(this.words, this.edges);

    this.words.onFocusChange((indices) => {
      if (indices === null) {
        focusCallback(null);
        return;
      }

      const key = new Set<number>();
      const connected = new Set<number>();
      for (const id of indices) {
        const node = this.getNode(id);
        if (!node) continue;

        const target = id === this.focusNode ? key : connected;
        for (let i = node.start; i < node.end; i++) target.add(i);
      }

      if (this.centerOnFocus) this.centerOnNode(this.focusNode);

      focusCallback({ key, connected });
    });

    this.subway = new SubwayLayer(subwayContainer, this.words, this.edges);

    this.words.onHover((token) => {
      if (this.lockedToken !== null) return;

      this.centerOnFocus = false;
      try {
        this.setFocusNode(token);
      } finally {
        this.centerOnFocus = true;
      }
      this.subway.render();
    });

    this.words.onClick((token) => this.onClickToken(token));
  }

  /* -------------------------- public API -------------------------- */

  async init(raw: any): Promise<void> {
    this.graph.load(raw.tok, raw);

    const tokens = this.graph.tokens;
    const lemmas = raw.lem?.flat?.() ?? [];
    const posTags = raw.pos?.flat?.() ?? [];

    this.wordMetadata = tokens.map((word: string, index: number) => ({
      lemma: lemmas[index] ?? word,
      pos: posTags[index] ?? "",
    }));

    this.nerSpans = raw.ner ?? [];
    this.srlSpans = raw.srl ?? [];

    this.rebuildProjection();
    this.buildRoleMap();
    this.applyRoles();
    this.loaded = true;
    this.render(0);
    this.setColorByRole(false);
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

  get tokenRoles(): readonly (string | null)[] {
    // word
    if (!this.useSrl) return this.roleByToken;

    // slr
    const roles: (string | null)[] = new Array(this.graph.tokens.length).fill(null);
    for (const node of this.nodesBySentence.flat()) {
      const role = this.nodeRole(node);
      if (!role) continue;
      for (let i = node.start; i < node.end; i++) roles[i] = role;
    }
    return roles;
  }

  removeLockToken() {
    this.lockedToken = null;
    this.setFocusNode(null);
  }

  isLockedToken(token: number): boolean {
    return this.lockedToken !== null && this.tokenToNode[token] === this.lockedToken;
  }

  setUseSrl(enabled: boolean): Promise<void> {
    if (this.useSrl === enabled || !this.loaded) return Promise.resolve();

    this.useSrl = enabled;

    this.lockedToken = null;
    this.hover.clear();
    this.subway.setHoveredWord(null);

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        this.rebuildProjection();
        this.render(this.sentenceIndex);
        resolve();
      });
    });
  }

  hoverToken(token: number | null): void {
    if (!this.loaded || this.lockedToken !== null) return;

    this.setFocusNode(token === null ? null : this.tokenToNode[token]);
  }

  onClickToken(token: number): void {
    const node = this.tokenToNode[token] ?? token;

    this.lockedToken = this.lockedToken === node ? null : node;

    if (this.lockedToken !== null) this.setFocusNode(node);
    else this.removeLockToken();
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

    const { points } = this.layout.sentenceTargetsFor(
      indices,
      (id) => this.targetYById[id],
      this.useSrl,
      this.measureWord,
    );

    points.forEach((point, i) => {
      this.layout.live[indices[i]] = point;
    });

    this.wrapSentence(nodes);
    this.placeSentence(nodes);
    this.buildEdges(index, nodes);
  }

  /* --------------------------- private --------------------------- */

  private centerOnNode(node: number | null): void {
    if (node === null) return;

    const el = this.wordEls[node];
    if (!el || !this.container) return;

    const elBbox = el.getBoundingClientRect();
    const containerBbox = this.container.getBoundingClientRect();

    const relativeTop = elBbox.top - containerBbox.top + this.container.scrollTop;
    const targetTop = relativeTop - this.container.clientHeight / 2 + elBbox.height / 2;

    this.container.scrollTo({ top: targetTop, behavior: "smooth" });
  }
  private nodeRole(node: ProjectedNode): string | null {
    for (let i = node.start; i < node.end; i++) {
      const role = this.roleByToken[i];
      if (role) return role;
    }
    return null;
  }
  private setFocusNode(node: number | null): void {
    this.focusNode = node;
    this.hover.setHoveredWord(node);
    this.subway.setHoveredWord(node);
  }
  protected static computeCurve(...args: Parameters<typeof computeCurve>): CurveGeometry {
    return computeCurve(...args);
  }

  protected static posColor(posTag: string | undefined): string {
    return posTag && posTag in POS_COLOR_MAP ? POS_COLOR_MAP[posTag] : "#666";
  }

  protected static escape(value: string): string {
    return escapeXml(value);
  }

  private buildRoleMap(): void {
    this.roleByToken = new Array(this.graph.tokens.length).fill(null);

    for (let s = 0; s < this.graph.sentenceCount; s++) {
      const [globalStart] = this.graph.sentenceRange(s);

      for (const span of this.readSpans(this.srlSpans[s], "srl")) {
        if (!span.label) continue;

        for (let i = span.start; i < span.end; i++) {
          const g = globalStart + i;
          if (this.roleByToken[g] === null) this.roleByToken[g] = span.label;
        }
      }
    }
  }

  private applyRoles(): void {
    const roles = new Map<number, string>();
    for (const node of this.nodesBySentence.flat()) {
      const role = this.nodeRole(node);
      if (role) roles.set(node.id, role);
    }

    this.words.setRoles(roles);
    this.words.setRoleColoring(this.colorByRole);
  }

  setColorByRole(enabled: boolean): void {
    this.colorByRole = enabled;
    this.words.setRoleColoring(enabled);

    this.wordContainer?.classList.toggle("single-color", !enabled);
  }

  private rebuildProjection(): void {
    this.buildProjection(this.nerSpans, this.srlSpans, this.useSrl);

    const projectedNodes = this.nodesBySentence.flat();

    this.words.build(
      projectedNodes.map((node) => node.text),
      projectedNodes.map((node) => node.id),
    );

    this.cacheWordEls();
    this.applyRoles();
    this.layout.build(this.graph.tokens.length);
    this.targetYById = this.layout.computeTargetY(this.graph.connectivity());
    this.displayMetadata = this.wordMetadata.map((item) => ({ ...item }));

    if (this.useSrl) {
      for (const node of projectedNodes) {
        if (node.end - node.start <= 1) continue;
        let total = 0;
        for (let i = node.start; i < node.end; i++) {
          total += this.targetYById[i];
        }
        this.targetYById[node.id] = total / (node.end - node.start);

        this.displayMetadata[node.id] = {
          lemma: node.text,
          pos: node.labels.join(" / "),
        };
      }
    } else {
      for (const node of projectedNodes) {
        if (node.end - node.start <= 1) continue;
        this.displayMetadata[node.id] = {
          lemma: node.text,
          pos: node.labels.join(" / "),
        };
      }
    }

    this.subway.loadMetadata(this.displayMetadata);
  }

  private buildProjection(ner: unknown[][], srl: unknown[][], includeSrl: boolean): void {
    this.tokenToNode = [];
    this.nodesBySentence = [];

    for (let sentence = 0; sentence < this.graph.sentenceCount; sentence++) {
      const [globalStart, globalEnd] = this.graph.sentenceRange(sentence);
      const sentenceLength = globalEnd - globalStart;

      const spans = [
        ...this.readSpans(ner[sentence], "ner"),
        ...(includeSrl ? this.readSpans(srl[sentence], "srl") : []),
      ]
        .filter((span) => span.start >= 0 && span.end > span.start && span.end <= sentenceLength)
        .sort((a, b) => a.start - b.start || b.end - a.end);

      // Merge overlapping spans so each original token belongs
      // to exactly one projected node.
      const mergedSpans: Span[][] = [];

      for (const span of spans) {
        const previous = mergedSpans[mergedSpans.length - 1];

        if (previous && span.start < Math.max(...previous.map((item) => item.end))) {
          previous.push(span);
        } else {
          mergedSpans.push([span]);
        }
      }

      const nodes: ProjectedNode[] = [];
      let cursor = 0;

      const addNode = (start: number, end: number, text: string, labels: string[] = []) => {
        const id = globalStart + start;

        nodes.push({
          id,
          start: id,
          end: globalStart + end,
          text,
          labels,
        });

        for (let i = start; i < end; i++) {
          this.tokenToNode[globalStart + i] = id;
        }
      };

      for (const group of mergedSpans) {
        const start = Math.min(...group.map((span) => span.start));
        const end = Math.max(...group.map((span) => span.end));

        if (start < cursor) continue;

        while (cursor < start) {
          const globalIndex = globalStart + cursor;
          addNode(cursor, cursor + 1, this.graph.tokens[globalIndex]);
          cursor++;
        }

        const labels = [...new Set(group.map((span) => span.label).filter(Boolean))];

        // Preserve HanLP's NER surface text when the node is
        // exactly one NER span. For merged spans, use the full
        // original token sequence.
        const exactNerSpan = group.find((span) => span.source === "ner" && span.start === start && span.end === end);

        const text = exactNerSpan?.text || this.graph.tokens.slice(globalStart + start, globalStart + end).join(" ");

        addNode(start, end, text, labels);
        cursor = end;
      }

      while (cursor < sentenceLength) {
        const globalIndex = globalStart + cursor;
        addNode(cursor, cursor + 1, this.graph.tokens[globalIndex]);
        cursor++;
      }

      this.nodesBySentence.push(nodes);
    }
  }

  private readSpans(input: unknown, source: "ner" | "srl"): Span[] {
    const result: Span[] = [];

    const visit = (value: unknown): void => {
      if (!Array.isArray(value)) return;

      if (value.length >= 4 && typeof value[2] === "number" && typeof value[3] === "number") {
        result.push({
          text: String(value[0] ?? ""),
          label: String(value[1] ?? ""),
          start: value[2],
          end: value[3],
          source,
        });
        return;
      }

      for (const child of value) {
        visit(child);
      }
    };

    visit(input);
    return result;
  }

  private getNode(id: number): ProjectedNode | undefined {
    return this.nodesBySentence[this.sentenceIndex]?.find((node) => node.id === id);
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

      // Remove edges internal to the same collapsed phrase.
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

  private measureWord = (id: number, maxWidth: number): { width: number; height: number } => {
    const el = this.wordEls[id];
    if (!el) return { width: 0, height: 0 };

    el.style.width = "max-content";
    el.style.maxWidth = `${maxWidth}px`;
    el.style.whiteSpace = "normal";
    el.style.overflowWrap = "anywhere";
    el.style.textAlign = "center";
    return { width: el.offsetWidth, height: el.offsetHeight };
  };

  private measureExtent(nodes: ProjectedNode[]): {
    width: number;
    height: number;
  } {
    const live = this.layout.live;

    let maxX = 0;
    let maxY = 0;

    for (const node of nodes) {
      const p = live[node.id];
      const el = this.wordEls[node.id];

      if (!p || !el) continue;

      maxX = Math.max(maxX, p.px + el.offsetWidth / 2);
      maxY = Math.max(maxY, p.py + el.offsetHeight);
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
      // el.style.transition = "none";
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
