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

import { posColumn } from "./rendersyntax";
import { BaseDependencyRenderer, ROW_HEIGHT, LAYOUT_CONFIG, COLUMN_WIDTH } from "./rendererbase";

export type SdpRelation = [number, string];
export type SdpSentence = SdpRelation[][];
export type SdpMode = "dm" | "pas" | "psd";

export const TOP_GAP = -150;

export interface SdpDoc {
  tok: string[][];
  pos: string[][];
  "sdp/dm"?: SdpSentence[];
  "sdp/pas"?: SdpSentence[];
  "sdp/psd"?: SdpSentence[];
}

export type SdpRepresentation = "dm" | "pas" | "psd";
export const markerSize = 4;
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

function relationClass(relation: string): string {
  return "relation-" + relation.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function representationClass(representation: SdpRepresentation): string {
  return `sdp-${representation}`;
}


export class SdpDependencyRenderer extends BaseDependencyRenderer {
  hoverCallbackReconstruct: (words: string[]) => void;

  constructor(hoverCallbackReconstruct: (words: string[]) => void) {
    super();
    this.hoverCallbackReconstruct = hoverCallbackReconstruct;
  }

  private static linkCountColor(count: number, max: number): string {
    if (max === 0) {
      return "#ccc";
    }

    const t = count / max;

    const start = [220, 235, 255];
    const end = [20, 70, 160];

    const r = Math.round(start[0] + (end[0] - start[0]) * t);
    const g = Math.round(start[1] + (end[1] - start[1]) * t);
    const b = Math.round(start[2] + (end[2] - start[2]) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  private getWordLinkCounts(edges: Edge[], tokenCount: number): number[] {
    const counts = new Array(tokenCount).fill(0);

    edges.forEach((edge) => {
      counts[edge.head]++;
      counts[edge.child]++;
    });

    return counts;
  }

  private buildEdges(sentence: SdpSentence, sentenceIndex: number, representation: SdpRepresentation): Edge[] {
    const edges: Edge[] = [];

    sentence.forEach((relations, childIndex) => {
      // childIndex is 0-based.
      const child = childIndex;

      relations.forEach(([hanlpHead, relation], relationIndex) => {
        // HanLP head is 1-based, convert to 0-based
        const head = hanlpHead - 1;
        // Ignore invalid heads
        if (head < 0 || head >= sentence.length || head === child) {
          return;
        }

        edges.push({
          id: [sentenceIndex, representation, head, child, relationIndex].join("-"),
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

  private calculateTextY(tokens: string[], pos: string[]): number[] {
    const textY: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      textY.push(posColumn(pos[i]) * LAYOUT_CONFIG.net.unitWidth);
    }
    return textY;
  }

  /**
   * Renders a single sentence with DM, PAS, and PSD overlaid.
   */
  renderSentenceSvg(tokens: string[], pos: string[], doc: SdpDoc, sentenceIndex: number, containerWidth: number): string {
    const edges = this.buildAllEdges(doc, sentenceIndex);
    const linkCounts = this.getWordLinkCounts(edges, tokens.length);
    const maxLinks = Math.max(...linkCounts, 0);

    const textY = this.calculateTextY(tokens, pos);
    const rowX = (token: number) => (token * 550) / tokens.length;
    // LAYOUT_CONFIG.net.marginLeft + (token - 0.5) * ROW_HEIGHT;
    const tokenLength = tokens.map((t) => t.length);

    // dimensions of the svg
    const height = Math.abs(Math.max(...textY));
    const width = Math.max(50, LAYOUT_CONFIG.net.marginLeft * 2 + 4 * rowX(Math.max(...tokenLength)));

    const parts: string[] = [];

    // Arcs + relation labels
    edges.forEach((edge) => {
      const xHead = rowX(edge.head);
      const xChild = rowX(edge.child);

      const yHead = textY[edge.head] + COLUMN_WIDTH / 2;
      const yChild = textY[edge.child] + COLUMN_WIDTH / 2;

      const { ctrl1x, ctrl1y, ctrl2x, ctrl2y, midx, midy } = SdpDependencyRenderer.computeCurve(
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
          class="sdp-arc hidden ${representationCls} ${relationCls}"
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

    // Words
    tokens.forEach((token, index) => {
      const x = rowX(index);
      const y = textY[index];
      const posTag = pos[index] ?? "";
      const fillColor = SdpDependencyRenderer.linkCountColor(linkCounts[index], maxLinks);
      // SdpDependencyRenderer.posColor(posTag);

      parts.push(`
        <text
          class="sdp-word"
          data-sentence="${sentenceIndex}"
          data-word="${index}"
          data-pos="${SdpDependencyRenderer.escape(posTag)}"
          x="${x}"
          y="${y}"
          fill="${fillColor}"
        >${SdpDependencyRenderer.escape(token)}</text>
      `);
    });

    // Arrow markers

    const defs = `
      <marker
        id="sdp-arrow-${sentenceIndex}-dm"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="${markerSize}"
        markerHeight="${markerSize}"
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
        markerWidth="${markerSize}"
        markerHeight="${markerSize}"
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
        markerWidth="${markerSize}"
        markerHeight="${markerSize}"
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
<g class="sdp-sentence"
          data-sentence="${sentenceIndex}">
          ${parts.join("")}</g>
      `,
      extraAttrs: `data-sdp-mode="overlay"`,
    });
  }

  renderSentences(doc: SdpDoc, containerWidth:number): string[] {
    const hasAnySdp = doc["sdp/dm"] || doc["sdp/pas"] || doc["sdp/psd"];

    if (!hasAnySdp) {
      console.warn("HanLP document does not contain any SDP data");
      return [""];
    }

    const sentenceCount = Math.max(
      doc.tok.length,
      doc["sdp/dm"]?.length ?? 0,
      doc["sdp/pas"]?.length ?? 0,
      doc["sdp/psd"]?.length ?? 0,
    );

    return Array.from({ length: sentenceCount }, (_, i) =>
      this.renderSentenceSvg(doc.tok[i] ?? [], doc.pos[i] ?? [], doc, i, containerWidth),
    );
  }

  renderDocSvg(doc: SdpDoc): string {
    const containerWidth = this.container?.getBoundingClientRect().width || 600;
    const sentences = this.renderSentences(doc, containerWidth - 20)
      .map(
        (svg, i) =>
          `<div
            class="sdp-sentence-wrap"
            data-sentence="${i}"
          >${svg}</div>`,
      )
      .join("\n");

    return `
      <div
        class="dependency-doc"
        data-sdp-mode="overlay"
      >${sentences}</div>
    `;
  }

  render(container: HTMLElement, doc: SdpDoc): void {
    container.innerHTML = this.renderDocSvg(doc);
    this.setupHover(container);
  }

  setupHover(container: HTMLElement): void {
    this.attachHover(container, {
      wordSelector: ".sdp-word",
      arcSelector: ".sdp-arc",
      onWordHover: (svg, sentence, word) => this.highlightWord(svg, sentence, word),
      onArcHover: (svg, sentence, head, child, edgeId) => this.highlightEdge(svg, sentence, head, child, edgeId),

      onClear: (svg) => this.clearHighlight(svg),

      leaveEvent: "mouseleave",
    });
  }

  private highlightWord(svg: SVGSVGElement, sentenceIndex: number, wordIndex: number): void {
    this.clearHighlight(svg);
    svg.classList.add("has-sdp-hover");

    svg
      .querySelector(`.sdp-word[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`)
      ?.classList.add("is-sdp-highlighted");

    const edges = svg.querySelectorAll<SVGPathElement>(`.sdp-arc[data-sentence="${sentenceIndex}"]`);
    const highlightedWordIndices = new Set<number>([wordIndex]);

    edges.forEach((edge) => {
      const head = Number(edge.dataset.head);
      const child = Number(edge.dataset.child);
      if (head !== wordIndex && child !== wordIndex) {
        return;
      }
      edge.classList.add("is-sdp-highlighted");
      const edgeId = edge.dataset.edge;
      if (edgeId) {
        svg.querySelector(`.sdp-relation[data-edge="${edgeId}"]`)?.classList.add("is-sdp-highlighted");
      }
      const otherWord = head === wordIndex ? child : head;

      highlightedWordIndices.add(otherWord);
      svg
        .querySelector(`.sdp-word[data-sentence="${sentenceIndex}"][data-word="${otherWord}"]`)
        ?.classList.add("is-sdp-connected");
    });

    const words = [...highlightedWordIndices]
      .sort((a, b) => a - b)
      .map(
        (wordIndex) =>
          svg
            .querySelector<SVGElement>(`.sdp-word[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`)
            ?.textContent?.trim() ?? "",
      );

    this.hoverCallbackReconstruct(words);
  }

  private highlightEdge(svg: SVGSVGElement, sentenceIndex: number, head: number, child: number, edgeId?: string): void {
    this.clearHighlight(svg);

    svg.classList.add("has-sdp-hover");

    let edge: SVGPathElement | null = edgeId
      ? svg.querySelector<SVGPathElement>(`.sdp-arc[data-edge="${edgeId}"]`)
      : null;

    if (!edge) {
      const edges = svg.querySelectorAll<SVGPathElement>(`.sdp-arc[data-sentence="${sentenceIndex}"]`);
      edge =
        Array.from(edges).find(
          (candidate) => Number(candidate.dataset.head) === head && Number(candidate.dataset.child) === child,
        ) ?? null;
    }
    edge?.classList.add("is-sdp-highlighted");

    if (edgeId) {
      svg.querySelector(`.sdp-relation[data-edge="${edgeId}"]`)?.classList.add("is-sdp-highlighted");
    }

    svg
      .querySelector(`.sdp-word[data-sentence="${sentenceIndex}"][data-word="${head}"]`)
      ?.classList.add("is-sdp-highlighted");
    svg
      .querySelector(`.sdp-word[data-sentence="${sentenceIndex}"][data-word="${child}"]`)
      ?.classList.add("is-sdp-connected");
  }

  private clearHighlight(svg: SVGSVGElement): void {
    this.clearHighlightClasses(svg, "has-sdp-hover", "is-sdp-highlighted", "is-sdp-connected");
  }
}
