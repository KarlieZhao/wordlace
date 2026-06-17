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
// 2. word positions: part of speech, word vector? (2d coordinates)
// 3. try a chinese version => chinese tokenizer | part of speech detector or smth
// 4. explore n-gram model for better outcome?
// 5. fix issues with the current POS_TRANSITIONS

import "./style.css";
import { DependencyGraph } from "./weave";
import {RadialDepGraph} from "./radial";
import { drawLinear } from "./braid";

class PoemView {
  constructor(lang, dataUrl, svgId, containerId) {
    this.lang = lang;
    this.dataUrl = dataUrl;
    this.svgId = svgId;
    this.containerId = containerId;
    this.poems = [];
    this.chapterIndex = 0;
    this.view = "lace"; // "lace" | "linear"
    this.showDeps = false;
    this.showDepsLocked = false;
    // this.graph = new DependencyGraph(this.svgId, lang);
    this.graph = new RadialDepGraph(this.svgId, lang);
    this._resizeTimer = null;
  }

  async load() {
    const res = await fetch(this.dataUrl);
    this.poems = await res.json();
  }

  get currentPoem() {
    return this.poems[this.chapterIndex] ?? null;
  }

  get currentTokens() {
    const poem = this.currentPoem;
    if (!poem) return [];
    return poem.content.flat();
  }

  loadChapter(index) {
    this.chapterIndex =
      ((index % this.poems.length) + this.poems.length) % this.poems.length;
    this._initSVG();
    this.draw();
  }

  draw() {
    const tokens = this.currentTokens;
    if (!tokens.length) return;
    if (this.view === "linear") {
      drawLinear(tokens, this.svgId);
    } else {
      this.graph.draw(tokens, this.currentPoem.content, this.svgId);
    }
  }

  _initSVG() {
    const svg = document.getElementById(this.svgId);
    const container = document.querySelector(`#${this.containerId}`);
    svg.innerHTML = "";
    const W = container.clientWidth || 600;
    const H = 900;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.height = H + "px";
  }

  switchView(v) {
    this.view = v;
    this.draw();
  }
}

class Views {
  constructor() {
    this.en = new PoemView(
      "en",
      "/data/borges_en_tokens.json",
      "svg-en",
      "canvas-wrap-en",
    );
    this.lang = new PoemView(
      "es",
      "/data/borges_es_tokens.json",
      "svg-lang",
      "canvas-wrap-lang",
    );
    this._resizeTimer = null;
  }

  async init() {
    await Promise.all([this.en.load(), this.lang.load()]);
    this._bindUI();
    this.en.loadChapter(0);
    this.lang.loadChapter(0);
  }

  _loadChapter(index) {
    this.en.loadChapter(index);
    this.lang.loadChapter(index);
    const titleEl = document.getElementById("sentence-input");
    if (titleEl) titleEl.value = this.en.currentPoem?.title ?? "";
  }

  _bindUI() {
    document
      .getElementById("tab-ngram")
      .addEventListener("click", () => this._switchView("linear"));
    document
      .getElementById("tab-pos")
      .addEventListener("click", () => this._switchView("lace"));
    document.getElementById("draw").addEventListener("click", () => {
      this.en.draw();
      this.lang.draw();
    });
    document.getElementById("prev-demo").addEventListener("click", () => {
      this._loadChapter(this.en.chapterIndex - 1);
    });
    document.getElementById("next-demo").addEventListener("click", () => {
      this._loadChapter(this.en.chapterIndex + 1);
    });

    const hideBlue = document.querySelector("#hide-blue");
    hideBlue.addEventListener("mouseenter", () => {
      this.en.showDeps = true;
      this.lang.showDeps = true;
      this.en.draw();
      this.lang.draw();
    });
    hideBlue.addEventListener("click", () => {
      const locked = !this.en.showDepsLocked;
      this.en.showDepsLocked = locked;
      this.lang.showDepsLocked = locked;
      hideBlue.textContent = locked ? "Hide Dependency" : "Show Dependency";
      this.en.draw();
      this.lang.draw();
    });
    hideBlue.addEventListener("mouseout", () => {
      this.en.showDeps = false;
      this.lang.showDeps = false;
      this.en.draw();
      this.lang.draw();
    });

    document
      .getElementById("sentence-input")
      .addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.en.draw();
          this.lang.draw();
        }
      });

    window.addEventListener("resize", () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this.en.draw();
        this.lang.draw();
      }, 100);
    });
  }

  _switchView(v) {
    this.en.switchView(v);
    this.lang.switchView(v);
    document
      .getElementById("tab-ngram")
      .classList.toggle("active", v === "linear");
    document.getElementById("tab-pos").classList.toggle("active", v === "lace");
  }
}

const views = new Views();
views.init();
export { views };
