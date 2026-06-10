// The Brain--is wider than the Sky--
//  For--put them side by side--
//  The one the other will contain
//  Wit  is deeper tha  o Blue--
//  The one ti  bsorb--
//  As Sp  s--Buckets--do--
//  The Brain is just   weight of God--
//  For--Heft them--Po  und for Pound--
//  And they will   differ--if they do--
//  As Syllable from Sound--

// TODO:
// the traces and shapes matter a lot: word flow and choices
// 1. performance issues (long sentences)
// 2. explore word positions: part of speech, word vector? (2d coordinates)
// 3. try a chinese version => chinese tokenizer | part of speech detector or smth
// 4. explore n-gram model for better outcome?
// 5. fix issues with the current POS_TRANSITIONS

import "./style.css";
import { DependencyGraph } from "./weave";
import { drawLinear } from "./braid";

class Views {
  constructor() {
    this.poems = []; // [{ title, content: sentence[][] }]
    this.chapterIndex = 0;
    this.view = "lace"; // "lace" | "linear"
    this.showOriginalOnly = false;
    this.graph = new DependencyGraph("en");

    this._resizeTimer = null;
  }

  async init() {
    const response = await fetch("/data/tokens_en.json");
    this.poems = await response.json();
    this._bindUI();
    this._loadChapter(this.chapterIndex);
  }

  get currentPoem() {
    return this.poems[this.chapterIndex] ?? null;
  }

  /** Flatten all sentences in the current chapter into one token list.
   *  Sentence breaks are preserved via a synthetic separator token so
   *  the layout can insert visual gaps between verses.
   */
  get currentTokens() {
    const poem = this.currentPoem;
    if (!poem) return [];
    return poem.content.flat();
  }

  // rendering

  _loadChapter(index) {
    this.chapterIndex =
      ((index % this.poems.length) + this.poems.length) % this.poems.length;
    const poem = this.currentPoem;
    if (!poem) return;

    const titleEl = document.getElementById("sentence-input");
    if (titleEl) titleEl.value = poem.title;
    this._initSVG();
    this._draw();
  }

  _draw() {
    const tokens = this.currentTokens;
    if (!tokens.length) return;

    if (this.view === "linear") {
      drawLinear(tokens);
    } else {
      this.graph.draw(tokens, this.currentPoem.content);
    }
  }

  _initSVG() {
    const svg = document.getElementById("svg");
    const container = document.querySelector("#canvas-wrap");
    svg.innerHTML = "";
    const W = container.clientWidth || 600;
    const H = 900;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.height = H + "px";
  }


  _bindUI() {
    document
      .getElementById("tab-ngram")
      .addEventListener("click", () => this._switchView("linear"));

    document
      .getElementById("tab-pos")
      .addEventListener("click", () => this._switchView("lace"));

    document
      .getElementById("draw")
      .addEventListener("click", () => this._draw());

    document.getElementById("prev-demo").addEventListener("click", () => {
      this._loadChapter(this.chapterIndex - 1);
    });

    document.getElementById("next-demo").addEventListener("click", () => {
      this._loadChapter(this.chapterIndex + 1);
    });

    const hideBlue = document.querySelector("#hide-blue");
    hideBlue.addEventListener("mouseenter", () => {
      this.showOriginalOnly = true;
      this._draw();
    });
    hideBlue.addEventListener("mouseout", () => {
      this.showOriginalOnly = false;
      this._draw();
    });

    document
      .getElementById("sentence-input")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._draw();
      });

    window.addEventListener("resize", () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this._draw(), 100);
    });
  }

  _switchView(v) {
    this.view = v;
    document
      .getElementById("tab-ngram")
      .classList.toggle("active", v === "linear");
    document.getElementById("tab-pos").classList.toggle("active", v === "lace");
    this._draw();
  }
}

const views = new Views();
views.init();

export { views };
