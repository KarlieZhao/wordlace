import { mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER } from "./words";
import { TokenNode, Edges, GraphState, ColumnHeader } from "./depcomponents";
import { views } from "./main";
import { PALETTE } from "./palette";

const PAD_B = -100;
const PAD_L = 10;

const colW = 10;
const ROW_H = 110;
export const PAD_T = 50;
const MAX_WORDS_PER_LINE = 50;

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
    const colX = Object.fromEntries(COL_ORDER.map((p, i) => [p, i * colW]));

    this._stampKeys(tokens, sentences);
    const verseStartKeys = this._buildVerseStartKeys(sentences);
    const longestSentence = sentences
      ? sentences.reduce(
          (longest, current) =>
            current.length > longest.length ? current : longest,
          [],
        )
      : tokens;

    const svgWidth = 1000;
    const totalH = this._totalHeight(tokens, verseStartKeys);

    this.svg.setAttribute("viewBox", `0 0 ${svgWidth} ${totalH}`);
    this.svg.style.width = "100%";
    this.svg.style.height = "auto";

    const tokenPos = this._buildTokenPositions(
      tokens,
      colX,
      (svgWidth - PAD_L * 2) /
        Math.min(MAX_WORDS_PER_LINE, longestSentence.length),
      verseStartKeys,
    );

    const defs = mkDefs(this.svg);

    this.header = new ColumnHeader(this.svg, colX, this.state);
    this.edgeLayer = new Edges(this.svg, tokens, tokenPos, this.state, defs);

    const labelGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    labelGroup.setAttribute("class", "label-layer");
    this.svg.appendChild(labelGroup);

    tokens.forEach((t) => {
      const pos = tokenPos[t._key];
      if (!pos) return;
      const node = new TokenNode(this.svg, t, pos, this.state);
      labelGroup.appendChild(node.g);
      this.nodeMap[t._key] = node;
      this._attachTokenEvents(node, t);
    });

    this._attachHeaderEvents(tokens, colX);
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

  _buildVerseStartKeys(sentences) {
    const keys = new Set();
    if (!sentences) return keys;
    sentences.slice(1).forEach((sentence) => {
      if (!sentence.length) return;
      keys.add(sentence[0]._key);

      if (sentence.length > MAX_WORDS_PER_LINE) {
        let splitIndex = -1;
        for (
          let i = Math.min(MAX_WORDS_PER_LINE - 1, sentence.length - 1);
          i >= 0;
          i--
        ) {
          if (sentence[i].pos === "PUNCT") {
            splitIndex = i;
            break;
          }
        }
        if (splitIndex !== -1 && splitIndex + 1 < sentence.length) {
          keys.add(sentence[splitIndex + 1]._key);
        }
      }
    });
    return keys;
  }

  _buildTokenPositions(tokens, colX, spacing, verseStartKeys) {
    const positions = {};
    let x = PAD_T;
    let y = PAD_T;
    tokens.forEach((t) => {
      if (verseStartKeys.has(t._key)) {
        y += ROW_H;
        x = PAD_T;
      }
      positions[t._key] = { x, y: y + (colX[t.pos] ?? PAD_L) };
      x += spacing;
    });
    return positions;
  }

  _totalHeight(tokens, verseStartKeys) {
    let h = PAD_T + PAD_B;
    tokens.forEach((t) => {
      if (verseStartKeys.has(t._key)) {
        h += ROW_H * 1.6;
      }
    });
    return Math.max(h, 400);
  }

  // event handlers

  _attachTokenEvents(node, token) {
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

  _attachHeaderEvents(tokens, colX) {
    const { hitRect } = this.header;

    hitRect.addEventListener("mousemove", (e) => {
      const mouseX = e.clientX - this.svg.getBoundingClientRect().left;
      const nearestPos = COL_ORDER.reduce((best, col) =>
        Math.abs(colX[col] - mouseX) < Math.abs(colX[best] - mouseX)
          ? col
          : best,
      );
      this.header.highlight(nearestPos);

      Object.values(this.nodeMap).forEach((node) => {
        if (node.token.pos === nearestPos) {
          node.setOpaque();
        } else {
          node.setTransparent();
        }
      });
      this.edgeLayer.dimAll();
    });

    hitRect.addEventListener("mouseleave", () => {
      this.header.dimAll();
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
