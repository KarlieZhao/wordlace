import { mkDefs } from "./svgutils";
import { COL_ORDER } from "./words";
import { TokenNode, Edges, GraphState, ColumnHeader } from "./depcomponents";

export const PAD_T = 0;
const PAD_L = 20;
const svgWidth = 700;
const posHeight = 12;
const ROW_H = 70;

export class DependencyGraph {
  constructor(svgId, language = "en", translateCallback) {
    this.state = new GraphState(language);
    this.writer = document.getElementById("writer");
    this.svg = document.getElementById(svgId);
    this.translateCallback = translateCallback;
    this.nodeMap = {};
    this.edgeLayer = null;
    this.header = null;
  }

  /**
   * @param {Array}  tokens    - flat array of all tokens in the chapter,
   *                             each augmented with a `_key` string unique
   *                             across the whole chapter
   * @param {Array}  sentences - original sentence[][] structure for verse spacing
   */
  draw(tokens, sentences = null) {
    this.svg.innerHTML = "";
    this.nodeMap = {};
    const categoryMap = Object.fromEntries(
      COL_ORDER.map((posGroup, i) =>
        posGroup.map((pos) => [pos, i * posHeight]),
      ).flat(),
    );

    this._stampKeys(tokens, sentences);
    const { positions, totalH } = this._buildTokenPositions(
      tokens,
      categoryMap,
    );

    this.svg.setAttribute("viewBox", `0 0 ${svgWidth} ${totalH + 50}`);

    const defs = mkDefs(this.svg);

    // this.header = new ColumnHeader(this.svg, categoryMap, this.state);
    this.edgeLayer = new Edges(this.svg, tokens, positions, this.state, defs);

    const labelGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    labelGroup.setAttribute("class", "label-layer");
    this.svg.appendChild(labelGroup);

    tokens.forEach((t) => {
      const pos = positions[t._key];
      if (!pos) return;
      const node = new TokenNode(this.svg, t, pos, this.state);
      labelGroup.appendChild(node.g);
      this.nodeMap[t._key] = node;
      this.addMouseEvents(node, t);
    });

    this._applyState();
  }

  //  layout helpers
  _stampKeys(tokens, sentences) {
    if (sentences) {
      sentences.forEach((sentence, si) => {
        sentence.forEach((t) => {
          t._key = `${si}_${t.id}`;
        });
      });
    } else {
      tokens.forEach((t, i) => {
        t._key = `0_${i}`;
      });
    }
  }

  _buildTokenPositions(tokens, categoryMap) {
    const positions = {};
    let x = PAD_L + tokens[0].word.length * 2;
    let y = PAD_T;
    let totalH = 0;

    tokens.forEach((t) => {
      if (t._key.split("_")[1] === "0" || x >= svgWidth - PAD_L) {
        y += ROW_H;
        x = PAD_L + t.word.length * 2;
      }
      positions[t._key] = { x, y: y + (categoryMap[t.pos] ?? PAD_L) };
      x += t.word.length * 4 + 10;
      totalH = y;
    });
    return { positions, totalH };
  }

  addMouseEvents(node, token) {
    const { g } = node;
    const { outgoing, incoming } = this.edgeLayer.depGraph;

    g.addEventListener("mouseenter", () => {
      // collect all graph-connected _keys (dep edges, both directions)
      const connected = new Set();

      outgoing[token._key]?.forEach((e) => connected.add(e.targetKey));
      incoming[token._key]?.forEach((e) => connected.add(e.sourceKey));

      // also collect sequential neighbors (prev/next token in order)
      this.edgeLayer.getLines().forEach((el) => {
        if (el.dataset.fromKey === token._key) connected.add(el.dataset.toKey);
        if (el.dataset.toKey === token._key) connected.add(el.dataset.fromKey);
      });

      // update state — hovered is a string _key, never a boolean
      this.state.hoverToken(token._key, token.pos, connected);
      this._applyState();
    });

    g.addEventListener("mouseleave", () => {
      this.state.clearHover();
      this._applyState();
    });

    g.addEventListener("click", () => {
      this.writer.innerHTML += token.word + " ";
      this.state.selectToken(
        token._key,
        outgoing[token._key]?.map((e) => e.targetKey) ?? [],
      );
      this._applyState();
    });
  }

  _applyState() {
    const { state } = this;
    const labelSet = state.labelSet;

    // default
    if (!state.hasSelection && !state.hasHover) {
      Object.values(this.nodeMap).forEach((node) => node.setOpaque());
      this.edgeLayer.getLines().forEach((el) => {
        el.style.opacity = "0.4";
      });
      this.edgeLayer.getPaths().forEach((el) => {
        this.edgeLayer.restoreEdge(el);
        el.style.opacity = "0.6";
      });
      this.edgeLayer.getLabels().forEach((el) => {
        el.textContent = labelSet[el.dataset.dep];
      });
      return;
    }

    const hoveredKey = state.hovered;
    const hoverPos = state.hoverPos;
    const connected = state.connectedKeys;

    //token colors
    Object.entries(this.nodeMap).forEach(([key, node]) => {
      const isSelected = state.selected.includes(key);
      const isHovered = key === hoveredKey;
      const samePos = hoverPos && node.token.pos === hoverPos;
      const isNeighbor = connected.has(key);

      if (isSelected || isHovered) {
        node.setOpaque();
      } else if (samePos || isNeighbor) {
        // same POS and graph neighbors stay full black
        node.setOpaque();
      } else {
        node.setTransparent();
      }

      const isClickable =
        !state.hasSelection || state.selectedChildren.includes(key);
      node.setPointerEvents(isClickable && !isSelected ? "auto" : "none");
    });

    //sequential edges (lines)
    this.edgeLayer.getLines().forEach((el) => {
      const from = el.dataset.fromKey;
      const to = el.dataset.toKey;
      const active =
        from === hoveredKey || to === hoveredKey || from === state.lastSelected;

      el.style.opacity = active ? "0.8" : "0.05";
    });

    //dependency edges (paths)
    this.edgeLayer.getPaths().forEach((el) => {
      const from = el.dataset.fromKey;
      const to = el.dataset.toKey;
      const active =
        from === hoveredKey || to === hoveredKey || from === state.lastSelected;

      if (active) {
        this.edgeLayer.restoreEdge(el);
        el.style.opacity = "1";
      } else {
        el.style.opacity = "0.05";
      }
    });

    //dep labels
    this.edgeLayer.getLabels().forEach((el) => {
      el.textContent = labelSet[el.dataset.dep];
      const from = el.dataset.fromKey;
      const isActive = from === hoveredKey || connected.has(from);
      el.style.opacity = isActive ? "1" : "0";
    });
  }
}
