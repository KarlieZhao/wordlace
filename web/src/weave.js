import { views } from "./main";
import { drawText, line, mkDefs, mkArrowMarker } from "./svgutils";
import { COL_ORDER, COL_LABELS, normalize } from "./words";

// maybe we don't show the dependcy terms on the graph since it's a bit too rigid
// language A - B - C ...
// automatically translating and shifting towards another languange word by word

// TODO:
// add a button for translation / comparing side by side / overlapping
// make it an animation, with my own writing, about the friction in language and translations
const PAD_B = -100;
const PAD_L = 100;

const ROW_H = 12;
const PAD_T = 0;//-20 * ROW_H;

const colW = 50;

const VERSE_GAP = 5;

const HIDDEN_DEPS = new Set(["punct"]);

const PALETTE_EN = {
  LIGHT_BLUE: "#043f6c",
  BLACK: "#6f5201",
  LIGHT_GRAY: "#b0b0b0",
  RED: "#955151",
};

const PALETTE_ZH = {
  LIGHT_BLUE: "#043f6c",
  BLACK: "#6f5201",
  LIGHT_GRAY: "#b0b0b0",
  RED: "#955151",
};

const DEP_LABELS = {
  nsubj: "nominal subject",
  obj: "direct object",
  iobj: "indirect object",
  csubj: "clausal subject",
  ccomp: "clausal complement",
  xcomp: "open clausal complement",
  obl: "oblique nominal",
  vocative: "vocative",
  expl: "expletive",
  dislocated: "dislocated element",
  advcl: "adverbial clause modifier",
  advmod: "adverbial modifier",
  discourse: "discourse element",
  aux: "auxiliary",
  cop: "copula",
  mark: "marker",
  nmod: "nominal modifier",
  appos: "appositional modifier",
  nummod: "numeric modifier",
  acl: "adjectival clause",
  amod: "adjectival modifier",
  det: "determiner",
  clf: "classifier",
  case: "case marking",
  conj: "conjunct",
  cc: "coordinating conjunction",
  fixed: "fixed multiword expression",
  flat: "flat multiword expression",
  compound: "compound",
  list: "list",
  parataxis: "parataxis",
  orphan: "orphan",
  goeswith: "goes with",
  reparandum: "reparandum",
  punct: "punctuation",
  root: "root of sentence",
  dep: "unspecified dependency",
  relcl: "relative clause modifier",
  prep: "prepositional modifier",
  pobj: "object of preposition",
  poss: "possession modifier",
  attr: "attribute",
  neg: "negation modifier",
  agent: "agent",
  pcomp: "complement of preposition",
  dobj: "direct object",
  nsubjpass: "passive nominal subject",
  auxpass: "passive auxiliary",
  oprd: "object predicate",
  meta: "meta modifier",
  intj: "interjection",
  quantmod: "quantifier modifier",
  predet: "predeterminer",
  preconj: "preconjunct",
  npadvmod: "noun phrase adverbial modifier",
  prt: "particle",
  nn: "noun compound modifier",
  acomp: "adjectival complement",
};

const DEP_LABELS_ZH = {
  nsubj: "主语",
  obj: "直接宾语",
  iobj: "间接宾语",
  csubj: "从句主语",
  ccomp: "从句补语",
  xcomp: "开放式从句补语",
  obl: "状语成分",
  vocative: "称呼语",
  expl: "虚位主语",
  dislocated: "移位成分",
  advcl: "状语从句",
  advmod: "状语修饰",
  discourse: "话语成分",
  aux: "助动词",
  cop: "系动词",
  mark: "标记词",
  nmod: "名词修饰",
  appos: "同位语",
  nummod: "数词修饰",
  acl: "定语从句",
  amod: "形容词修饰",
  det: "限定词",
  clf: "量词",
  case: "格标记",
  conj: "并列项",
  cc: "并列连词",
  fixed: "固定短语",
  flat: "扁平结构",
  compound: "复合词",
  list: "列表",
  parataxis: "并列结构",
  orphan: "孤立成分",
  goeswith: "拼写连写",
  reparandum: "自我修正",
  punct: "标点",
  root: "句子根",
  dep: "未指定依存关系",
  relcl: "关系从句",
  prep: "介词修饰",
  pobj: "介词宾语",
  poss: "所属修饰",
  attr: "属性",
  neg: "否定",
  agent: "施事",
  pcomp: "介词补语",
  dobj: "直接宾语",
  nsubjpass: "被动主语",
  auxpass: "被动助动词",
  oprd: "宾语补足语",
  meta: "元信息",
  intj: "感叹词",
  quantmod: "量词修饰",
  predet: "前限定词",
  preconj: "前并列词",
  npadvmod: "名词短语状语",
  prt: "小品词",
  nn: "名词修饰",
  acomp: "形容词补语",
};

class GraphState {
  constructor(language = "en") {
    this.selected = [];
    this.selectedChildren = [];
    this.hovered = "";
    this.hoveredChildren = [];
    this.language = language;
  }

  get palette() {
    return this.language === "en" ? PALETTE_EN : PALETTE_ZH;
  }

  get labelSet() {
    return this.language === "zh" ? DEP_LABELS_ZH : DEP_LABELS;
  }

  get lastSelected() {
    return this.selected[this.selected.length - 1];
  }

  get hasSelection() {
    return this.selected.length > 0;
  }

  get hasHover() {
    return this.hovered !== "";
  }

  get litIds() {
    return new Set([
      ...this.selected,
      ...this.selectedChildren,
      ...(this.hasHover ? [this.hovered, ...this.hoveredChildren] : []),
    ]);
  }

  selectToken(id, children) {
    this.selected.push(id);
    this.selectedChildren = children;
    this.hovered = "";
    this.hoveredChildren = [];
  }

  hoverToken(id, children) {
    this.hovered = id;
    this.hoveredChildren = children;
  }

  clearHover() {
    this.hovered = "";
    this.hoveredChildren = [];
  }
}

class TokenNode {
  constructor(svg, token, pos, state) {
    this.token = token;
    this.pos = pos;
    this.state = state;
    this.g = this._buildGroup();
    this.textEl = this.g.querySelector(".token-label");
  }

  _buildGroup() {
    const { x, y } = this.pos;
    const t = this.token;
    const pal = this.state.palette;

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "token-node");
    g.setAttribute("class", t.pos.toLowerCase());
    g.setAttribute("data-id", t.id);
    g.style.cursor = "default";

    const textEl = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    textEl.setAttribute("x", x);
    textEl.setAttribute("y", y);
    textEl.setAttribute("text-anchor", "middle");
    textEl.setAttribute("dominant-baseline", "central");
    textEl.setAttribute("font-size", "12");
    textEl.setAttribute("font-weight", "400");
    textEl.setAttribute("fill", pal.BLACK);
    textEl.setAttribute("class", "token-label");
    textEl.textContent = t.word;
    g.appendChild(textEl);

    const normWord = normalize(t.word);
    if (normWord !== t.word.toLowerCase()) {
      const subEl = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      subEl.setAttribute("x", x + 16);
      subEl.setAttribute("y", y);
      subEl.setAttribute("text-anchor", "start");
      subEl.setAttribute("dominant-baseline", "central");
      subEl.setAttribute("font-size", "9");
      subEl.setAttribute("fill", "#aaaaaa");
      subEl.textContent = normWord;
      g.appendChild(subEl);
    }

    const approxH = 26;
    const approxW = t.word.length * 10 + 16;
    const hitRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    hitRect.setAttribute("x", x - approxW / 2);
    hitRect.setAttribute("y", y - approxH / 2);
    hitRect.setAttribute("width", approxW);
    hitRect.setAttribute("height", approxH);
    hitRect.setAttribute("fill", "transparent");
    g.appendChild(hitRect);

    return g;
  }

  setFill(color) {
    this.textEl.setAttribute("fill", color);
  }

  setPointerEvents(value) {
    this.g.style.pointerEvents = value;
  }
}

class Edges {
  constructor(svg, tokens, tokenPos, state) {
    this.svg = svg;
    this.tokens = tokens;
    this.tokenPos = tokenPos;
    this.state = state;
    this.group = this._createGroup();
    this.outgoingEdges = this._drawDepEdges();
  }

  _createGroup() {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "edge-layer");
    this.svg.appendChild(g);
    return g;
  }

  getLines() {
    return this.svg.querySelectorAll(".edge-layer line");
  }

  getLabels() {
    return this.svg.querySelectorAll(".edge-layer text");
  }

  _drawDepEdges() {
    const GAP = 12;
    const pal = this.state.palette;
    const labelSet = this.state.labelSet;
    const outgoing = Object.fromEntries(this.tokens.map((t) => [t._key, []]));

    // Build a map from sentence-local id → _key for head lookups within each sentence.
    // Tokens from different sentences never share edges, so we rebuild per sentence
    // by grouping on the sentence-index prefix of _key.
    const sentenceKeyMap = new Map(); // Map<local_id, _key>
    this.tokens.forEach((t) => {
      const si = t._key.split("_")[0];
      if (!sentenceKeyMap.has(si)) sentenceKeyMap.set(si, new Map());
      sentenceKeyMap.get(si).set(t.id, t._key);
    });

    this.tokens.forEach((tok) => {
      if (HIDDEN_DEPS.has(tok.dep)) return;
      if (tok.head_id === tok.id) return;

      const si = tok._key.split("_")[0];
      const headKey = sentenceKeyMap.get(si)?.get(tok.head_id);
      if (!headKey) return;

      const a = this.tokenPos[tok._key];
      const b = this.tokenPos[headKey];
      if (!a || !b) return;

      const [nx, ny, len] = this._unitVector(a, b);
      if (len < 1) return;

      const isDownward = tok.head_id > tok.id;
      const color = isDownward ? pal.BLACK : pal.LIGHT_BLUE;
      const marker = isDownward ? "url(#arr-black)" : "url(#arr-blue)";

      const lineEl = line(
        this.group,
        a.x + nx * GAP,
        a.y + ny * GAP,
        b.x - nx * (GAP + 6),
        b.y - ny * (GAP + 6),
        color,
        0.8,
        marker,
      );
      lineEl.style.transition = "opacity 0.2s ease";
      lineEl.dataset.fromKey = tok._key;
      lineEl.dataset.toKey = headKey;
      lineEl.dataset.immediate = isDownward ? "1" : "0";
      lineEl.dataset.dep = tok.dep;
      lineEl.style.cursor = "pointer";

      if (views.showDeps || views.showDepsLocked) {
        const midX = (a.x + nx * GAP + b.x - nx * (GAP + 6)) / 2;
        const midY = (a.y + ny * GAP + b.y - ny * (GAP + 6)) / 2;

        const { text } = drawText(
          this.group,
          null,
          midX,
          midY - 5,
          labelSet[tok.dep],
          9,
          400,
          pal.LIGHT_GRAY,
          "middle",
          "IBM Plex Mono",
          "dep-labels",
        );
        text.dataset.fromKey = tok._key;
        text.dataset.dep = tok.dep;
      }

      outgoing[tok._key].push({ lineEl, targetKey: headKey });
    });

    return outgoing;
  }

  _unitVector(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    return [dx / len, dy / len, len];
  }

  dimAll() {
    this.getLines().forEach((el) => (el.style.opacity = "0.08"));
  }

  restoreEdge(el) {
    const isImmediate = el.dataset.immediate === "1";
    const pal = this.state.palette;
    el.setAttribute("stroke", isImmediate ? pal.BLACK : "#7bafd4");
    el.setAttribute(
      "marker-end",
      isImmediate ? "url(#arr-black)" : "url(#arr-blue)",
    );
    el.style.opacity = "1.0";
  }
}

class ColumnHeader {
  constructor(svg, colX, state) {
    this.svg = svg;
    this.colX = colX;
    this.state = state;
    this.group = this._buildGroup();
    this.hitRect = this._buildHitRect();
  }

  _buildGroup() {
    const pal = this.state.palette;
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("pointer-events", "none");

    COL_ORDER.forEach((p) => {
      if (p !== "PUNCT") {
        drawText(
          g,
          `rowheader-${p}`,
          this.colX[p],
          PAD_T - 20,
          COL_LABELS[p] || p,
          11,
          400,
          pal.LIGHT_GRAY,
          "middle",
          "IBM Plex Mono",
        );
      }
    });

    this.svg.appendChild(g);
    return g;
  }

  _buildHitRect() {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("fill", "transparent");

    requestAnimationFrame(() => {
      const pad = { x: 12, y: 8 };
      const bbox = this.group.getBBox();
      rect.setAttribute("x", bbox.x - pad.x);
      rect.setAttribute("y", bbox.y - pad.y);
      rect.setAttribute("width", bbox.width + pad.x * 2);
      rect.setAttribute("height", bbox.height + pad.y * 2);
    });

    this.svg.appendChild(rect);
    return rect;
  }

  dimAll() {
    const pal = this.state.palette;
    this.group
      .querySelectorAll("text")
      .forEach((el) => el.setAttribute("fill", pal.LIGHT_GRAY));
  }

  highlight(posTag) {
    this.dimAll();
    const pal = this.state.palette;
    const el = this.group.querySelector(`#rowheader-${posTag}`);
    if (el) el.setAttribute("fill", pal.BLACK);
  }
}

// draw a horizontal line between verses/chapters
class VerseDivider {
  constructor(svg, x1, x2, y, color) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
    el.setAttribute("x1", x1);
    el.setAttribute("y1", y);
    el.setAttribute("x2", x2);
    el.setAttribute("y2", y);
    el.setAttribute("stroke", color);
    el.setAttribute("stroke-width", "0.5");
    el.setAttribute("stroke-opacity", "0.7");
    svg.appendChild(el);
  }
}

export class DependencyGraph {
  constructor(language = "en") {
    this.state = new GraphState(language);
    this.writer = document.getElementById("writer");
    this.svg = document.getElementById("svg");
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

    const W = this.svg.clientWidth * 1.1 || 800;
    const colX = Object.fromEntries(
      COL_ORDER.map((p, i) => [p, PAD_L + i * colW]),
    );

    // stamp every token with a key: chapter#_verse#
    this._stampKeys(tokens, sentences);
    const verseStartKeys = this._buildVerseStartKeys(sentences);

    const tokenPos = this._buildTokenPositions(tokens, colX, verseStartKeys);
    const totalH = this._totalHeight(tokens, verseStartKeys);

    this.svg.setAttribute("viewBox", `0 0 ${W} ${totalH}`);
    this.svg.style.height = totalH + "px";

    const defs = mkDefs(this.svg);
    const pal = this.state.palette;
    mkArrowMarker(defs, "arr-black", pal.BLACK);
    mkArrowMarker(defs, "arr-blue", pal.LIGHT_BLUE);

    this.header = new ColumnHeader(this.svg, colX, this.state);
    this.edgeLayer = new Edges(this.svg, tokens, tokenPos, this.state);

    if (sentences && sentences.length > 1) {
      this._drawVerseDividers(sentences, tokenPos, W, pal);
    }

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

  _buildTokenPositions(tokens, colX, verseStartKeys) {
    const positions = {};
    let y = PAD_T;

    tokens.forEach((t) => {
      if (verseStartKeys.has(t._key)) y += VERSE_GAP;
      positions[t._key] = { x: colX[t.pos] ?? PAD_L, y };
      y += ROW_H;
    });

    return positions;
  }

  _totalHeight(tokens, verseStartKeys) {
    let h = PAD_T + PAD_B;
    tokens.forEach((t) => {
      if (verseStartKeys.has(t._key)) h += VERSE_GAP;
      h += ROW_H;
    });
    return Math.max(h, 300);
  }

  _drawVerseDividers(sentences, tokenPos, W, pal) {
    sentences.slice(1).forEach((sentence) => {
      if (!sentence.length) return;
      const pos = tokenPos[sentence[0]._key];
      if (!pos) return;
      new VerseDivider(
        this.svg,
        PAD_L - 20,
        colW * (Object.keys(COL_ORDER).length + 1),
        pos.y - VERSE_GAP - ROW_H,
        pal.LIGHT_GRAY,
      );
    });
  }

  // event handlers
  _attachTokenEvents(node, token) {
    const { g } = node;
    const outgoing = this.edgeLayer.outgoingEdges;

    g.addEventListener("mouseenter", () => {
      this.state.hoverToken(
        token._key,
        outgoing[token._key].map((e) => e.targetKey),
      );
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
