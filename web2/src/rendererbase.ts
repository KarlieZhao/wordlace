/**
 * Words are stacked vertically (one per row) in sentence order. Each
 * dependency draws a curved SVG path from the head's row to the
 * child's row, bulging left through a "lane" so overlapping
 * dependencies don't cross each other. An arrowhead marks the child
 * (dependent) end. Root words get a small dot instead of an incoming
 * arrow.
 *
 * Each sentence is rendered as its own standalone, self-sized <svg> —
 * not stacked inside one shared canvas — so sentences can be laid out,
 * scrolled, or lazily rendered independently by the caller.
 *
 * TODO:
 * left side: full text as pixel bit map
 * right side: user editor
 *
 * use lem, fea
 */

import { escapeXml, POS_COLOR_MAP } from "./utils";

export const SENTENCE_GAP = 15; // vertical gap between per-sentence <svg> wrappers
export const FONT_SIZE = 12;
export const ROW_HEIGHT = 20;
export interface LaneAssignable {
  start: number;
  end: number;
  lane: number;
}

export interface CurveGeometry {
  ctrl1x: number;
  ctrl1y: number;
  ctrl2x: number;
  ctrl2y: number;
  midx: number;
  midy: number;
}

export interface HoverBinding {
  wordSelector: string;
  arcSelector: string;
  onWordHover: (svg: SVGSVGElement, sentence: number, word: number) => void;
  onArcHover: (
    svg: SVGSVGElement,
    sentence: number,
    head: number,
    child: number,
    edgeId?: string,
  ) => void;
  onClear: (svg: SVGSVGElement) => void;
  /** "mouseout" (default) checks relatedTarget so bubbling within one svg doesn't clear.
   * "mouseleave" fires only when the pointer actually leaves the svg. */
  leaveEvent?: "mouseout" | "mouseleave";
}

export abstract class BaseDependencyRenderer {
  /** CSS class every per-sentence <svg> gets, used for hover */
  protected readonly svgClass: string = "dependency-svg";

  protected static assignLanes<T extends LaneAssignable>(edges: T[]): number {
    const laneEnds: number[] = [];
    const sorted = [...edges].sort(
      (a, b) => a.start - b.start || a.end - b.end,
    );

    for (const edge of sorted) {
      let placed = false;
      for (let lane = 0; lane < laneEnds.length; lane++) {
        if (laneEnds[lane] <= edge.start) {
          edge.lane = lane;
          laneEnds[lane] = edge.end;
          placed = true;
          break;
        }
      }
      if (!placed) {
        edge.lane = laneEnds.length;
        laneEnds.push(edge.end);
      }
    }

    return laneEnds.length;
  }

  /** Cubic-bezier control points */
  protected static computeCurve(
    xHead: number,
    yHead: number,
    xChild: number,
    yChild: number,
    lane: number,
    curvature: number,
  ): CurveGeometry {
    const dx = xChild - xHead;
    const dy = yChild - yHead;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    const px = -dy / len;
    const py = dx / len;

    const dist = Math.sqrt((xHead - xChild) ** 2 + (yHead - yChild) ** 2);
    const bulge = ((lane + 1) * curvature * dist) / 100;

    return {
      ctrl1x: xHead + dx * 0.3 + px * bulge,
      ctrl1y: yHead + dy * 0.3 + py * bulge,
      ctrl2x: xHead + dx * 0.7 + px * bulge,
      ctrl2y: yHead + dy * 0.7 + py * bulge,
      midx: xHead + dx * 0.5 + px * bulge,
      midy: yHead + dy * 0.5 + py * bulge,
    };
  }

  protected static posColor(posTag: string | undefined): string {
    return posTag && posTag in POS_COLOR_MAP ? POS_COLOR_MAP[posTag] : "#666";
  }

  protected static escape(value: string): string {
    return escapeXml(value);
  }

  protected wrapSvg(params: {
    width: number;
    height: number;
    sentenceIndex: number;
    defs: string;
    body: string;
    extraAttrs?: string;
  }): string {
    const {
      width,
      height,
      sentenceIndex,
      defs,
      body,
      extraAttrs = "",
    } = params;
    return `
      <svg
        class="${this.svgClass}"
        data-sentence="${sentenceIndex}"
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 ${width} ${height}"
        ${extraAttrs}
      >
        <defs>${defs}</defs>
        ${body}
      </svg>
    `;
  }

  /**
   * Generic mouseover + leave-event across every per-sentence
   */
  protected attachHover(root: HTMLElement, binding: HoverBinding): void {
    const svgs = root.querySelectorAll<SVGSVGElement>(`.${this.svgClass}`);
    const leaveEvent = binding.leaveEvent ?? "mouseout";

    svgs.forEach((svg) => {
      svg.addEventListener("mouseover", (event) => {
        const target = event.target as Element | null;
        if (!target) return;

        const word = target.closest<SVGTextElement>(binding.wordSelector);
        if (word) {
          binding.onWordHover(
            svg,
            Number(word.dataset.sentence),
            Number(word.dataset.word),
          );
          return;
        }

        const arc = target.closest<SVGPathElement>(binding.arcSelector);
        if (arc) {
          binding.onArcHover(
            svg,
            Number(arc.dataset.sentence),
            Number(arc.dataset.head),
            Number(arc.dataset.child),
            arc.dataset.edge,
          );
        }
      });

      svg.addEventListener(leaveEvent, (event) => {
        if (leaveEvent === "mouseout") {
          const related = (event as MouseEvent).relatedTarget as Node | null;
          if (related && svg.contains(related)) return;
        }
        binding.onClear(svg);
      });
    });
  }

  protected clearHighlightClasses(
    svg: SVGSVGElement,
    hoverClass: string,
    ...classes: string[]
  ): void {
    svg.classList.remove(hoverClass);
    svg
      .querySelectorAll(classes.map((c) => `.${c}`).join(", "))
      .forEach((el) => {
        el.classList.remove(...classes);
      });
  }
}
