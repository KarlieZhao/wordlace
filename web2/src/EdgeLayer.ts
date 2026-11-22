import { computeCurve, round1, type DepEdge } from "./basedependency";
import { CURVATURE, CURVE_STEP, DEP_COLORS, MARKER_SIZE, type PointGetter } from "./config";
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
  curveBias: number;
}

export class EdgeLayer {
  private items: EdgeItem[] = [];
  private byToken = new Map<number, number[]>();
  private hot = new Set<number>();

  private readonly root: HTMLElement;
  private readonly pointOf: PointGetter;

  constructor(root: HTMLElement, pointOf: PointGetter) {
    this.root = root;
    this.pointOf = pointOf;
  }

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

    defs.appendChild(this.marker("from"));
    defs.appendChild(this.marker("to"));
    defs.appendChild(this.marker("neutral"));

    const arcs = svgEl("g");
    const groups = new Map<string, number[]>();

    inputs.forEach((input, index) => {
      const key =
        `${input.sentence}:` + `${Math.min(input.head, input.child)}-` + `${Math.max(input.head, input.child)}`;

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
      const { edge, sentence, head, child } = input;

      const path = svgEl("path", {
        class: `wv-dep-arc wv-dep-${edge.representation}`,
        "data-edge": edge.id,
        "data-sentence": sentence,
        "data-head": head,
        "data-child": child,
        "data-relation": edge.relation,
        stroke: DEP_COLORS[`${edge.representation}-neutral`],
        "marker-end": `url(#wv-arrow-neural)`,
      });

      arcs.appendChild(path);

      this.items.push({
        ...input,
        path,
        curveBias: curveBias.get(index) ?? 0,
      });

      this.link(head, index);
      this.link(child, index);
    });

    svg.append(defs, arcs);
    this.root.appendChild(svg);
    this.redraw();
  }

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

  redraw(): void {
    for (const item of this.items) {
      const geo = this.geometry(item.head, item.child, item.curveBias);

      if (!geo) continue;

      item.path.setAttribute("d", geo.d);
    }
  }

  setFocus(edges: ReadonlySet<number> | null): void {
    const next = edges ?? new Set<number>();

    for (const i of this.hot) {
      if (!next.has(i)) {
        this.items[i]?.path.classList.remove("wv-hot");
      }
    }

    for (const i of next) {
      if (!this.hot.has(i)) {
        this.items[i]?.path.classList.add("wv-hot");
      }
    }

    this.hot = new Set(next);
    this.root.classList.toggle("wv-focus", edges !== null);
  }

  relationLabel(edge: number): string {
    const item = this.items[edge];

    return item ? labelName(item.edge.representation, item.edge.relation) : "";
  }

  setColors(focusedWordIndex: number | null): void {
    if (focusedWordIndex === null) {
      this.items.forEach((item) => {
        item.path.setAttribute("stroke", DEP_COLORS[`${item.edge.representation}-neutral`]);

        item.path.setAttribute("marker-end", `url(#wv-arrow-neutral)`);
      });

      return;
    }

    this.hot.forEach((edgeIndex) => {
      const { head, edge, path } = this.items[edgeIndex];

      const direction = head === focusedWordIndex ? "to" : "from";

      path.setAttribute("stroke", DEP_COLORS[`${edge.representation}-${direction}`]);

      path.setAttribute("marker-end", `url(#wv-arrow-${direction})`);
    });
  }

  private link(token: number, edge: number): void {
    const list = this.byToken.get(token);

    if (list) list.push(edge);
    else this.byToken.set(token, [edge]);
  }

  private geometry(head: number, child: number, curveBias = 0): { d: string; midX: number; midY: number } | null {
    const a = this.pointOf(head);
    const b = this.pointOf(child);

    if (!a || !b) return null;

    let ax: number;
    let bx: number;
    let ay: number;
    let by: number;

    const padStart = 10;
    const padEnd = 10;

    if (a.px > b.px) {
      ax = a.px - padStart;
      bx = b.px + padEnd;
    } else {
      ax = a.px + padStart;
      bx = b.px - padEnd;
    }

    if (a.py > b.py) {
      ay = a.py - padStart;
      by = b.py + padEnd;
    } else {
      ay = a.py + padStart;
      by = b.py - padEnd;
    }

    const c = computeCurve(ax, ay, bx, by, CURVATURE * (1 + curveBias));

    return {
      d:
        `M ${round1(ax)} ${round1(ay)} ` +
        `C ${round1(c.ctrl1x)} ${round1(c.ctrl1y)}, ` +
        `${round1(c.ctrl2x)} ${round1(c.ctrl2y)}, ` +
        `${round1(bx)} ${round1(by)}`,
      midX: (a.px + 3 * c.ctrl1x + 3 * c.ctrl2x + b.px) / 8,
      midY: (a.py + 3 * c.ctrl1y + 3 * c.ctrl2y + b.py) / 8,
    };
  }

  private marker(direction: "from" | "to" | "neutral"): SVGMarkerElement {
    const marker = svgEl("marker", {
      id: `wv-arrow-${direction}`,
      viewBox: "0 0 10 10",
      refX: 10,
      refY: 5,
      markerWidth: MARKER_SIZE,
      markerHeight: MARKER_SIZE,
      orient: "auto",
    });

    marker.appendChild(
      svgEl("path", {
        d: "M 0 0 L 10 5 L 0 10 z",
        fill: DEP_COLORS[`dm-${direction}`],
      }),
    );

    return marker;
  }
}
