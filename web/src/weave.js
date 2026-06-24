import { mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER } from "./words";
import {
  TokenNode,
  Edges,
  GraphState,
  ColumnHeader,
  VerseDivider,
} from "./depcomponents";
import { views } from "./main";
// maybe we don't show the dependcy terms on the graph since it's a bit too rigid
// language A - B - C ...
// automatically translating and shifting towards another languange word by word

// TODO:
// make it an animation, with my own writing, about the friction in language and translations

const PAD_B = -100;
const PAD_L = 10;

const colW = 10;
const ROW_H = 80;
export const PAD_T = 50; //-20 * ROW_H;
const VERSE_GAP = 5;

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
   *                             each augmented with a `_key` string that is
   *                             unique across the whole chapter
   * @param {Array}  sentences - original sentence[][] structure for verse spacing
   */
  draw(tokens, sentences = null) {
    this.svg.innerHTML = "";
    this.nodeMap = {};
    const colX = Object.fromEntries(COL_ORDER.map((p, i) => [p, i * colW]));

    // stamp every token with a key: chapter#_verse#
    this._stampKeys(tokens, sentences);
    const verseStartKeys = this._buildVerseStartKeys(sentences);
    const longestSentence = sentences.reduce((longest, current) => {
      return current.length > longest.length ? current : longest;
    }, []);

    const maxWords = Math.min(longestSentence.length, 40);

    const totalW = this.svg.clientWidth ?? 1200;
    const totalH = this._totalHeight(tokens, verseStartKeys);
    this.svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
    this.svg.style.width = totalW;
    this.svg.style.height = totalH;

    const tokenPos = this._buildTokenPositions(
      tokens,
      colX,
      (totalW - PAD_L * 2) / maxWords,
      verseStartKeys,
    );

    const defs = mkDefs(this.svg);
    const pal = this.state.palette;
    // mkArrowMarker(defs, "arr-black", pal.BLACK);
    // mkArrowMarker(defs, "arr-blue", pal.LIGHT_BLUE);

    this.header = new ColumnHeader(this.svg, colX, this.state);
    this.edgeLayer = new Edges(this.svg, tokens, tokenPos, this.state, defs);

    // if (sentences && sentences.length > 1) {
    //   this._drawVerseDividers(sentences, tokenPos, W, pal);
    // }

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

  // layout helpers
  /**
   * Stamp every token with a chapter-unique `_key` of the form `"si_ti"`
   * (sentence index + token id). Mutates in place — safe because these are
   * transient render objects, not the stored data.
   */
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
      if (sentence.length) keys.add(sentence[0]._key);
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
        // x += VERSE_GAP;
      }
      positions[t._key] = { x, y: y + colX[t.pos] ?? PAD_L };
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

  // _drawVerseDividers(sentences, tokenPos, W, pal) {
  //   sentences.slice(1).forEach((sentence) => {
  //     if (!sentence.length) return;
  //     const pos = tokenPos[sentence[0]._key];
  //     if (!pos) return;
  //     new VerseDivider(
  //       this.svg,
  //       PAD_L - 20,
  //       colW * (Object.keys(COL_ORDER).length + 1),
  //       pos.y - VERSE_GAP - ROW_H,
  //       pal.LIGHT_GRAY,
  //     );
  //   });
  // }

  // event handlers
  _attachTokenEvents(node, token) {
    const { g } = node;
    const outgoing = this.edgeLayer.depEdges;
    // const sequntialEdges = this.edgeLayer.sequentialEdges;

    // g.addEventListener("mouseenter", () => {
    //   this.state.hoverToken(
    //     token._key,
    //     outgoing[token._key].map((e) => e.targetKey),
    //   );
    //   if (this.translateCallback) this.translateCallback(token.word);
    //   this._applyState();
    // });

    // g.addEventListener("mouseleave", () => {
    //   this.state.clearHover();
    //   this._applyState();
    // });

    g.addEventListener("click", () => {
      this.writer.innerHTML += token.word + " ";
      this.state.selectToken(
        token._key,
        outgoing[token._key].map((e) => e.targetKey),
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
      const pal = this.state.palette;
      Object.values(this.nodeMap).forEach((node) => {
        node.setFill(node.token.pos === nearestPos ? pal.BLACK : "#ccc");
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
    const pal = state.palette;
    const labelSet = state.labelSet;

    if (!state.hasSelection && !state.hasHover) {
      Object.values(this.nodeMap).forEach((node) => node.setFill(pal.BLACK));
      this.edgeLayer.getLines().forEach((el) => this.edgeLayer.restoreEdge(el));
      this.edgeLayer.getLabels().forEach((el) => {
        el.textContent = labelSet[el.dataset.dep];
      });
      return;
    }

    const litIds = state.litIds;

    Object.entries(this.nodeMap).forEach(([key, node]) => {
      const isSelected = state.selected.includes(key);
      const isClickable =
        !state.hasSelection || state.selectedChildren.includes(key);
      node.setFill(
        isSelected ? pal.RED : litIds.has(key) ? pal.BLACK : pal.LIGHT_GRAY,
      );
      node.setPointerEvents(isClickable && !isSelected ? "auto" : "none");
    });

    this.edgeLayer.getLines().forEach((el) => {
      const fromKey = el.dataset.fromKey;
      const fromLastSelected =
        state.hasSelection && fromKey === state.lastSelected;
      const fromHovered = state.hasHover && fromKey === state.hovered;

      if (fromLastSelected) {
        el.style.opacity = "1";
        this.edgeLayer.restoreEdge(el);
      } else if (fromHovered) {
        el.style.opacity = "0.5";
        this.edgeLayer.restoreEdge(el);
      } else {
        el.style.opacity = "0.08";
      }
    });

    this.edgeLayer.getLabels().forEach((el) => {
      el.textContent = labelSet[el.dataset.dep];
    });
  }
}
