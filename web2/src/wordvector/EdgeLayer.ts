import { computeCurve, round1, type DepEdge, type DepRepresentation } from "./basedependency";
import { CURVATURE, DEP_COLORS, LABEL_LINE_HEIGHT, MARKER_SIZE, REPRESENTATIONS, type PointGetter } from "./config";
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
  /** Global token indices. */
  head: number;
  child: number;
}

interface EdgeItem extends EdgeInput {
  path: SVGPathElement;
  hit: SVGPathElement;
}

interface LabelItem {
  edge: number;
  el: SVGTextElement;
  /** Vertical offset so labels sharing a midpoint don't overlap. */
  dy: number;
}

/**
 * Owns the dependency SVG. Edges are addressed by their index in the list passed
 * to build(). During simulation only `redraw()` runs: it updates `d` on cached
 * elements and repositions any visible labels, with no DOM queries.
 */
export class EdgeLayer {
  private items: EdgeItem[] = [];
  private byToken = new Map<number, number[]>();
  private labelLayer: SVGGElement | null = null;
  private labels: LabelItem[] = [];
  private hot = new Set<number>();
  private hoverCb: ((edge: number | null) => void) | null = null;

  private readonly root: HTMLElement;
  private readonly pointOf: PointGetter;

  constructor(root: HTMLElement, pointOf: PointGetter) {
    this.root = root;
    this.pointOf = pointOf;
  }

  onHover(cb: (edge: number | null) => void): void {
    this.hoverCb = cb;
  }

  clear(): void {
    this.root.innerHTML = "";
    this.root.classList.remove("wv-focus");
    this.items = [];
    this.byToken.clear();
    this.labels = [];
    this.labelLayer = null;
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
      height: 400//size.height, <= TODO: change here
    });

    const defs = svgEl("defs");
    for (const s of sentences) {
      for (const rep of REPRESENTATIONS) defs.appendChild(this.marker(s, rep));
    }

    const arcs = svgEl("g");
    const hits = svgEl("g");
    const labelLayer = svgEl("g", { class: "wv-labels" });

    inputs.forEach((input, index) => {
      const { edge, sentence } = input;

      const path = svgEl("path", {
        class: `wv-dep-arc wv-dep-${edge.representation}`,
        "data-edge": edge.id,
        "data-sentence": sentence,
        "data-head": edge.head,
        "data-child": edge.child,
        "data-relation": edge.relation,
        stroke: DEP_COLORS[edge.representation],
        "stroke-width": 2.5,
        fill: "none",
        "marker-end": `url(#wv-arrow-${sentence}-${edge.representation})`,
      });

      // Wide invisible twin so thin arcs are easy to hover.
      const hit = svgEl("path", { class: "wv-dep-hit", "data-index": index, fill: "none" });

      arcs.appendChild(path);
      hits.appendChild(hit);
      this.items.push({ ...input, path, hit });

      this.link(input.head, index);
      this.link(input.child, index);
    });

    svg.append(defs, arcs, hits, labelLayer);
    this.labelLayer = labelLayer;

    svg.addEventListener("mouseover", (e) => {
      const hit = (e.target as Element | null)?.closest<SVGElement>(".wv-dep-hit");
      if (hit) this.hoverCb?.(Number(hit.dataset.index));
    });
    svg.addEventListener("mouseout", (e) => {
      const to = (e.relatedTarget as Element | null)?.closest?.(".wv-dep-hit");
      if (to) return;
      this.hoverCb?.(null);
    });

    this.root.appendChild(svg);
    this.redraw();
  }

  /* ------------------------------ queries ----------------------------- */

  /** Tokens touched by at least one visible edge. */
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

  /** Called on every force tick. */
  redraw(): void {
    for (const item of this.items) {
      const geo = this.geometry(item.head, item.child);
      if (!geo) continue;
      item.path.setAttribute("d", geo.d);
      item.hit.setAttribute("d", geo.d);
    }
    // this.positionLabels();
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

  /** Shows one label per edge, e.g. "dm: ARG1", at the edge's midpoint. */
  showLabels(edges: Iterable<number>): void {
    this.hideLabels();
    // if (!this.labelLayer) return;

    // const list = [...edges].filter((i) => this.items[i]);

    // // Edges between the same pair (dm/pas/psd) share a midpoint: stack their labels.
    // const pairKey = (i: number) => {
    //   const { head, child } = this.items[i];
    //   return head < child ? `${head}:${child}` : `${child}:${head}`;
    // };
    // const totals = new Map<string, number>();
    // for (const i of list) totals.set(pairKey(i), (totals.get(pairKey(i)) ?? 0) + 1);

    // const seen = new Map<string, number>();
    // for (const i of list) {
    //   const key = pairKey(i);
    //   const slot = seen.get(key) ?? 0;
    //   seen.set(key, slot + 1);

    //   const { edge } = this.items[i];
    //   const el = svgEl("text", {
    //     class: `wv-dep-label wv-label-${edge.representation}`,
    //     "text-anchor": "middle",
    //   });

    //   el.textContent = labelName(edge.representation, edge.relation);
    //   //  `${edge.representation}: ${edge.relation}`;
    //   this.labelLayer.appendChild(el);

    //   this.labels.push({ edge: i, el, dy: (slot - (totals.get(key)! - 1) / 2) * LABEL_LINE_HEIGHT });
    // }

    // this.positionLabels();
  }

  hideLabels(): void {
    this.labelLayer?.replaceChildren();
    this.labels = [];
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

  // private positionLabels(): void {
  //   for (const { edge, el, dy } of this.labels) {
  //     const { head, child } = this.items[edge];
  //     const geo = this.geometry(head, child);
  //     if (!geo) continue;
  //     el.setAttribute("x", String(round1(geo.midX)));
  //     el.setAttribute("y", String(round1(geo.midY + dy - 6)));
  //   }
  // }

  private geometry(head: number, child: number): { d: string; midX: number; midY: number } | null {
    const a = this.pointOf(head);
    const b = this.pointOf(child);
    if (!a || !b) return null;

    const c = computeCurve(a.px, a.py, b.px, b.py, CURVATURE);

    return {
      d:
        `M ${round1(a.px)} ${round1(a.py)} ` +
        `C ${round1(c.ctrl1x)} ${round1(c.ctrl1y)}, ${round1(c.ctrl2x)} ${round1(c.ctrl2y)}, ${round1(b.px)} ${round1(b.py)}`,
      // Cubic Bézier at t = 0.5
      midX: (a.px + 3 * c.ctrl1x + 3 * c.ctrl2x + b.px) / 8,
      midY: (a.py + 3 * c.ctrl1y + 3 * c.ctrl2y + b.py) / 8,
    };
  }

  private marker(sentence: number, rep: DepRepresentation): SVGMarkerElement {
    const marker = svgEl("marker", {
      id: `wv-arrow-${sentence}-${rep}`,
      viewBox: "0 0 10 10",
      refX: 8,
      refY: 5,
      markerWidth: MARKER_SIZE,
      markerHeight: MARKER_SIZE,
      orient: "auto",
    });
    marker.appendChild(svgEl("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: DEP_COLORS[rep] }));
    return marker;
  }
}
