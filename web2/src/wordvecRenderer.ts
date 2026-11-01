import { BaseDependencyRenderer, elementSize } from "./basedependency";
import { SubwayLayer } from "./depsubwaylayer";
import { DependencyGraph } from "./depgraph";
import { EdgeLayer, type EdgeInput } from "./edgelayer";
import { HoverController } from "./hovercontroller";
import { Layout } from "./layout";
import { WordLayer } from "./wordlayer";
// import { FullLine } from "./fullline";

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
  private wordClickCallback;

  constructor(wordClickCallback: (sentence: number, token: number) => void, 
  focusCallback: (indices: ReadonlySet<number> | null) => void) {
    super(".vector-plot");
    this.wordClickCallback = wordClickCallback;
    this.wordContainer = document.querySelector(".word-plot") as HTMLDivElement;
    this.lineContainer = this.container as HTMLDivElement;
    const subwayContainer = document.querySelector(".dependency-subway-container") as HTMLElement;

    this.layout = new Layout(this.wordContainer);
    this.words = new WordLayer(this.wordContainer);
    this.edges = new EdgeLayer(this.lineContainer, (i) => this.layout.live[i]);
    this.hover = new HoverController(this.words, this.edges);
  this.words.onFocusChange(focusCallback);
    // this.fullLine = new FullLine(
    //   document.querySelector(".full-line") as HTMLDivElement,
    //   (token) => this.onHoverToken(token),
    //   (token) => this.onClickToken(token),
    // );

    const getHoveredWordX = (index: number): { left: number; top: number } => {
      const wordElLeft =
        parseFloat(this.wordEls[index].style.left.split("px")[0]) - this.wordEls[index].clientWidth / 2;
      const wordElTop = parseFloat(this.wordEls[index].style.top.split("px")[0]);
      return { left: wordElLeft, top: wordElTop + 120 };
    };

    this.subway = new SubwayLayer(subwayContainer, this.words, this.edges, getHoveredWordX);

    this.words.onHover((token) => {
      if (this.lockedToken !== null) return;
      this.hover.setHoveredWord(token);
      this.subway.setHoveredWord(token);
    });

    this.words.onClick((token) => {
      if (this.lockedToken === null || token === null) return;
      
      this.hover.setHoveredWord(token);
      this.subway.setHoveredWord(token);
      //update the sentence on the left
      this.wordClickCallback(this.sentenceIndex, token);
    });
  }

  /* -------------------------- public API -------------------------- */

  /** loads data only. Call render(index) to show a sentence */
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

  get currentSentence(): number {
    return this.sentenceIndex;
  }

  get lockedTokenIndex(): number | null {
    return this.lockedToken;
  }

  hoverToken(token: number | null): void {
    if (!this.loaded || this.lockedToken !== null) return;
    this.hover.setHoveredWord(token);
    this.subway.setHoveredWord(token);
  }

  onClickToken(token: number): void {
    this.lockedToken = this.lockedToken === token ? null : token;
    this.hover.setHoveredWord(token);
    this.subway.setHoveredWord(token);
  }

  render(index: number): void {
    if (!this.loaded || index < 0 || index >= this.graph.sentenceCount) return;
    this.sentenceIndex = index;
    // this.lockedToken = null;
    this.hover.clear();

    const [start, end] = this.graph.sentenceRange(index);
    this.showOnly(start, end); // must happen before measuring widths

    const { points } = this.layout.sentenceTargets(start, end, (id) => this.targetYById[id]);
    this.layout.setLive(start, points);

    this.placeSentence(start, end);
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

    const { width, height } = this.measureExtent(start, end);
    this.edges.build(inputs, [sentence], sentence, { width, height });

    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    this.subway.setSentenceWords(indices);
  }

  private placeSentence(start: number, end: number): void {
    const live = this.layout.live;
    for (let i = start; i < end; i++) this.words.place(i, live[i].px, live[i].py);
  }

  private measureExtent(start: number, end: number): { width: number; height: number } {
    const live = this.layout.live;
    let maxX = 0;
    let maxY = 0;

    for (let i = start; i < end; i++) {
      const p = live[i];
      const el = this.wordEls[i];
      if (!p || !el) continue;
      maxX = Math.max(maxX, p.px + el.offsetWidth);
      maxY = Math.max(maxY, p.py + el.offsetHeight);
    }

    const PAD = 60;
    // const viewport = this.lineContainer.parentElement as HTMLElement;

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

  private showOnly(start: number, end: number): void {
    this.wordEls.forEach((el, i) => {
      el.style.display = i >= start && i < end ? "" : "none";
    });
  }
}
