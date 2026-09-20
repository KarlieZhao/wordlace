import { BaseDependencyRenderer, elementSize, type Axis, type RenderMode } from "./basedependency";
import { loadJson } from "../utils";
import { MOVE_TRANSITION_MS } from "./config";
import { DependencyGraph } from "./DependencyGraph";
import { EdgeLayer, type EdgeInput } from "./EdgeLayer";
import { ForceLayout } from "./ForceLayout";
import { HoverController } from "./HoverController";
import { Layout } from "./Layout";
import { PointerTracker } from "./viewport";
import { WordLayer } from "./WordLayer";

export { MOVE_TRANSITION_MS };

/**
 * Orchestrator. Holds view state (mode, axis, current sentence) and wires the parts:
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

  private readonly graph = new DependencyGraph();
  private readonly layout: Layout;
  private readonly words: WordLayer;
  private readonly edges: EdgeLayer;
  private readonly force = new ForceLayout();
  private readonly hover: HoverController;
  private readonly tracker: PointerTracker;

  private mode: RenderMode = 0;
  private expandingAlong: Axis = "x";
  private sentenceIndex = 0;
  private showAllSentences = false;
  private loaded = false;
  private edgeRedrawTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super(".vector-plot");

    this.wordContainer = document.querySelector(".word-plot") as HTMLDivElement;
    this.lineContainer = this.container as HTMLDivElement;
    this.fullLineContainer = document.querySelector(".full-line") as HTMLDivElement;

    this.layout = new Layout(this.wordContainer, this.lineContainer);
    this.words = new WordLayer(this.wordContainer);
    this.edges = new EdgeLayer(this.lineContainer, (i) => this.layout.live?.[i]);
    this.hover = new HoverController(this.words, this.edges);

    // The mouse's Y position picks the highlighted sentence.
    this.tracker = new PointerTracker(this.wordContainer, (y) => this.onPointerY(y));
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
    this.loaded = true;

    this.render(false);
  }

  get sentenceCount(): number {
    return this.graph.sentenceCount;
  }

  showAllEdges(showAll: boolean): void {
    if (!this.sentenceCount) return;
    this.showAllSentences = showAll;
    this.render(false);
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

    // Only a real layout change resets words to their sequence positions.
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

    if (this.showAllSentences) {
      // Every sentence is already drawn; only the caption depends on the current one.
      this.fullLineContainer.textContent = this.graph.sentenceText(index);
    } else {
      this.render(false);
    }
  }

  /**
   * Picks the sentence whose vertical extent contains the pointer. Where several
   * do (e.g. the x-axis layout, where sentences overlap vertically), the one whose
   * vertical center is closest wins; if none contain it, the nearest one wins.
   */
  private onPointerY(clientY: number): void {
    if (!this.loaded || this.mode !== 1 || !this.graph.sentenceCount) return;

    const y = clientY - this.words.origin(0).top;
    let best = -1;
    let bestGap = Infinity;
    let bestCenter = Infinity;

    for (let s = 0; s < this.graph.sentenceCount; s++) {
      const range = this.sentenceYRange(s);
      if (!range) continue;

      const gap = y < range.min ? range.min - y : y > range.max ? y - range.max : 0;
      const center = Math.abs(y - (range.min + range.max) / 2);

      if (gap < bestGap || (gap === bestGap && center < bestCenter)) {
        best = s;
        bestGap = gap;
        bestCenter = center;
      }
    }

    if (best >= 0) this.setSentence(best);
  }

  /** Vertical extent of a sentence, in the words' own coordinate space. */
  private sentenceYRange(sentence: number): { min: number; max: number } | null {
    const [start, end] = this.graph.sentenceRange(sentence);
    let min = Infinity;
    let max = -Infinity;

    for (let i = start; i < end; i++) {
      const p = this.layout.point(this.mode, i, this.graph.words[i]);
      if (!p) continue;
      if (p.py < min) min = p.py;
      if (p.py > max) max = p.py;
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

    /*
     * Cloud mode:    words sit at vector positions, no simulation.
     * Expanded mode: words sit at their persistent live positions; dependency links
     *                pull connected words together, collision prevents overlap,
     *                and weak anchors keep everything local.
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

    this.fullLineContainer.textContent = this.graph.sentenceText(this.sentenceIndex);
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
    return this.showAllSentences ? Array.from({ length: this.graph.sentenceCount }, (_, i) => i) : [this.sentenceIndex];
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
  }

  private startSimulation(): void {
    const points = this.layout.live;
    if (!points) return;

    const started = this.force.start({
      graph: this.graph,
      sentences: this.activeSentences(),
      points,
      onTick: (nodes) => {
        for (const n of nodes) this.words.place(n.id, n.point.px, n.point.py);
        this.edges.redraw();
      },
    });

    if (started) this.words.setTransitions(true);
  }
}