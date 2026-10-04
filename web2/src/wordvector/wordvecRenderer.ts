import { BaseDependencyRenderer, elementSize } from "./basedependency";
import { SubwayLayer } from "./depsubwaylayer";
import { DependencyGraph } from "./DependencyGraph";
import { EdgeLayer, type EdgeInput } from "./EdgeLayer";
import { HoverController } from "./HoverController";
import { Layout, originX } from "./Layout";
import { WordLayer } from "./WordLayer";
// import { FullLine } from "./fullline";

/**
 * Shows one sentence at a time: render(index).
 *
 *   DependencyGraph  data (tokens, edges)          – no DOM
 *   Layout           live positions + sentence targets
 *   WordLayer        word <div>s
 *   EdgeLayer        dependency SVG
 *   HoverController  word/edge hover -> focus sets
 */
export class WordVecRenderer extends BaseDependencyRenderer {
  private readonly wordContainer: HTMLDivElement;
  private readonly lineContainer: HTMLDivElement;
  // private readonly fullLine: FullLine;

  private readonly graph = new DependencyGraph();
  private readonly layout: Layout;
  private readonly words: WordLayer;
  private readonly edges: EdgeLayer;
  private readonly hover: HoverController;
  private readonly subway: SubwayLayer;

  private sentenceIndex = 0;
  private loaded = false;
  private lockedToken: number | null = null;

  private targetYById: number[] = [];
  private wordEls: HTMLElement[] = [];

  constructor() {
    super(".vector-plot");

    this.wordContainer = document.querySelector(".word-plot") as HTMLDivElement;
    this.lineContainer = this.container as HTMLDivElement;
    const subwayContainer = document.querySelector(".dependency-subway-container") as HTMLElement;

    this.layout = new Layout(this.wordContainer);
    this.words = new WordLayer(this.wordContainer);
    this.edges = new EdgeLayer(this.lineContainer, (i) => this.layout.live[i]);
    this.hover = new HoverController(this.words, this.edges);

    // this.fullLine = new FullLine(
    //   document.querySelector(".full-line") as HTMLDivElement,
    //   (token) => this.onHoverToken(token),
    //   (token) => this.onClickToken(token),
    // );

    const getHoveredWordX = (index: number): number => {
      //   const spanLeft = this.fullLine.spanLeft(index);
      //   if (spanLeft === null) return 0;
      //   const { left } = originX(this.wordContainer);
      return 400; //left + spanLeft;
    };

    this.subway = new SubwayLayer(subwayContainer, this.words, this.edges, getHoveredWordX);

    this.words.onHover((token) => {
      if (this.lockedToken !== null) return;
      this.hover.setHoveredWord(token);
      this.subway.setHoveredWord(token);
    });
  }

  /* -------------------------- public API -------------------------- */

  /** Loads data only. Call render(index) afterwards to show a sentence. */
  async init(raw: any): Promise<void> {
    this.graph.load(raw.tok, raw);
    this.words.build(this.graph.tokens);
    this.cacheWordEls();
    this.layout.build(this.graph.tokens.length);
    this.targetYById = this.layout.computeTargetY(this.graph.connectivity());
    this.loaded = true;
  }

  get sentenceCount(): number {
    return this.graph.sentenceCount;
  }

  /**
   * Shows sentence `index` only, with every word placed directly at its final
   * position: x flows from LEFT_PADDING, y comes from dependency connectivity.
   */
  render(index: number): void {
    if (!this.loaded || index < 0 || index >= this.graph.sentenceCount) return;

    this.sentenceIndex = index;
    this.lockedToken = null;
    // this.fullLine.setLocked(null);
    this.hover.clear();

    const [start, end] = this.graph.sentenceRange(index);
    this.showOnly(start, end); // must happen before measuring widths

    const { points } = this.layout.sentenceTargets(start, end, (id) => this.targetYById[id]);
    this.layout.setLive(start, points);

    this.placeSentence(start, end);
    // this.fullLine.render(this.graph.words, start, end, points[0] ? points[0].px + 15 : 100);
    this.buildEdges(start, end); // draws the edges from the live positions
  }

  nextSentence(): void {
    this.step(1);
  }

  prevSentence(): void {
    this.step(-1);
  }

  /* --------------------------- internals --------------------------- */

  private step(delta: number): void {
    const n = this.sentenceCount;
    if (!n) return;
    this.render((((this.sentenceIndex + delta) % n) + n) % n);
  }

  private onHoverToken(token: number | null): void {
    if (this.lockedToken !== null) return;
    this.hover.setHoveredWord(token);
    this.subway.setHoveredWord(token);
    // this.fullLine.setHot(token);
  }

  private onClickToken(token: number): void {
    const unlocking = this.lockedToken === token;
    this.lockedToken = unlocking ? null : token;
    // this.fullLine.setLocked(this.lockedToken);

    // Apply the clicked word directly. The pointer is still over it, so on
    // unlock it stays hovered until the mouse leaves.
    this.hover.setHoveredWord(token);
    this.subway.setHoveredWord(token);
    // this.fullLine.setHot(token);
  }

  private buildEdges(start: number, end: number): void {
    const live = this.layout.live;
    const sentence = this.sentenceIndex;
    const inputs: EdgeInput[] = [];

    for (const edge of this.graph.edges(sentence)) {
      const head = this.graph.globalIndex(sentence, edge.head);
      const child = this.graph.globalIndex(sentence, edge.child);
      if (!live[head] || !live[child]) continue;
      inputs.push({ edge, sentence, head, child });
    }
    this.edges.build(inputs, [sentence], sentence, elementSize(this.lineContainer, 600, 600));
    this.words.setConnected(this.edges.connectedTokens());

    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    this.subway.setSentenceWords(indices);
  }

  private placeSentence(start: number, end: number): void {
    const live = this.layout.live;
    for (let i = start; i < end; i++) this.words.place(i, live[i].px, live[i].py);
  }

  private cacheWordEls(): void {
    this.wordEls = [];
    this.wordContainer.querySelectorAll<HTMLElement>("[data-index]").forEach((el) => {
      // Words are placed instantly; a CSS transition would make them trail the edges.
      el.style.transition = "none";
      this.wordEls[Number(el.dataset.index)] = el;
    });
  }

  /** Only tokens [start, end) are visible. */
  private showOnly(start: number, end: number): void {
    this.wordEls.forEach((el, i) => {
      el.style.display = i >= start && i < end ? "" : "none";
    });
  }
}
