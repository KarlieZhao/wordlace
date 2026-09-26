import { BaseDependencyRenderer, elementSize, type Axis, type RenderMode } from "./basedependency";
import { SubwayLayer } from "./depsubwaylayer";
import { loadJson } from "../utils";
import { MOVE_TRANSITION_MS } from "./config";
import { DependencyGraph } from "./DependencyGraph";
import { EdgeLayer, type EdgeInput } from "./EdgeLayer";
import { ForceLayout } from "./ForceLayout";
import { HoverController } from "./HoverController";
import { Layout, originX } from "./Layout";
import { PointerTracker } from "./viewport";
import { WordLayer } from "./WordLayer";

export { MOVE_TRANSITION_MS };

/**
 * Holds view state (mode, axis, current sentence) and wires the parts:
 *
 *   DependencyGraph  data (tokens, edges)          – no DOM
 *   Layout           cloud / sequence / live pos   – no rendering
 *   WordLayer        word <div>s
 *   EdgeLayer        dependency SVG + labels
 *   ForceLayout      d3 simulation
 *   HoverController  word/edge hover -> focus sets
 */
export class WordVecRenderer extends BaseDependencyRenderer {
  protected readonly svgClass = "vector-edges";

  private readonly wordContainer: HTMLDivElement;
  private readonly lineContainer: HTMLDivElement;
  private readonly fullLineContainer: HTMLDivElement;
  private fullLineHotIndex: number | null = null;

  private readonly graph = new DependencyGraph();
  private readonly layout: Layout;
  private readonly words: WordLayer;
  private readonly edges: EdgeLayer;
  private readonly force = new ForceLayout();
  private readonly hover: HoverController;
  private readonly subway: SubwayLayer;
  private readonly tracker: PointerTracker;

  private mode: RenderMode = 0;
  private expandingAlong: Axis = "x";
  private sentenceIndex = 0;
  private loaded = false;
  private edgeRedrawTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Per-token target row Y, computed once the graph/scores are loaded. */
  private targetYById: number[] = [];

  constructor() {
    super(".vector-plot");

    this.wordContainer = document.querySelector(".word-plot") as HTMLDivElement;
    this.lineContainer = this.container as HTMLDivElement;
    this.fullLineContainer = document.querySelector(".full-line") as HTMLDivElement;
    const subwayContainer = document.querySelector(".dependency-subway-container") as HTMLElement;
    this.layout = new Layout(this.wordContainer, this.lineContainer);
    this.words = new WordLayer(this.wordContainer);
    this.edges = new EdgeLayer(this.lineContainer, (i) => this.layout.live?.[i]);
    this.hover = new HoverController(this.words, this.edges);

    const getHoveredWordX = (index: number): number => {
      const span = this.fullLineContainer.querySelector<HTMLElement>(`[data-index="${index}"]`);
      if (!span) return 0;
      const spanRect = span.getBoundingClientRect();
      const { left } = originX(this.wordContainer);
      return left + spanRect.left;
    };

    this.subway = new SubwayLayer(subwayContainer, this.words, this.edges, getHoveredWordX);

    this.fullLineContainer.addEventListener("mouseover", (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(".full-line-word");
      if (el) this.onHoverToken(Number(el.dataset.index));
    });

    this.fullLineContainer.addEventListener("mouseout", (e) => {
      const to = (e.relatedTarget as Element | null)?.closest?.(".full-line-word");
      if (to) return;
      this.onHoverToken(null);
    });

    this.words.onHover((token) => {
      this.hover.setHoveredWord(token);
      this.subway.setHoveredWord(token);
    });
    this.tracker = new PointerTracker(this.wordContainer, (x, y) => this.onPointer(x, y));
    this.tracker.start();
  }

  dispose(): void {
    this.tracker.stop();
    this.force.stop();
    this.cancelEdgeRedraw();
  }

  /* -------------------------- public API -------------------------- */

  async init(tokenURL: string, vecURL: string): Promise<void> {
    const [vectors, raw] = await Promise.all([loadJson(tokenURL), loadJson(vecURL)]);

    this.graph.load(raw.tok, raw);
    this.words.build(this.graph.tokens);
    this.layout.build(vectors, this.graph.tokens);
    const scores = this.graph.connectivity();
    this.targetYById = this.layout.computeTargetY(scores);
    this.loaded = true;
    this.render(false);
  }

  get sentenceCount(): number {
    return this.graph.sentenceCount;
  }

  nextSentence(): void {
    this.stepSentence(1);
  }

  prevSentence(): void {
    this.stepSentence(-1);
  }

  setExpandMode(expanded: boolean, axis: Axis): void {
    const wasExpanded = this.mode === 1;
    const layoutChanged = wasExpanded !== expanded || axis !== this.expandingAlong;

    this.mode = expanded ? 1 : 0;
    this.expandingAlong = axis;
    if (expanded && layoutChanged) this.layout.resetLive(axis);

    this.render(layoutChanged);
  }

  /* --------------------------- navigation --------------------------- */

  private stepSentence(delta: number): void {
    const n = this.sentenceCount;
    if (!n) return;
    this.setSentence((((this.sentenceIndex + delta) % n) + n) % n);
  }

  private setSentence(index: number): void {
    if (index === this.sentenceIndex) return;
    this.sentenceIndex = index;

    // if (this.showAllSentences) {
    // Every sentence is already drawn; only the caption depends on the current one.
    // this.fullLineContainer.textContent = this.graph.sentenceText(index);
    // } else {
    this.render(false);
    // }
  }

  /**
   * Picks the sentence whose extent along the expansion axis contains the pointer:
   * mouse X when expanding along x, mouse Y when expanding along y. Sentences are laid
   * out in order along that axis, so normally exactly one matches. If several do (or
   * none), the one whose center is closest (or that is nearest) wins.
   */
  private onPointer(clientX: number, clientY: number): void {
    if (!this.loaded || this.mode !== 1 || !this.graph.sentenceCount) return;

    const axis = this.expandingAlong;
    const origin = originX(document.querySelector(".word-plot"));
    const pos = axis === "x" ? clientX + origin.left : clientY - origin.top;

    let best = -1;
    let bestGap = Infinity;
    let bestCenter = Infinity;

    for (let s = 0; s < this.graph.sentenceCount; s++) {
      const range = this.sentenceExtent(s, axis);
      if (!range) continue;

      const gap = pos < range.min ? range.min - pos : pos > range.max ? pos - range.max : 0;
      const center = Math.abs(pos - (range.min + range.max) / 2);

      if (gap < bestGap || (gap === bestGap && center < bestCenter)) {
        best = s;
        bestGap = gap;
        bestCenter = center;
      }
    }

    if (best >= 0) this.setSentence(best);
  }

  /** Extent of a sentence along one axis, in the words' own coordinate space. */
  private sentenceExtent(sentence: number, axis: Axis): { min: number; max: number } | null {
    const [start, end] = this.graph.sentenceRange(sentence);
    let min = Infinity;
    let max = -Infinity;

    for (let i = start; i < end; i++) {
      const p = this.layout.point(this.mode, i, this.graph.words[i]);
      if (!p) continue;
      const v = axis === "x" ? p.px : p.py;
      if (v < min) min = v;
      if (v > max) max = v;
    }

    return min === Infinity ? null : { min, max };
  }

  /* ---------------------------- rendering --------------------------- */

  private render(animateMove: boolean): void {
    if (!this.loaded || !this.layout.ready) return;

    this.force.stop();
    this.cancelEdgeRedraw();
    this.hover.clear();

    // Re-enable left/top transitions for the (possibly animated) move.
    this.words.setTransitions(false);
    this.placeWords();
    this.renderFullLine(this.sentenceIndex);

    /*
     * Cloud mode:    words sit at vector positions, no simulation.
     * Expanded mode: words sit at their persistent live positions; dependency links
     *                pull connected words together, collision prevents overlap,
     *                weak anchors keep everything local, and a ramped y-pull slowly
     *                eases words toward their score-based row.
     */
    if (this.mode === 1) {
      const start = () => {
        this.buildEdges();
        this.startSimulation();
      };

      if (animateMove) {
        this.edges.clear();
        this.edgeRedrawTimeout = setTimeout(() => {
          this.edgeRedrawTimeout = null;
          start();
        }, MOVE_TRANSITION_MS);
      } else {
        start();
      }
    } else {
      this.buildEdges();
    }
  }

  private renderFullLine(sentence: number): void {
    const [start, end] = this.graph.sentenceRange(sentence);
    this.fullLineHotIndex = null; // rebuilding clears hot spans
    this.fullLineContainer.innerHTML = "";

    for (let i = start; i < end; i++) {
      const span = document.createElement("div");
      span.dataset.index = String(i);
      span.textContent = this.graph.words[i] + " ";
      span.classList.add("full-line-word");
      this.fullLineContainer.appendChild(span);
    }

    this.fullLineContainer.style.left = `${this.firstWordLeft(this.sentenceIndex)}px`;
  }

  private onHoverToken(token: number | null): void {
    this.hover.setHoveredWord(token);
    this.subway.setHoveredWord(token);
    this.setFullLineHot(token);
  }

  private setFullLineHot(token: number | null): void {
    if (this.fullLineHotIndex !== null) {
      this.fullLineContainer.querySelector(`[data-index="${this.fullLineHotIndex}"]`)?.classList.remove("wv-hot");
    }
    this.fullLineHotIndex = token;
    if (token !== null) {
      this.fullLineContainer.querySelector(`[data-index="${token}"]`)?.classList.add("wv-hot");
    }
  }

  private firstWordLeft(sentence: number): number {
    const [start] = this.graph.sentenceRange(sentence);
    const el = this.wordContainer.querySelector(`[data-index="${start}"]`);
    if (!el) return 100;
    const computedLeft = parseFloat(window.getComputedStyle(el).left.replace("px", ""));
    return computedLeft + 15;
  }

  private cancelEdgeRedraw(): void {
    if (this.edgeRedrawTimeout === null) return;
    clearTimeout(this.edgeRedrawTimeout);
    this.edgeRedrawTimeout = null;
  }

  private placeWords(): void {
    const { graph, layout, mode } = this;
    for (let i = 0; i < graph.tokens.length; i++) {
      const p = layout.point(mode, i, graph.words[i]);
      if (p) this.words.place(i, p.px, p.py);
    }
  }

  private activeSentences(): number[] {
    return [this.sentenceIndex];
  }

  private buildEdges(): void {
    const live = this.layout.live;
    if (!live) return;

    const sentences = this.activeSentences();
    const inputs: EdgeInput[] = [];

    for (const sentence of sentences) {
      for (const edge of this.graph.edges(sentence)) {
        const head = this.graph.globalIndex(sentence, edge.head);
        const child = this.graph.globalIndex(sentence, edge.child);
        if (!live[head] || !live[child]) continue;
        inputs.push({ edge, sentence, head, child });
      }
    }

    this.edges.build(inputs, sentences, this.sentenceIndex, elementSize(this.lineContainer, 800, 600));
    this.words.setConnected(this.edges.connectedTokens());
    // this.updateSubway();

    const [start, end] = this.graph.sentenceRange(this.sentenceIndex);
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    this.subway.setSentenceWords(indices);
  }

  // private updateSubway(): void {
  //   const rootLocal = this.findSentenceRoot(this.sentenceIndex);
  //   if (rootLocal === null) {
  //     this.subway.hide();
  //     return;
  //   }

  //   const rootGlobal = this.graph.globalIndex(this.sentenceIndex, rootLocal);
  //   this.subway.show(SubwayLayer.buildOutgoingLinks(rootGlobal, this.words, this.edges));
  // }

  private findSentenceRoot(sentence: number): number | null {
    const edges = this.graph.edges(sentence);
    if (!edges.length) return null;

    const children = new Set<number>();
    const outDegree = new Map<number, number>();
    for (const e of edges) {
      children.add(e.child);
      outDegree.set(e.head, (outDegree.get(e.head) ?? 0) + 1);
    }

    let best: number | null = null;
    let bestDegree = -1;
    for (const [head, degree] of outDegree) {
      if (children.has(head)) continue;
      if (degree > bestDegree) {
        best = head;
        bestDegree = degree;
      }
    }

    return best;
  }

  private startSimulation(): void {
    const points = this.layout.live;
    if (!points) return;

    const started = this.force.start({
      graph: this.graph,
      sentences: this.activeSentences(),
      points,
      targetY: (id) => this.targetYById[id],
      seqYRampMs: 1500,
      onTick: (nodes) => {
        for (const n of nodes) this.words.place(n.id, n.point.px, n.point.py);
        this.edges.redraw();
      },
    });

    if (started) this.words.setTransitions(true);
  }
}
