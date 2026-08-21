// DM: DELPH-IN MRS (DM) semantic dependency representation.

// Predicate:
// A predicate is generally an event/action/state, and its arguments are the participants.

// PSD = Prague Semantic Dependencies
// originating from the Prague school of linguistics
// It represents semantic relationships using a set of relations designed around the meaning/function of words in a sentence,
// rather than their surface grammatical configuration.

// sdp/dm	What semantic relationships exist between words?
// sdp/pas	Who did what to whom / what are the predicate's arguments?
// sdp/psd	What semantic functions do words have in the sentence?

import { posX } from "./rendersyntax";
import {
  BaseDependencyRenderer,
  ROW_HEIGHT,
  SENTENCE_GAP,
  LAYOUT_CONFIG,
  COLUMN_WIDTH,
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

export type SdpRepresentation = "dm" | "pas" | "psd";

interface Edge {
  id: string;
  sentence: number;
  child: number;
  head: number;
  relation: string;
  representation: SdpRepresentation;
  start: number;
  end: number;
  lane: number;
}

// Converts a relation into a CSS class.
function relationClass(relation: string): string {
  return "relation-" + relation.replace(/[^a-zA-Z0-9_-]/g, "-");
}

// Converts an SDP representation into a CSS class.
function representationClass(representation: SdpRepresentation): string {
  return `sdp-${representation}`;
}

// Renders semantic-dependency-parse sentences.
export class SdpDependencyRenderer extends BaseDependencyRenderer {
  constructor() {
    super();
  }

  /**
   * Build edges for one SDP representation.
   */
  private buildEdges(
    sentence: SdpSentence,
    sentenceIndex: number,
    representation: SdpRepresentation,
  ): Edge[] {
    const edges: Edge[] = [];

    sentence.forEach((relations, childIndex) => {
      // childIndex is 0-based.
      const child = childIndex;

      relations.forEach(([hanlpHead, relation], relationIndex) => {
        // HanLP head is 1-based, convert to 0-based.
        const head = hanlpHead - 1;
        // Ignore invalid heads
        if (head < 0 || head >= sentence.length || head === child) {
          return;
        }

        edges.push({
          id: [sentenceIndex, representation, head, child, relationIndex].join(
            "-",
          ),
          sentence: sentenceIndex,
          child,
          head,
          relation,
          representation,
          start: Math.min(child, head),
          end: Math.max(child, head),
          lane: -1,
        });
      });
    });

    return edges;
  }

  /**
   * Build the complete semantic dependency graph by overlaying
   * DM, PAS, and PSD.
   */
  private buildAllEdges(doc: SdpDoc, sentenceIndex: number): Edge[] {
    const representations: Array<{
      mode: SdpRepresentation;
      data?: SdpSentence[];
    }> = [
      {
        mode: "dm",
        data: doc["sdp/dm"],
      },
      {
        mode: "pas",
        data: doc["sdp/pas"],
      },
      {
        mode: "psd",
        data: doc["sdp/psd"],
      },
    ];

    const edges: Edge[] = [];

    representations.forEach(({ mode, data }) => {
      const sentence = data?.[sentenceIndex];

      if (!sentence) return;

      edges.push(...this.buildEdges(sentence, sentenceIndex, mode));
    });

    SdpDependencyRenderer.assignLanes(edges);

    return edges;
  }

  private calculateTextX(
    tokens: string[],
    pos: string[],
    startX: number,
  ): number[] {
    const textX: number[] = [];

    for (let i = 0; i < tokens.length; i++) {
      textX.push(posX(pos[i]) + startX);
    }

    return textX;
  }

  /**
   * Renders a single sentence with DM, PAS, and PSD overlaid.
   */
  renderSentenceSvg(
    tokens: string[],
    pos: string[],
    doc: SdpDoc,
    sentenceIndex: number,
  ): string {
    const edges = this.buildAllEdges(doc, sentenceIndex);
    const startX = this.xpad[sentenceIndex % this.xpad.length];

    const textX = this.calculateTextX(tokens, pos, startX);

    const rowY = (token: number) =>
      LAYOUT_CONFIG.net.marginTop + (token - 0.5) * ROW_HEIGHT;

    const width = Math.max(
      500,
      LAYOUT_CONFIG.net.marginLeft * 1.5 + Math.max(...textX),
    );

    const height = Math.max(
      LAYOUT_CONFIG.net.marginTop * 2 + tokens.length * ROW_HEIGHT,
      100,
    );

    const parts: string[] = [];

    // --------------------------------------------------
    // Arcs + relation labels
    // --------------------------------------------------

    edges.forEach((edge) => {
      const xHead = textX[edge.head] + COLUMN_WIDTH / 2;
      const xChild = textX[edge.child] + COLUMN_WIDTH / 2;

      const yHead = rowY(edge.head);
      const yChild = rowY(edge.child);

      const { ctrl1x, ctrl1y, ctrl2x, ctrl2y, midx, midy } =
        SdpDependencyRenderer.computeCurve(
          xHead,
          yHead,
          xChild,
          yChild,
          edge.lane,
          LAYOUT_CONFIG.net.curvature,
        );

      const relationCls = relationClass(edge.relation);

      const representationCls = representationClass(edge.representation);

      const arcId = `sdp-edge-${edge.id}`;

      parts.push(`
        <path
          id="${arcId}"
          class="sdp-arc ${representationCls} ${relationCls}"
          data-sentence="${sentenceIndex}"
          data-edge="${SdpDependencyRenderer.escape(edge.id)}"
          data-head="${edge.head}"
          data-child="${edge.child}"
          data-relation="${SdpDependencyRenderer.escape(edge.relation)}"
          data-sdp="${edge.representation}"
          d="M ${xHead} ${yHead}
             C ${ctrl1x} ${ctrl1y},
               ${ctrl2x} ${ctrl2y},
               ${xChild} ${yChild}"
          marker-end="url(#sdp-arrow-${sentenceIndex}-${edge.representation})"
        />
      `);

      parts.push(`
        <text
          class="sdp-relation ${representationCls} ${relationCls}"
          data-sentence="${sentenceIndex}"
          data-edge="${SdpDependencyRenderer.escape(edge.id)}"
          data-sdp="${edge.representation}"
          x="${midx}"
          y="${midy - 3}"
          text-anchor="middle"
          pointer-events="none"
        >${SdpDependencyRenderer.escape(edge.relation)}</text>
      `);
    });

    // --------------------------------------------------
    // Words
    // --------------------------------------------------

    tokens.forEach((token, index) => {
      const word = index;
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

    // --------------------------------------------------
    // Arrow markers
    // --------------------------------------------------

    const defs = `
      <marker
        id="sdp-arrow-${sentenceIndex}-dm"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path
          d="M 0 0 L 10 5 L 0 10 z"
          class="sdp-arrow sdp-dm"
        />
      </marker>

      <marker
        id="sdp-arrow-${sentenceIndex}-pas"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path
          d="M 0 0 L 10 5 L 0 10 z"
          class="sdp-arrow sdp-pas"
        />
      </marker>

      <marker
        id="sdp-arrow-${sentenceIndex}-psd"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path
          d="M 0 0 L 10 5 L 0 10 z"
          class="sdp-arrow sdp-psd"
        />
      </marker>
    `;

    return this.wrapSvg({
      width,
      height,
      sentenceIndex,
      defs,
      body: `
        <g
          class="sdp-sentence"
          data-sentence="${sentenceIndex}"
        >
          ${parts.join("\n")}
        </g>
      `,
      extraAttrs: `data-sdp-mode="overlay"`,
    });
  }

  renderSentences(doc: SdpDoc): string[] {
    const hasAnySdp = doc["sdp/dm"] || doc["sdp/pas"] || doc["sdp/psd"];

    if (!hasAnySdp) {
      console.warn("HanLP document does not contain any SDP data");

      return [
        `<svg class="${this.svgClass}" xmlns="http://www.w3.org/2000/svg">
          <text x="20" y="30">
            No SDP data available.
          </text>
        </svg>`,
      ];
    }

    const sentenceCount = Math.max(
      doc.tok.length,
      doc["sdp/dm"]?.length ?? 0,
      doc["sdp/pas"]?.length ?? 0,
      doc["sdp/psd"]?.length ?? 0,
    );

    return Array.from({ length: sentenceCount }, (_, i) =>
      this.renderSentenceSvg(doc.tok[i] ?? [], doc.pos[i] ?? [], doc, i),
    );
  }

  renderDocSvg(doc: SdpDoc): string {
    const sentences = this.renderSentences(doc)
      .map(
        (svg, i) =>
          `<div
            class="sdp-sentence-wrap"
            data-sentence="${i}"
            style="margin-bottom:${SENTENCE_GAP}px"
          >
            ${svg}
          </div>`,
      )
      .join("\n");

    return `
      <div
        class="dependency-doc"
        data-sdp-mode="overlay"
      >
        ${sentences}
      </div>
    `;
  }

  render(container: HTMLElement, doc: SdpDoc): void {
    container.innerHTML = this.renderDocSvg(doc);
    this.setupHover(container);
  }

  // --------------------------------------------------
  // Hover
  // --------------------------------------------------

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

      if (head !== wordIndex && child !== wordIndex) {
        return;
      }

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
  ): void {    this.clearHighlight(svg);

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
