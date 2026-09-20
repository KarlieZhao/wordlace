import {
  forceCollide,
  forceLink,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";

import { loadJson } from "../utils";
import { BaseDependencyRenderer } from "./basedependency";

type Vectors = Record<string, [number, number]>;
type Point = { px: number; py: number };
type WordPos = Point[];
type VectorPos = Record<string, Point>;
type Sentences = string[][];
type TokenEntry = {
  word: string;
  el: HTMLElement;
};

type RenderMode = 0 | 1;
type DepRelation = [number, string];
type DepSentence = DepRelation[][];
type DepRepresentation = "dm" | "pas" | "psd";

interface DepEdge {
  id: string;
  child: number;
  head: number;
  relation: string;
  representation: DepRepresentation;
  start: number;
  end: number;
}

interface ForceNode extends SimulationNodeDatum {
  id: string;
  sentence: number;
  word: number;
  wordText: string;
  targetX: number;
  targetY: number;
  entry: TokenEntry;
}

interface ForceLink {
  id: string;
  source: string | ForceNode;
  target: string | ForceNode;
  distance: number;
}

const TOKEN_SPACING = 40;
const PADDING = 40;
const MARKER_SIZE = 4;
const CURVATURE = 10;

const DEFAULT_X_POS = 500;
const DEFAULT_Y_POS = 500;

export const MOVE_TRANSITION_MS = 10 * 60 * 5.5;

const DEP_COLORS: Record<DepRepresentation, string> = {
  dm: "#828f99",
  pas: "#9ca9aa",
  psd: "#bdd8c8",
};

export class WordVecRenderer extends BaseDependencyRenderer {
  protected readonly svgClass = "vector-edges";

  private wordContainer: HTMLDivElement;
  private lineContainer: HTMLDivElement;
  private fullLineContainer: HTMLDivElement;

  private vectors: Vectors | null = null;
  private tok: Sentences | null = null;

  private deps: {
    dm: DepSentence[];
    pas: DepSentence[];
    psd: DepSentence[];
  } | null = null;

  private tokenEntries: TokenEntry[] | null = null;

  private wordCloudPositions: VectorPos | null = null;
  private seqPositionsX: WordPos | null = null;
  private seqPositionsY: WordPos | null = null;

  private mode: RenderMode = 0;
  private expandingAlong: "x" | "y" = "x";
  private sentenceIndex = 0;
  private showAllSentences = false;

  private edgeRedrawTimeout: ReturnType<typeof setTimeout> | null = null;

  private simulation: Simulation<ForceNode, ForceLink> | null = null;

  constructor() {
    super(".vector-plot");

    this.wordContainer = document.querySelector(".word-plot") as HTMLDivElement;

    this.lineContainer = this.container as HTMLDivElement;

    this.fullLineContainer = document.querySelector(".full-line") as HTMLDivElement;
  }

  async init(tokenURL: string, vecURL: string): Promise<void> {
    await this.loadData(tokenURL, vecURL);

    this.setPositions();
    this.render(false);
  }

  get sentenceCount(): number {
    return this.tok?.length ?? 0;
  }

  showAllEdges(showAll: boolean): void {
    if (!this.tok?.length) return;

    this.showAllSentences = showAll;
    this.render(false);
  }

  nextSentence(): void {
    if (!this.tok?.length) return;

    this.sentenceIndex = (this.sentenceIndex + 1) % this.tok.length;

    this.render(false);
  }

  prevSentence(): void {
    if (!this.tok?.length) return;

    const n = this.tok.length;

    this.sentenceIndex = (((this.sentenceIndex - 1) % n) + n) % n;

    this.render(false);
  }

  setExpandMode(expanded: boolean, axis: "x" | "y"): void {
    this.mode = expanded ? 1 : 0;
    this.expandingAlong = axis;

    this.render(true);
  }

  private async loadData(tokenUrl: string, vecUrl: string): Promise<void> {
    this.vectors = await loadJson(tokenUrl);

    const raw = await loadJson(vecUrl);

    this.tok = raw.tok;

    this.deps = {
      dm: raw["sdp/dm"] ?? [],
      pas: raw["sdp/pas"] ?? [],
      psd: raw["sdp/psd"] ?? [],
    };
  }

  private setPositions(): void {
    if (!this.vectors || !this.tok) return;

    this.wordCloudPositions = this.computeWordCloudPositions(this.vectors, this.wordContainer);

    this.seqPositionsX = this.computeSeqPositions("x", this.vectors, this.tok, this.wordContainer);

    this.seqPositionsY = this.computeSeqPositions("y", this.vectors, this.tok, this.wordContainer);
  }

  private render(animateMove: boolean): void {
    if (!this.vectors || !this.tok) return;

    if (!this.seqPositionsX || !this.seqPositionsY || !this.wordCloudPositions) {
      return;
    }

    this.stopSimulation();

    if (this.edgeRedrawTimeout) {
      clearTimeout(this.edgeRedrawTimeout);
      this.edgeRedrawTimeout = null;
    }

    const entries = this.ensureTokenElements(this.tok, this.wordContainer);

    const seqPositions = this.expandingAlong === "y" ? this.seqPositionsY : this.seqPositionsX;

    this.applyPositions(entries, this.mode, this.wordCloudPositions, seqPositions);

    /*
     * Cloud mode:
     *
     *   - words stay at vector positions
     *   - no force simulation
     *
     * Expanded mode:
     *
     *   - words begin at sequence positions
     *   - dependency links pull connected words together
     *   - x/y forces keep words near their sequence positions
     *   - collision prevents overlap
     */
    if (this.mode === 1) {
      if (animateMove) {
        this.lineContainer.innerHTML = "";

        this.edgeRedrawTimeout = setTimeout(() => {
          this.edgeRedrawTimeout = null;

          this.createDependencyEdges();
          this.startForceSimulation(entries, seqPositions);
        }, MOVE_TRANSITION_MS);
      } else {
        this.createDependencyEdges();
        this.startForceSimulation(entries, seqPositions);
      }
    } else {
      this.createDependencyEdges();
    }

    this.fullLineContainer.innerHTML = this.tok[this.sentenceIndex].join(" ");
  }

  private buildWordEl(rawWord: string): HTMLElement {
    const el = document.createElement("div");
    el.textContent = rawWord;
    el.dataset.word = rawWord.toLocaleLowerCase();
    el.classList.add("vector-word");
    return el;
  }

  private ensureTokenElements(tokens: Sentences, container: HTMLElement): TokenEntry[] {
    if (this.tokenEntries) {
      return this.tokenEntries;
    }

    container.innerHTML = "";

    const fragment = document.createDocumentFragment();

    const flattened = tokens.flat();

    this.tokenEntries = flattened.map((rawWord) => {
      const el = this.buildWordEl(rawWord);

      fragment.appendChild(el);

      return {
        word: rawWord.toLocaleLowerCase(),
        el,
      };
    });

    container.appendChild(fragment);

    return this.tokenEntries;
  }

  private computeWordCloudPositions(vectors: Vectors, container: HTMLElement): VectorPos {
    const words = Object.keys(vectors);

    const positions: VectorPos = {};

    if (words.length === 0) {
      return positions;
    }

    const xs = words.map((w) => vectors[w][0]);
    const ys = words.map((w) => vectors[w][1]);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);

    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    const rect = container.getBoundingClientRect();

    const width = rect.width || container.clientWidth || 800;

    const height = rect.height || container.clientHeight || 600;

    for (const word of words) {
      const [x, y] = vectors[word];

      positions[word] = {
        px: PADDING + ((x - minX) / spanX) * (width - PADDING * 2),

        py: PADDING + (1 - (y - minY) / spanY) * (height - PADDING * 2),
      };
    }

    return positions;
  }

  private computeSeqPositions(
    alongAxis: "x" | "y",
    vectors: Vectors,
    tokens: Sentences,
    container: HTMLElement,
  ): WordPos {
    const words = Object.keys(vectors);

    const positions: WordPos = [];

    if (words.length === 0) {
      return positions;
    }

    const xs = words.map((w) => vectors[w][0]);
    const ys = words.map((w) => vectors[w][1]);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);

    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    const rect = container.getBoundingClientRect();

    const width = rect.width || container.clientWidth || 600;

    const height = rect.height || container.clientHeight || 600;

    const flattenedTokens = tokens.flat();

    if (alongAxis === "x") {
      let totalWidth = 0;

      flattenedTokens.forEach((rawWord, tokenIndex) => {
        const word = rawWord.toLocaleLowerCase();

        const px = tokenIndex * TOKEN_SPACING;

        totalWidth = px;

        let py = DEFAULT_Y_POS;

        if (word in vectors) {
          const [, y] = vectors[word];

          py = PADDING + (1 - (y - minY) / spanY) * (height - PADDING * 2);
        }

        positions.push({
          px,
          py,
        });
      });

      this.lineContainer.style.width = `${totalWidth}px`;
    } else {
      let totalHeight = 0;

      flattenedTokens.forEach((rawWord, tokenIndex) => {
        const word = rawWord.toLocaleLowerCase();

        const py = tokenIndex * TOKEN_SPACING;

        totalHeight = py;

        let px = DEFAULT_X_POS;

        if (word in vectors) {
          const [x] = vectors[word];

          px = PADDING + ((x - minX) / spanX) * (width - PADDING * 2);
        }

        positions.push({
          px,
          py,
        });
      });

      this.lineContainer.style.height = `${totalHeight}px`;
    }

    return positions;
  }

  private applyPositions(
    entries: TokenEntry[],
    mode: RenderMode,
    wordCloudPositions: VectorPos,
    seqPositions: WordPos,
  ): void {
    entries.forEach((entry, i) => {
      const pos = mode === 0 ? wordCloudPositions[entry.word] : seqPositions[i];

      if (!pos) return;

      entry.el.style.left = `${pos.px}px`;

      entry.el.style.top = `${pos.py}px`;
    });
  }

  private applyEdgeEmphasis(entries: TokenEntry[], connectedWords: Set<string>): void {
    for (const { word, el } of entries) {
      if (connectedWords.has(word)) {
        el.style.opacity = "1";
        el.style.zIndex = "2";
        el.style.transform = "translate(-50%, -50%) scale(1)";
        el.style.color = "#283541";
      } else {
        el.style.opacity = "0.8";
        el.style.zIndex = "0";
        el.style.transform = "translate(-50%, -50%) scale(0.92)";
        el.style.color = "#859cae";
      }
    }
  }

  private buildDepEdges(sentenceIndex: number): DepEdge[] {
    if (!this.deps) return [];

    const edges: DepEdge[] = [];

    const reps: {
      mode: DepRepresentation;
      data: DepSentence[];
    }[] = [
      {
        mode: "dm",
        data: this.deps.dm,
      },
      {
        mode: "pas",
        data: this.deps.pas,
      },
      {
        mode: "psd",
        data: this.deps.psd,
      },
    ];

    reps.forEach(({ mode, data }) => {
      const sentence = data[sentenceIndex];

      if (!sentence) return;

      sentence.forEach((relations, child) => {
        relations.forEach(([hanlpHead, relation], relationIndex) => {
          const head = hanlpHead - 1;

          if (head < 0 || head >= sentence.length || head === child) {
            return;
          }

          edges.push({
            id: [sentenceIndex, mode, head, child, relationIndex].join("-"),

            child,
            head,

            relation,

            representation: mode,

            start: Math.min(child, head),

            end: Math.max(child, head),
          });
        });
      });
    });

    return edges;
  }

  private buildDepMarkers(sentenceIndex: number): string {
    return (["dm", "pas", "psd"] as DepRepresentation[])
      .map(
        (rep) => `
          <marker
            id="wv-arrow-${sentenceIndex}-${rep}"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="${MARKER_SIZE}"
            markerHeight="${MARKER_SIZE}"
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill="${DEP_COLORS[rep]}"
            />
          </marker>
        `,
      )
      .join("");
  }

  /**
   * Creates the dependency SVG once.
   *
   * During force simulation, the SVG itself is kept alive.
   * Only the path `d` attributes are updated.
   */
  private createDependencyEdges(): void {
    if (!this.tok) return;

    const entries = this.ensureTokenElements(this.tok, this.wordContainer);

    const rect = this.lineContainer.getBoundingClientRect();

    const width = rect.width || this.lineContainer.clientWidth || 800;

    const height = rect.height || this.lineContainer.clientHeight || 600;

    const connectedWords = new Set<string>();

    const sentenceIndices = this.showAllSentences ? this.tok.map((_, index) => index) : [this.sentenceIndex];

    const markers: string[] = [];
    const paths: string[] = [];

    sentenceIndices.forEach((sentenceIndex) => {
      const sentence = this.tok![sentenceIndex];

      const edges = this.buildDepEdges(sentenceIndex);

      edges.forEach((edge) => {
        const headIndex = this.tokenIndex(sentenceIndex, edge.head);

        const childIndex = this.tokenIndex(sentenceIndex, edge.child);

        const headEntry = entries[headIndex];

        const childEntry = entries[childIndex];

        if (!headEntry || !childEntry) {
          return;
        }

        const a = this.getWordElementCenter(headEntry);

        const b = this.getWordElementCenter(childEntry);

        const { ctrl1x, ctrl1y, ctrl2x, ctrl2y } = WordVecRenderer.computeCurve(a.px, a.py, b.px, b.py, CURVATURE);

        paths.push(`
            <path
              class="wv-dep-arc wv-dep-${edge.representation}"
              data-edge="${WordVecRenderer.escape(edge.id)}"
              data-sentence="${sentenceIndex}"
              data-head="${edge.head}"
              data-child="${edge.child}"
              data-relation="${WordVecRenderer.escape(edge.relation)}"
              d="M ${a.px} ${a.py}
                 C ${ctrl1x} ${ctrl1y},
                   ${ctrl2x} ${ctrl2y},
                   ${b.px} ${b.py}"
              stroke="${DEP_COLORS[edge.representation]}"
              stroke-width="2.5"
              stroke-opacity="0.3"
              fill="none"
              marker-end="url(#wv-arrow-${sentenceIndex}-${edge.representation})"
            />
          `);

        const headWord = sentence[edge.head]?.toLocaleLowerCase();

        const childWord = sentence[edge.child]?.toLocaleLowerCase();

        if (headWord) {
          connectedWords.add(headWord);
        }

        if (childWord) {
          connectedWords.add(childWord);
        }
      });

      markers.push(this.buildDepMarkers(sentenceIndex));
    });

    this.lineContainer.innerHTML = this.wrapSvg({
      width,
      height,
      sentenceIndex: this.sentenceIndex,
      defs: markers.join(""),
      body: paths.join(""),
      extraAttrs: `style="position:absolute;` + `left:0;top:0;` + `pointer-events:none;` + `z-index:0"`,
    });

    this.applyEdgeEmphasis(entries, connectedWords);
  }

  /**
   * Updates only the existing SVG paths.
   *
   * This runs on every force tick, so we avoid
   * destroying/recreating the entire SVG.
   */
  private updateDependencyEdges(): void {
    if (!this.tok) return;

    const svg = this.lineContainer.querySelector<SVGSVGElement>(`.${this.svgClass}`);

    if (!svg) return;

    const entries = this.ensureTokenElements(this.tok, this.wordContainer);

    const sentenceIndices = this.showAllSentences ? this.tok.map((_, index) => index) : [this.sentenceIndex];

    sentenceIndices.forEach((sentenceIndex) => {
      // const sentence = this.tok![sentenceIndex];

      const edges = this.buildDepEdges(sentenceIndex);

      edges.forEach((edge) => {
        const headIndex = this.tokenIndex(sentenceIndex, edge.head);

        const childIndex = this.tokenIndex(sentenceIndex, edge.child);

        const headEntry = entries[headIndex];

        const childEntry = entries[childIndex];

        if (!headEntry || !childEntry) {
          return;
        }

        const path = svg.querySelector<SVGPathElement>(`[data-edge="${CSS.escape(edge.id)}"]`);

        if (!path) return;

        const a = this.getWordElementCenter(headEntry);

        const b = this.getWordElementCenter(childEntry);

        const { ctrl1x, ctrl1y, ctrl2x, ctrl2y } = WordVecRenderer.computeCurve(a.px, a.py, b.px, b.py, CURVATURE);

        path.setAttribute(
          "d",
          `M ${a.px} ${a.py}
             C ${ctrl1x} ${ctrl1y},
               ${ctrl2x} ${ctrl2y},
               ${b.px} ${b.py}`,
        );
      });
    });
  }

  /**
   * Starts the force simulation for expanded X/Y layouts.
   *
   * The sequence positions are the equilibrium positions.
   * Dependency links pull connected words toward each other.
   * Collision prevents words from overlapping.
   */
  private startForceSimulation(entries: TokenEntry[], seqPositions: WordPos): void {
    if (!this.tok) return;

    const nodes: ForceNode[] = [];

    let globalIndex = 0;

    this.tok.forEach((sentence, sentenceIndex) => {
      sentence.forEach((rawWord, wordIndex) => {
        const pos = seqPositions[globalIndex];

        const entry = entries[globalIndex];

        globalIndex++;

        if (!pos || !entry) {
          return;
        }

        nodes.push({
          id: `${sentenceIndex}-${wordIndex}`,
          sentence: sentenceIndex,
          word: wordIndex,
          wordText: rawWord.toLocaleLowerCase(),
          x: pos.px,
          y: pos.py,

          targetX: pos.px,
          targetY: pos.py,

          entry,
        });
      });
    });

    const nodeMap = new Map<string, ForceNode>();

    nodes.forEach((node) => {
      nodeMap.set(node.id, node);
    });

    const links: ForceLink[] = [];

    const sentenceIndices = this.showAllSentences ? this.tok.map((_, index) => index) : [this.sentenceIndex];

    sentenceIndices.forEach((sentenceIndex) => {
      const edges = this.buildDepEdges(sentenceIndex);

      edges.forEach((edge) => {
        const sourceId = `${sentenceIndex}-${edge.head}`;

        const targetId = `${sentenceIndex}-${edge.child}`;

        if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) {
          return;
        }

        links.push({
          id: edge.id,

          source: sourceId,
          target: targetId,
          distance: TOKEN_SPACING / 2,
        });
      });
    });

    const linkForce = forceLink<ForceNode, ForceLink>(links)
      .id((node) => node.id)
      .distance((link) => link.distance)
      .strength(0.13);

    const simulation = forceSimulation<ForceNode>(nodes)
      .force("link", linkForce)

      /*
       * Keep words from overlapping.
       *
       * The word elements are centered on
       * their left/top coordinates, so this
       * radius roughly corresponds to half
       * the visual word footprint.
       */
      .force("collide", forceCollide<ForceNode>(30).strength(0.9))

      /*
       * Pull words back toward their
       * original sequential positions.
       *
       * These forces make dependency links
       * locally affect the layout without
       * allowing the whole sentence to drift.
       */
      .force("x", forceX<ForceNode>((node) => node.targetX).strength(0.05))
      .force("y", forceY<ForceNode>((node) => node.targetY).strength(0.25))
      .alpha(1)
      .alphaDecay(0.03)
      .velocityDecay(0.3);

    this.simulation = simulation;

    simulation.on("tick", () => {
      if (this.simulation !== simulation) {
        return;
      }

      this.updateForcePositions(nodes);

      this.updateDependencyEdges();
    });

    simulation.on("end", () => {
      if (this.simulation === simulation) {
        this.simulation = null;
      }
    });
  }

  private updateForcePositions(nodes: ForceNode[]): void {
    nodes.forEach((node) => {
      if (node.x == null || node.y == null) {
        return;
      }

      node.entry.el.style.left = `${node.x}px`;

      node.entry.el.style.top = `${node.y}px`;
    });
  }

  private getWordElementCenter(entry: TokenEntry): Point {
    return {
      px: parseFloat(entry.el.style.left) || 0,

      py: parseFloat(entry.el.style.top) || 0,
    };
  }

  private tokenIndex(sentenceIndex: number, wordIndex: number): number {
    if (!this.tok) {
      return wordIndex;
    }

    let index = wordIndex;

    for (let i = 0; i < sentenceIndex; i++) {
      index += this.tok[i].length;
    }

    return index;
  }

  private stopSimulation(): void {
    if (!this.simulation) {
      return;
    }

    this.simulation.stop();
    this.simulation = null;
  }
}
