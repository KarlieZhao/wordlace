import { posX, COLUMN_WIDTH } from "./rendernet";
import {
  BaseDependencyRenderer,
  ROW_HEIGHT,
  SENTENCE_GAP,
} from "./rendererbase";

export type SdpRelation = [number, string];
export type SdpSentence = SdpRelation[][];
export type SdpMode = "dm" | "pas" | "psd";

export interface SdpDoc {
  tok: string[][];
  pos: string[][];
  "sdp/dm"?: SdpSentence[];
  "sdp/pas"?: SdpSentence[];
  "sdp/psd"?: SdpSentence[];
}

interface Edge {
  id: string;
  sentence: number;
  child: number;
  head: number;
  relation: string;
  start: number;
  end: number;
  lane: number;
}

const CURVATURE = 12;
const MARGIN = { left: 50, right: 80, top: 30, bottom: 30 };
const MIN_WIDTH = 500;

//  converts a relation into a CSS class.
function relationClass(relation: string): string {
  return "relation-" + relation.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * Renders semantic-dependency-parse (SDP) sentences
 */
export class SdpDependencyRenderer extends BaseDependencyRenderer {
  private readonly mode: SdpMode;

  constructor(mode: SdpMode = "dm") {
    super();
    this.mode = mode;
  }

  private buildEdges(sentence: SdpSentence, sentenceIndex: number): Edge[] {
    const edges: Edge[] = [];

    sentence.forEach((relations, childIndex) => {
      // childIndex is 0-based
      const child = childIndex;

      relations.forEach(([hanlpHead, relation], relationIndex) => {
        // HanLP head is 1-based, convert to 0-based
        const head = hanlpHead - 1;
        if (head <= 0 || head >= sentence.length || head === child) return;

        edges.push({
          id: [sentenceIndex, head, child, relationIndex].join("-"),
          sentence: sentenceIndex,
          child,
          head,
          relation,
          start: Math.min(child, head),
          end: Math.max(child, head),
          lane: -1,
        });
      });
    });

    return edges;
  }

  private calculateTextX(
    tokens: string[],
    pos: string[],
    startX: number,
  ): number[] {
    const textX: number[] = [];
    for (let i = 0; i <= tokens.length; i++) {
      textX.push(i === 0 ? MARGIN.left : posX(pos[i]) + startX);
    }
    return textX;
  }

  //renders a single sentence
  renderSentenceSvg(
    tokens: string[],
    pos: string[],
    sentence: SdpSentence,
    sentenceIndex: number,
  ): string {
    const edges = this.buildEdges(sentence, sentenceIndex);
    const laneCount = SdpDependencyRenderer.assignLanes(edges);

    // TODO: what should the x-pos of each sentence be?
    const startX = Math.random() * 400;
    const textX = this.calculateTextX(tokens, pos, startX);
    const rowY = (token: number) => MARGIN.top + (token - 0.5) * ROW_HEIGHT;

    const tokenWidth =
      MARGIN.left + Math.max(0, tokens.length - 1) * COLUMN_WIDTH;
    const arcWidth = laneCount * CURVATURE * 2;
    const width = Math.max(MIN_WIDTH, tokenWidth + arcWidth + MARGIN.right);
    const height = Math.max(
      MARGIN.top + tokens.length * ROW_HEIGHT + MARGIN.bottom,
      100,
    );

    const parts: string[] = [];

    // arcs + relation labels
    edges.forEach((edge) => {
      const xHead = textX[edge.head + 1] + MARGIN.left;
      const xChild = textX[edge.child + 1] + MARGIN.left;
      const yHead = rowY(edge.head + 1);
      const yChild = rowY(edge.child + 1);

      const { ctrl1x, ctrl1y, ctrl2x, ctrl2y, midx, midy } =
        SdpDependencyRenderer.computeCurve(
          xHead,
          yHead,
          xChild,
          yChild,
          edge.lane,
          CURVATURE,
        );

      const relationCls = relationClass(edge.relation);
      const arcId = `sdp-edge-${edge.id}`;

      parts.push(`
        <path
          id="${arcId}"
          class="sdp-arc ${relationCls}"
          data-sentence="${sentenceIndex}"
          data-edge="${SdpDependencyRenderer.escape(edge.id)}"
          data-head="${edge.head}"
          data-child="${edge.child}"
          data-relation="${SdpDependencyRenderer.escape(edge.relation)}"
          d="M ${xHead} ${yHead}
             C ${ctrl1x} ${ctrl1y},
               ${ctrl2x} ${ctrl2y},
               ${xChild} ${yChild}"
          marker-end="url(#sdp-arrow-${sentenceIndex})"
        />
      `);

      parts.push(`
        <text
          class="sdp-relation ${relationCls}"
          data-sentence="${sentenceIndex}"
          data-edge="${SdpDependencyRenderer.escape(edge.id)}"
          x="${midx}"
          y="${midy - 3}"
          text-anchor="middle"
          pointer-events="none"
        >${SdpDependencyRenderer.escape(edge.relation)}</text>
      `);
    });

    // words
    tokens.forEach((token, index) => {
      const word = index + 1;
      const x = textX[word];
      const y = rowY(word);
      const posTag = pos[index] ?? "";
      const fillColor = SdpDependencyRenderer.posColor(posTag);

      parts.push(`
        <text
          class="sdp-word"
          data-sentence="${sentenceIndex}"
          data-word="${word}"
          data-pos="${SdpDependencyRenderer.escape(posTag)}"
          x="${x}"
          y="${y}"
          fill="${fillColor}"
        >${SdpDependencyRenderer.escape(token)}</text>
      `);
    });

    const defs = `
      <marker
        id="sdp-arrow-${sentenceIndex}"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" class="sdp-arrow" />
      </marker>
    `;

    return this.wrapSvg({
      width,
      height,
      sentenceIndex,
      defs,
      body: `<g class="sdp-sentence" data-sentence="${sentenceIndex}">${parts.join("\n")}</g>`,
      extraAttrs: `data-sdp-mode="${this.mode}"`,
    });
  }

  /** Renders every sentence for the configured mode as an array of standalone <svg> strings. */
  renderSentences(doc: SdpDoc): string[] {
    const sdpKey = `sdp/${this.mode}` as "sdp/dm" | "sdp/pas" | "sdp/psd";
    const sdpData = doc[sdpKey];

    if (!sdpData) {
      console.warn(`HanLP document does not contain ${sdpKey}`);
      return [
        `<svg class="${this.svgClass}" xmlns="http://www.w3.org/2000/svg"><text x="20" y="30">No ${sdpKey} data available.</text></svg>`,
      ];
    }

    return sdpData.map((sentence, i) =>
      this.renderSentenceSvg(doc.tok[i] ?? [], doc.pos[i] ?? [], sentence, i),
    );
  }

  renderDocSvg(doc: SdpDoc): string {
    const sentences = this.renderSentences(doc)
      .map(
        (svg, i) =>
          `<div class="sdp-sentence-wrap" data-sentence="${i}" style="margin-bottom:${SENTENCE_GAP}px">${svg}</div>`,
      )
      .join("\n");
    return `<div class="dependency-doc" data-sdp-mode="${this.mode}">${sentences}</div>`;
  }

  render(container: HTMLElement, doc: SdpDoc): void {
    container.innerHTML = this.renderDocSvg(doc);
    this.setupHover(container);
  }

  // ---------------------------------------------------------------------
  // hover
  // ---------------------------------------------------------------------

  setupHover(container: HTMLElement): void {
    this.attachHover(container, {
      wordSelector: ".sdp-word",
      arcSelector: ".sdp-arc",
      onWordHover: (svg, sentence, word) =>
        this.highlightWord(svg, sentence, word),
      onArcHover: (svg, sentence, head, child, edgeId) =>
        this.highlightEdge(svg, sentence, head, child, edgeId),
      onClear: (svg) => this.clearHighlight(svg),
      leaveEvent: "mouseleave",
    });
  }

  private highlightWord(
    svg: SVGSVGElement,
    sentenceIndex: number,
    wordIndex: number,
  ): void {
    this.clearHighlight(svg);
    svg.classList.add("has-sdp-hover");

    svg
      .querySelector(
        `.sdp-word[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`,
      )
      ?.classList.add("is-sdp-highlighted");

    const edges = svg.querySelectorAll<SVGPathElement>(
      `.sdp-arc[data-sentence="${sentenceIndex}"]`,
    );
    edges.forEach((edge) => {
      const head = Number(edge.dataset.head);
      const child = Number(edge.dataset.child);
      if (head !== wordIndex && child !== wordIndex) return;

      edge.classList.add("is-sdp-highlighted");

      const edgeId = edge.dataset.edge;
      if (edgeId) {
        svg
          .querySelector(`.sdp-relation[data-edge="${edgeId}"]`)
          ?.classList.add("is-sdp-highlighted");
      }

      const otherWord = head === wordIndex ? child : head;
      svg
        .querySelector(
          `.sdp-word[data-sentence="${sentenceIndex}"][data-word="${otherWord}"]`,
        )
        ?.classList.add("is-sdp-connected");
    });
  }

  private highlightEdge(
    svg: SVGSVGElement,
    sentenceIndex: number,
    head: number,
    child: number,
    edgeId?: string,
  ): void {
    this.clearHighlight(svg);
    svg.classList.add("has-sdp-hover");

    let edge: SVGPathElement | null = edgeId
      ? svg.querySelector<SVGPathElement>(`.sdp-arc[data-edge="${edgeId}"]`)
      : null;

    if (!edge) {
      const edges = svg.querySelectorAll<SVGPathElement>(
        `.sdp-arc[data-sentence="${sentenceIndex}"]`,
      );
      edge =
        Array.from(edges).find(
          (candidate) =>
            Number(candidate.dataset.head) === head &&
            Number(candidate.dataset.child) === child,
        ) ?? null;
    }
    edge?.classList.add("is-sdp-highlighted");

    if (edgeId) {
      svg
        .querySelector(`.sdp-relation[data-edge="${edgeId}"]`)
        ?.classList.add("is-sdp-highlighted");
    }

    svg
      .querySelector(
        `.sdp-word[data-sentence="${sentenceIndex}"][data-word="${head}"]`,
      )
      ?.classList.add("is-sdp-highlighted");
    svg
      .querySelector(
        `.sdp-word[data-sentence="${sentenceIndex}"][data-word="${child}"]`,
      )
      ?.classList.add("is-sdp-connected");
  }

  private clearHighlight(svg: SVGSVGElement): void {
    this.clearHighlightClasses(
      svg,
      "has-sdp-hover",
      "is-sdp-highlighted",
      "is-sdp-connected",
    );
  }
}
