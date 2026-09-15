import { escapeXml, POS_COLOR_MAP } from "../utils";

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

export abstract class BaseDependencyRenderer {
  protected readonly svgClass: string = "dependency-svg";
  container: HTMLDivElement | null;

  constructor(containerSelector: string = "#en-visualizer") {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      throw new Error(`${containerSelector} container not found`);
    }
  }

  protected static computeCurve(
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
