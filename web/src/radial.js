import { DependencyGraph } from "./weave";
import { mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER } from "./words";
import { TokenNode, Edges } from "./depcomponents";
const POS_RING_GAP = 120;
const INNER_RADIUS = 80;
const LABEL_PAD = 20;

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
      const angle = -Math.PI / 2 + (i / tokens.length) * Math.PI * 2;

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

    const defs = mkDefs(this.svg);
    const pal = this.state.palette;

    mkArrowMarker(defs, "arr-black", pal.BLACK);
    mkArrowMarker(defs, "arr-blue", pal.LIGHT_BLUE);

    this._drawRings(cx, cy, ringMap, pal);

    this.edgeLayer = new Edges(this.svg, tokens, tokenPos, this.state);

    const labelGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );

    labelGroup.setAttribute("class", "label-layer");

    this.svg.appendChild(labelGroup);

    tokens.forEach((t) => {
      const node = new TokenNode(this.svg, t, tokenPos[t._key], this.state);

      this._orientLabel(node);

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

      circle.setAttribute("stroke-width", "0.5");

      this.svg.appendChild(circle);

      const label = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );

      label.textContent = pos;

      label.setAttribute("x", cx);

      label.setAttribute("y", cy - radius - LABEL_PAD);

      label.setAttribute("text-anchor", "middle");

      label.setAttribute("font-size", "10");

      label.setAttribute("fill", pal.LIGHT_GRAY);

      this.svg.appendChild(label);
    });
  }

  _orientLabel(node) {
    const text = node.g.querySelector(".token-label");

    if (!text) return;

    const angleDeg = (node.pos.angle * 180) / Math.PI;

    let rotation = angleDeg + 90;

    if (angleDeg > 90 || angleDeg < -90) {
      rotation += 180;
    }

    text.setAttribute(
      "transform",
      `rotate(${rotation} ${node.pos.x} ${node.pos.y})`,
    );
  }
}
