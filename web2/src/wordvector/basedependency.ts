import { type SimulationNodeDatum } from "d3-force";
import { escapeXml, POS_COLOR_MAP } from "../utils";

export type Vectors = Record<string, [number, number]>;
export type Point = { px: number; py: number };

export type VectorPos = Record<string, Point>;
export type Sentences = string[][];
export type TokenEntry = { word: string; el: HTMLElement };

export type RenderMode = 0 | 1;
export type Axis = "x" | "y";
type DepRelation = [number, string];
export type DepSentence = DepRelation[][];
export type DepRepresentation = "dm" | "pas" | "psd";

export interface DepEdge {
  id: string;
  child: number;
  head: number;
  relation: string;
  representation: DepRepresentation;
}

/** Edge -> global token indices, kept so ticks can update paths without any DOM queries. */
export interface EdgeRef {
  path: SVGPathElement;
  head: number;
  child: number;
}

export interface ForceNode extends SimulationNodeDatum {
  id: number;
  /** Shared reference to the persistent position of this token. */
  point: Point;
  anchorX: number;
  anchorY: number;
}

export interface ForceLink {
  source: number | ForceNode;
  target: number | ForceNode;
}

export interface Bounds {
  minX: number;
  minY: number;
  spanX: number;
  spanY: number;
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
  onArcHover: (svg: SVGSVGElement, sentence: number, head: number, child: number, edgeId?: string) => void;
  onClear: (svg: SVGSVGElement) => void;
  leaveEvent?: "mouseout" | "mouseleave";
}

const PADDING = 40;

/* Helpers */
export const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export function elementSize(el: HTMLElement, fallbackW: number, fallbackH: number): { width: number; height: number } {
  const rect = el.getBoundingClientRect();
  return {
    width: rect.width || el.clientWidth || fallbackW,
    height: rect.height || el.clientHeight || fallbackH,
  };
}

/** Loop-based min/max (spreading huge arrays into Math.min can overflow the stack). */
export function computeBounds(vectors: Vectors): Bounds | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const key in vectors) {
    const [x, y] = vectors[key];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (minX === Infinity) return null;

  return { minX, minY, spanX: maxX - minX || 1, spanY: maxY - minY || 1 };
}

export const projectX = (x: number, b: Bounds, width: number): number =>
  PADDING + ((x - b.minX) / b.spanX) * (width - PADDING * 2);

export const projectY = (y: number, b: Bounds, height: number): number =>
  PADDING + (1 - (y - b.minY) / b.spanY) * (height - PADDING * 2);

export function computeCurve(
  xHead: number,
  yHead: number,
  xChild: number,
  yChild: number,
  curvature: number,
): CurveGeometry {
  const dx = xChild - xHead;
  const dy = yChild - yHead;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  const px = -dy / len;
  const py = dx / len;

  const dist = Math.sqrt((xHead - xChild) ** 2 + (yHead - yChild) ** 2);
  const bulge = (curvature * dist) / 100;

  return {
    ctrl1x: xHead + dx * 0.3 + px * bulge,
    ctrl1y: yHead + dy * 0.3 + py * bulge,
    ctrl2x: xHead + dx * 0.7 + px * bulge,
    ctrl2y: yHead + dy * 0.7 + py * bulge,
    midx: xHead + dx * 0.5 + px * bulge,
    midy: yHead + dy * 0.5 + py * bulge,
  };
}

export abstract class BaseDependencyRenderer {
  protected readonly svgClass: string = "dependency-svg";
  container: HTMLDivElement | null;

  constructor(containerSelector: string = "#en-visualizer") {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      throw new Error(`${containerSelector} container not found`);
    }
  }

  protected static computeCurve(...args: Parameters<typeof computeCurve>): CurveGeometry {
    return computeCurve(...args);
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
    const { width, height, sentenceIndex, defs, body, extraAttrs = "" } = params;
    return `
      <svg
        class="${this.svgClass}"
        data-sentence="${sentenceIndex}"
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        ${extraAttrs}
      >
        <defs>${defs}</defs>
        ${body}
      </svg>
    `;
  }

  protected attachHover(root: HTMLElement, binding: HoverBinding): void {
    const svgs = root.querySelectorAll<SVGSVGElement>(`.${this.svgClass}`);
    const leaveEvent = binding.leaveEvent ?? "mouseout";

    svgs.forEach((svg) => {
      svg.addEventListener("mouseover", (event) => {
        const target = event.target as Element | null;
        if (!target) return;

        const word = target.closest<SVGTextElement>(binding.wordSelector);
        if (word) {
          binding.onWordHover(svg, Number(word.dataset.sentence), Number(word.dataset.word));
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

  protected clearHighlightClasses(svg: SVGSVGElement, hoverClass: string, ...classes: string[]): void {
    svg.classList.remove(hoverClass);
    svg.querySelectorAll(classes.map((c) => `.${c}`).join(", ")).forEach((el) => {
      el.classList.remove(...classes);
    });
  }
}
