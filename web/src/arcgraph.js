const SVG_NS = "http://www.w3.org/2000/svg";

const PAD_X = 200;
const BASELINE_Y = 500;

const WORD_GAP = 40;
const MIN_ARC_H = 30;
const ARC_SCALE = 18;

export class ArcDependencyGraph {
  constructor(svgId) {
    this.svg = document.getElementById(svgId);
  }

  draw(tokens, sentences = null) {
    this.svg.innerHTML = "";
    const positions = this._layout(tokens);
    const width = PAD_X * 2 + (tokens.length - 1) * WORD_GAP;
    const maxSpan = Math.max(
      ...tokens.map((t) => Math.abs(t.id - t.head_id)),
      1,
    );

    const height = BASELINE_Y + MIN_ARC_H + maxSpan * ARC_SCALE + 100;

    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    this.svg.style.height = `${height}px`;

    const edgeLayer = this._makeGroup("edges");
    const textLayer = this._makeGroup("words");

    this.svg.appendChild(edgeLayer);
    this.svg.appendChild(textLayer);

    this._drawEdges(tokens, positions, edgeLayer);
    this._drawWords(tokens, positions, textLayer);
  }

  _layout(tokens) {
    const positions = {};
    console.log(tokens);
    tokens.forEach((token, i) => {
      positions[token.id] = {
        x: (i - tokens.length / 4) * WORD_GAP + PAD_X,
        y: BASELINE_Y,
      };
    });
    return positions;
  }

  _drawWords(tokens, positions, layer) {
    tokens.forEach((token) => {
      const pos = positions[token.id];

      const g = document.createElementNS(SVG_NS, "g");

      const text = document.createElementNS(SVG_NS, "text");

      text.setAttribute("x", pos.x);
      text.setAttribute("y", pos.y);

      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");

      text.setAttribute("font-size", "14");
      text.setAttribute("font-family", "serif");

      text.textContent = token.word;

      g.appendChild(text);
      layer.appendChild(g);
    });
  }

_drawEdges(tokens, positions, layer) {
  tokens.forEach((token) => {
    if (
      token.dep === "ROOT" ||
      token.head_id === token.id
    ) {
      return;
    }

    const source = positions[token.id];
    const target = positions[token.head_id];

    if (!source || !target) return;

    const left = source.x < target.x ? source : target;
    const right = source.x < target.x ? target : source;

    const dist = Math.abs(token.id - token.head_id);

    const h = 15 + dist * 12;
    const shoulder = 12;

    const y = BASELINE_Y;

    const path = document.createElementNS(
      SVG_NS,
      "path",
    );

    const d = [
      `M ${left.x} ${y}`,
      `L ${left.x + shoulder} ${y - h}`,
      `L ${right.x - shoulder} ${y - h}`,
      `L ${right.x} ${y}`,
    ].join(" ");

    path.setAttribute("d", d);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#3b82f6");
    path.setAttribute("stroke-width", "2");

    layer.appendChild(path);
  });
}
  _makeGroup(className) {
    const g = document.createElementNS(SVG_NS, "g");

    g.setAttribute("class", className);

    return g;
  }
}
