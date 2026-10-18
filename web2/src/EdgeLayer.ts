import { computeCurve, round1, type DepEdge, type DepRepresentation } from "./basedependency";
import { CURVATURE, CURVE_STEP, DEP_COLORS, MARKER_SIZE, REPRESENTATIONS, type PointGetter } from "./config";
import { labelName } from "./labels";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const key in attrs) el.setAttribute(key, String(attrs[key]));
  return el;
}

export interface EdgeInput {
  edge: DepEdge;
  sentence: number;
  head: number;
  child: number;
}

interface EdgeItem extends EdgeInput {
  path: SVGPathElement;
  // hit: SVGPathElement;
  curveBias: number;
}

export class EdgeLayer {
  private items: EdgeItem[] = [];
  private byToken = new Map<number, number[]>();
  private hot = new Set<number>();
  // private hoverCb: ((edge: number | null) => void) | null = null;

  private readonly root: HTMLElement;
  private readonly pointOf: PointGetter;

  constructor(root: HTMLElement, pointOf: PointGetter) {
    this.root = root;
    this.pointOf = pointOf;
  }

  // onHover(cb: (edge: number | null) => void): void {
  //   this.hoverCb = cb;
  // }

  clear(): void {
    this.root.innerHTML = "";
    this.root.classList.remove("wv-focus");
    this.items = [];
    this.byToken.clear();
    this.hot.clear();
  }

  build(
    inputs: EdgeInput[],
    sentences: number[],
    currentSentence: number,
    size: { width: number; height: number },
  ): void {
    this.clear();

    const svg = svgEl("svg", {
      class: "vector-edges",
      "data-sentence": currentSentence,
      width: size.width,
      height: size.height,
    });

    const defs = svgEl("defs");
    for (const s of sentences) {
      for (const rep of REPRESENTATIONS) {
        defs.appendChild(this.marker(s, rep, "from"));
        defs.appendChild(this.marker(s, rep, "to"));
      }
    }

    const arcs = svgEl("g");
    // const hits = svgEl("g");

    const groups = new Map<string, number[]>();

    inputs.forEach((input, index) => {
      const { head, child } = input.edge;
      const key = `${input.sentence}:${Math.min(head, child)}-${Math.max(head, child)}`;
      const list = groups.get(key);
      if (list) list.push(index);
      else groups.set(key, [index]);
    });

    const curveBias = new Map<number, number>();
    for (const indices of groups.values()) {
      const n = indices.length;
      indices.forEach((idx, rank) => {
        curveBias.set(idx, (rank - (n - 1) / 2) * CURVE_STEP);
      });
    }

    inputs.forEach((input, index) => {
      const { edge, sentence } = input;
      const direction = edge.head - edge.child < 0 ? "from" : "to";

      const path = svgEl("path", {
        class: `wv-dep-arc wv-dep-${edge.representation}`,
        "data-edge": edge.id,
        "data-sentence": sentence,
        "data-head": edge.head,
        "data-child": edge.child,
        "data-relation": edge.relation,
        stroke: DEP_COLORS[`${edge.representation}-${direction}`],
        "marker-end": `url(#wv-arrow-${sentence}-${direction})`,
      });

      // const hit = svgEl("path", { class: "wv-dep-hit", "data-index": index, fill: "none" });

      arcs.appendChild(path);
      // hits.appendChild(hit);
      this.items.push({ ...input, path, curveBias: curveBias.get(index) ?? 0 });

      this.link(input.head, index);
      this.link(input.child, index);
    });

    svg.append(defs, arcs);

    this.root.appendChild(svg);
    this.redraw();
  }

  /* ------------------------------ queries ----------------------------- */

  connectedTokens(): Set<number> {
    return new Set(this.byToken.keys());
  }

  incident(token: number): readonly number[] {
    return this.byToken.get(token) ?? [];
  }

  endpoints(edge: number): [head: number, child: number] {
    const item = this.items[edge];
    return [item.head, item.child];
  }

  /* ----------------------------- rendering ---------------------------- */

  redraw(): void {
    for (const item of this.items) {
      const geo = this.geometry(item.head, item.child, item.curveBias);
      if (!geo) continue;
      item.path.setAttribute("d", geo.d);
      // item.hit.setAttribute("d", geo.d);
    }
  }

  setFocus(edges: ReadonlySet<number> | null): void {
    const next = edges ?? new Set<number>();

    for (const i of this.hot) {
      if (!next.has(i)) this.items[i]?.path.classList.remove("wv-hot");
    }
    for (const i of next) {
      if (!this.hot.has(i)) this.items[i]?.path.classList.add("wv-hot");
    }

    this.hot = new Set(next);
    this.root.classList.toggle("wv-focus", edges !== null);
  }

  relationLabel(edge: number): string {
    const item = this.items[edge];
    return item ? labelName(item.edge.representation, item.edge.relation) : "";
  }

  /* ------------------------------ helpers ----------------------------- */

  private link(token: number, edge: number): void {
    const list = this.byToken.get(token);
    if (list) list.push(edge);
    else this.byToken.set(token, [edge]);
  }

  private geometry(head: number, child: number, curveBias = 0): { d: string; midX: number; midY: number } | null {
    const a = this.pointOf(head);
    const b = this.pointOf(child);
    if (!a || !b) return null;

    let ax, bx, ay, by;
    const pad = 6;
    if (a.px > b.px) {
      ax = a.px - pad;
      bx = b.px + pad;
    } else {
      ax = a.px + pad;
      bx = b.px - pad;
    }

    if (a.py > b.py) {
      ay = a.py - pad;
      by = b.py + pad;
    } else {
      ay = a.py + pad;
      by = b.py - pad;
    }
    const c = computeCurve(ax, ay, bx, by, CURVATURE * (1 + curveBias));
    return {
      d:
        `M ${round1(ax)} ${round1(ay)} ` +
        `C ${round1(c.ctrl1x)} ${round1(c.ctrl1y)}, ${round1(c.ctrl2x)} ${round1(c.ctrl2y)}, ${round1(bx)} ${round1(by)}`,
      // Cubic Bézier at t = 0.5
      midX: (a.px + 3 * c.ctrl1x + 3 * c.ctrl2x + b.px) / 8,
      midY: (a.py + 3 * c.ctrl1y + 3 * c.ctrl2y + b.py) / 8,
    };
  }

  private marker(sentence: number, rep: DepRepresentation, direction: "from" | "to"): SVGMarkerElement {
    const marker = svgEl("marker", {
      id: `wv-arrow-${sentence}-${direction}`,
      viewBox: "0 0 10 10",
      refX: 8,
      refY: 5,
      markerWidth: MARKER_SIZE,
      markerHeight: MARKER_SIZE,
      orient: "auto",
    });
    marker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: DEP_COLORS[`${rep}-${direction}`] }));
    return marker;
  }
}
