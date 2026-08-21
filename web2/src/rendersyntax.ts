import type { DepDoc, DepEdgeRaw } from "./types";
import { POS_COLOR_MAP } from "./utils";
import { BaseDependencyRenderer, ROW_HEIGHT, LAYOUT_CONFIG } from "./rendererbase";
import { SENTENCE_GAP } from "./rendererbase";

export type LayoutMode = "tree" | "net";

interface Edge {
  child: number;
  head: number;
  start: number;
  end: number;
  lane: number;
}

const FONT_SIZE = 12;
const MARGIN_BOTTOM = 20;
const EXTRA_TEXT_SPACE = 100; // room for the trailing word's text


export const POS_ORDER: string[] = Object.keys(POS_COLOR_MAP);
const UNKNOWN_POS_COLUMN = POS_ORDER.length; // fallback


function posColumn(posTag: string | undefined): number {
  if (posTag) {
    const idx = POS_ORDER.indexOf(posTag);
    if (idx !== -1) return idx;
  }
  return UNKNOWN_POS_COLUMN;
}

export function posX(posTag: string | undefined): number {
  const cfg = LAYOUT_CONFIG.net;
  return cfg.marginLeft + posColumn(posTag) * cfg.unitWidth;
}

/**
 * renders syntactic dependency tree or net
 */
export class SyntacticDependencyRenderer extends BaseDependencyRenderer {
  mode: LayoutMode;

  constructor(mode: LayoutMode = "net") {
    super();
    this.mode = mode;
  }

  setMode(mode: LayoutMode) {
    this.mode = mode;
  }

  private buildEdges(deps: DepEdgeRaw[]): Edge[] {
    const edges: Edge[] = [];
    deps.forEach(([head], idx) => {
      const child = idx + 1;
      if (head === 0) return; // root, no incoming edge
      edges.push({
        child,
        head,
        start: Math.min(child, head),
        end: Math.max(child, head),
        lane: -1,
      });
    });
    SyntacticDependencyRenderer.assignLanes(edges);
    return edges;
  }

  // Dependency-tree depth per row (only used for trees), via a recursive walk up the head chain
  private computeDepths(tokens: string[], deps: DepEdgeRaw[]): number[] {
    const heads: number[] = [0];
    deps.forEach(([head]) => heads.push(head));

    const depth: number[] = new Array(tokens.length + 1).fill(-1);

    const getDepth = (r: number, seen: Set<number>): number => {
      if (depth[r] !== -1) return depth[r];
      const h = heads[r];
      if (h === 0 || seen.has(r)) {
        depth[r] = 0;
        return 0;
      }
      seen.add(r);
      depth[r] = getDepth(h, seen) + 1;
      return depth[r];
    };

    for (let r = 1; r <= tokens.length; r++) getDepth(r, new Set());
    return depth;
  }

  // x-position per row (1-indexed, index 0 unused)
  private calculateTextX(
    tokens: string[],
    deps: DepEdgeRaw[],
    pos: string[],
    startX: number,
  ): number[] {
    const cfg = LAYOUT_CONFIG[this.mode];
    const textX: number[] = [startX];

    if (this.mode === "net") {
      for (let r = 1; r <= tokens.length; r++)
        textX.push(posX(pos[r - 1]) + startX);
    } else {
      const depth = this.computeDepths(tokens, deps);
      for (let r = 1; r <= tokens.length; r++) {
        textX.push(cfg.marginLeft + depth[r] * cfg.unitWidth + startX);
      }
    }

    return textX;
  }

  // max POS column ("net" mode) or max tree depth ("tree" mode) for this sentence
  private measureExtent(
    tokens: string[],
    deps: DepEdgeRaw[],
    pos: string[],
  ): number {
    if (this.mode === "net") {
      let max = 0;
      for (let r = 1; r <= tokens.length; r++)
        max = Math.max(max, posColumn(pos[r - 1]));
      return max;
    }
    const depth = this.computeDepths(tokens, deps);
    let max = 0;
    for (let r = 1; r <= tokens.length; r++) max = Math.max(max, depth[r]);
    return max;
  }

  renderSentenceSvg(
    tokens: string[],
    deps: DepEdgeRaw[],
    pos: string[],
    sentenceIndex: number,
  ): string {
    const cfg = LAYOUT_CONFIG[this.mode];
    const edges = this.buildEdges(deps);
    const hasHead = new Set(edges.map((e) => e.child));

    // TODO: what should the x-pos of each sentence be?
    const startX = this.xpad[sentenceIndex % this.xpad.length];
    const textX = this.calculateTextX(tokens, deps, pos, startX);
    const rowY = (r: number) => cfg.marginTop + (r - 0.5) * ROW_HEIGHT;   
    const width = Math.max(
      500,
      LAYOUT_CONFIG.net.marginLeft * 1.5 + Math.max(...textX),
    );
    const height = cfg.marginTop + tokens.length * ROW_HEIGHT + MARGIN_BOTTOM;

    const parts: string[] = [];

    // arcs
    edges.forEach((e, edgeIndex) => {
      const xHead = textX[e.head];
      const xChild = textX[e.child];
      const yHead = rowY(e.head);
      const yChild = rowY(e.child);

      const { ctrl1x, ctrl1y, ctrl2x, ctrl2y } =
        SyntacticDependencyRenderer.computeCurve(
          xHead,
          yHead,
          xChild,
          yChild,
          e.lane,
          cfg.curvature,
        );

      parts.push(`
        <path
          class="dep-arc"
          data-sentence="${sentenceIndex}"
          data-edge="${edgeIndex}"
          data-head="${e.head}"
          data-child="${e.child}"
          d="M ${xHead} ${yHead}
             C ${ctrl1x} ${ctrl1y},
               ${ctrl2x} ${ctrl2y},
               ${xChild} ${yChild}"
          marker-start="url(#arrow-${sentenceIndex})"
        />
      `);
    });

    // words
    for (let r = 1; r <= tokens.length; r++) {
      const cx = textX[r];
      const cy = rowY(r);
      const isRoot = !hasHead.has(r);

      if (isRoot) {
        parts.push(`
          <circle
            cx="${cx - 8}"
            cy="${cy - FONT_SIZE / 4}"
            r="${FONT_SIZE / 4}"
            class="dep-root-dot"
            data-sentence="${sentenceIndex}"
            data-word="${r}"
          />
        `);
      }

      const cls = isRoot ? "dep-word dep-root" : "dep-word";
      const fillColor = SyntacticDependencyRenderer.posColor(pos[r - 1]);

      parts.push(`
        <text
          x="${cx}"
          y="${cy}"
          class="${cls}"
          data-sentence="${sentenceIndex}"
          data-word="${r}"
          fill="${fillColor}"
        >${SyntacticDependencyRenderer.escape(tokens[r - 1])}</text>
      `);
    }

    const defs = `
      <marker
        id="arrow-${sentenceIndex}"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" class="dep-arrow" />
      </marker>
    `;

    return this.wrapSvg({
      width,
      height,
      sentenceIndex,
      defs,
      body: parts.join("\n"),
    });
  }

  renderSentences(doc: DepDoc): string[] {
    return doc.tok.map((tokens, i) =>
      this.renderSentenceSvg(tokens, doc.dep[i], doc.pos[i], i),
    );
  }

  renderDocSvg(doc: DepDoc): string {
    const sentences = this.renderSentences(doc)
      .map(
        (svg, i) =>
          `<div class="dep-sentence-wrap" data-sentence="${i}" style="margin-bottom:${SENTENCE_GAP}px">${svg}</div>`,
      )
      .join("\n");
    return `<div class="dependency-doc">${sentences}</div>`;
  }

  render(container: HTMLElement, doc: DepDoc): void {
    container.innerHTML = this.renderDocSvg(doc);
    this.addHoverEvents(container);
  }

  // hover
  addHoverEvents(container: HTMLElement): void {
    this.attachHover(container, {
      wordSelector: ".dep-word",
      arcSelector: ".dep-arc",
      onWordHover: (svg, sentence, word) =>
        this.highlightWord(svg, sentence, word),
      onArcHover: (svg, sentence, head, child) =>
        this.highlightEdge(svg, sentence, head, child),
      onClear: (svg) => this.clearHighlights(svg),
      leaveEvent: "mouseout",
    });
  }

  private highlightWord(
    svg: SVGSVGElement,
    sentenceIndex: number,
    wordIndex: number,
  ): void {
    this.clearHighlights(svg);
    svg.classList.add("has-hover");

    svg
      .querySelector(
        `.dep-word[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`,
      )
      ?.classList.add("is-highlighted");
    svg
      .querySelector(
        `.dep-root-dot[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`,
      )
      ?.classList.add("is-highlighted");

    const edges = svg.querySelectorAll<SVGPathElement>(
      `.dep-arc[data-sentence="${sentenceIndex}"]`,
    );
    edges.forEach((edge) => {
      const head = Number(edge.dataset.head);
      const child = Number(edge.dataset.child);
      if (head !== wordIndex && child !== wordIndex) return;

      edge.classList.add("is-highlighted");
      const otherWord = head === wordIndex ? child : head;

      svg
        .querySelector(
          `.dep-word[data-sentence="${sentenceIndex}"][data-word="${otherWord}"]`,
        )
        ?.classList.add("is-connected");
      svg
        .querySelector(
          `.dep-root-dot[data-sentence="${sentenceIndex}"][data-word="${otherWord}"]`,
        )
        ?.classList.add("is-connected");
    });
  }

  private highlightEdge(
    svg: SVGSVGElement,
    sentenceIndex: number,
    head: number,
    child: number,
  ): void {
    this.clearHighlights(svg);
    svg.classList.add("has-hover");

    const edge = Array.from(
      svg.querySelectorAll<SVGPathElement>(
        `.dep-arc[data-sentence="${sentenceIndex}"]`,
      ),
    ).find(
      (el) =>
        Number(el.dataset.head) === head && Number(el.dataset.child) === child,
    );
    edge?.classList.add("is-highlighted");

    [head, child].forEach((wordIndex) => {
      svg
        .querySelector(
          `.dep-word[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`,
        )
        ?.classList.add("is-highlighted");
      svg
        .querySelector(
          `.dep-root-dot[data-sentence="${sentenceIndex}"][data-word="${wordIndex}"]`,
        )
        ?.classList.add("is-highlighted");
    });
  }

  private clearHighlights(svg: SVGSVGElement): void {
    this.clearHighlightClasses(
      svg,
      "has-hover",
      "is-highlighted",
      "is-connected",
    );
  }
}
