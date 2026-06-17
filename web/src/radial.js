import { mkArrowMarker, mkDefs } from "./svgutils";
import { DependencyGraph } from "./weave";
// import { COL_ORDER } from "./words";
import { TokenNode, Edges } from "./depcomponents";
const POS_RING_GAP = 25;
const INNER_RADIUS = 10;
const COL_ORDER = [
  "PUNCT",
  "X",
  "SCONJ",
  "DET",
  "AUX",
  "ADV",
  "VERB",
  "PART",
  "CCONJ",
  "ADP",

  "ADJ",
  "NOUN",
  "PRON",

  "PROPN",
];
export class RadialDepGraph extends DependencyGraph {
  draw(tokens, sentences = null) {
    this.svg.innerHTML = "";
    this.nodeMap = {};

    this._stampKeys(tokens, sentences);

    const ringMap = Object.fromEntries(
      COL_ORDER.map((pos, i) => [pos, INNER_RADIUS + i * POS_RING_GAP]),
    );

    const maxRadius = INNER_RADIUS + (COL_ORDER.length - 1) * POS_RING_GAP;

    const size = maxRadius * 2 + 300;
    const cx = size / 2;
    const cy = size / 2;

    const tokenPos = {};

    tokens.forEach((token, i) => {
      const angle = -Math.PI / 2 + (i / (tokens.length * 1.3)) * Math.PI * 2;

      const radius = ringMap[token.pos] ?? maxRadius;

      tokenPos[token._key] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle,
        radius,
      };
    });

    this.svg.setAttribute("viewBox", `0 0 ${size} ${size}`);

    this.svg.style.height = `${size}px`;

    const pal = this.state.palette;

    const defs = mkDefs(this.svg);
    mkArrowMarker(defs, "arr-black", pal.BLACK);
    mkArrowMarker(defs, "arr-blue", pal.LIGHT_BLUE);

    // this._drawRings(cx, cy, ringMap, pal);

    this.edgeLayer = new Edges(this.svg, tokens, tokenPos, this.state);

    const labelGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );

    labelGroup.setAttribute("class", "label-layer");

    this.svg.appendChild(labelGroup);

    tokens.forEach((t) => {
      const node = new TokenNode(this.svg, t, tokenPos[t._key], this.state);
      labelGroup.appendChild(node.g);
      this.nodeMap[t._key] = node;
      this._attachTokenEvents(node, t);
    });

    this._applyState();
  }

  _drawRings(cx, cy, ringMap, pal) {
    Object.entries(ringMap).forEach(([pos, radius]) => {
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );

      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", radius);

      circle.setAttribute("fill", "none");

      circle.setAttribute("stroke", pal.LIGHT_GRAY);

      circle.setAttribute("stroke-width", "0.3");

      this.svg.appendChild(circle);

      const label = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );

      label.textContent = pos;
      label.setAttribute("x", cx);
      label.setAttribute("y", cy - radius);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("font-size", "9");
      label.setAttribute("fill", pal.LIGHT_GRAY);
      this.svg.appendChild(label);
    });
  }
}
