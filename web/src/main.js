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


// hovering: (attention)
// what words are related to this one, in what ways? 
// all the tangly lines...

import "./style.css";
import { DependencyGraph } from "./weave";
import { drawLinear } from "./braid";
import { Translator } from "./translate";
import { ArcDependencyGraph } from "./arcgraph";

class PoemView {
  constructor(lang, dataUrl, svgId, containerId, translateCallback = null) {
    this.lang = lang;
    this.dataUrl = dataUrl;
    this.svgId = svgId;
    this.containerId = containerId;
    this.poems = [];
    this.chapterIndex = 0;
    this.view = "lace"; // "lace" | "linear"
    this.showDeps = false;
    this.showDepsLocked = false;
    // this.graph = new ArcDependencyGraph(this.svgId, lang, translateCallback);
    this.graph = new DependencyGraph(this.svgId, lang, translateCallback);

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
  constructor(dualViews = false) {
    this._resizeTimer = null;
    this._listeners = [];

    this.views = [
      new PoemView(
        "en",
        "/data/borges_en.json",
        "svg-en",
        "canvas-wrap-en",
      ),
    ];

    if (dualViews) {
      this.translator = new Translator("es", "en");

      const translateCallback = (phrase) => {
        this.translator.translate(phrase);
      };
      this.views.push(
        new PoemView(
          "es",
          "/data/borges_es_tokens.json",
          "svg-lang",
          "canvas-wrap-lang",
          translateCallback,
        ),
      );
    }

    [this.en, this.lang] = this.views;
  }

  forEachView(fn) {
    this.views.forEach(fn);
  }

  addListener(el, event, handler) {
    el.addEventListener(event, handler);
    this._listeners.push(() => el.removeEventListener(event, handler));
  }

  destroy() {
    this._listeners.forEach((remove) => remove());
    this._listeners.length = 0;

    clearTimeout(this._resizeTimer);
  }

  drawAll() {
    this.forEachView((v) => v.draw());
  }

  async init() {
    this._bindUI();

    await Promise.all(this.views.map((v) => v.load()));

    this.forEachView((v) => v.loadChapter(0));
  }

  loadChapter(index) {
    this.forEachView((v) => v.loadChapter(index));

    const input = document.getElementById("sentence-input");

    if (input) {
      input.value = this.en.currentPoem?.title ?? "";
    }
  }

  switchView(view) {
    this.forEachView((v) => v.switchView(view));

    document
      .getElementById("tab-ngram")
      .classList.toggle("active", view === "linear");

    document
      .getElementById("tab-pos")
      .classList.toggle("active", view === "lace");
  }

  _bindUI() {
    this.addListener(document.getElementById("tab-ngram"), "click", () =>
      this.switchView("linear"),
    );
    this.addListener(document.getElementById("tab-pos"), "click", () =>
      this.switchView("lace"),
    );
    this.addListener(document.getElementById("draw"), "click", () =>
      this.drawAll(),
    );
    this.addListener(document.getElementById("prev-demo"), "click", () =>
      this.loadChapter(this.en.chapterIndex - 1),
    );
    this.addListener(document.getElementById("next-demo"), "click", () =>
      this.loadChapter(this.en.chapterIndex + 1),
    );

    const hideBlue = document.getElementById("hide-blue");

    this.addListener(hideBlue, "mouseenter", () => {
      this.forEachView((v) => {
        v.showDeps = true;
      });

      this.drawAll();
    });

    this.addListener(hideBlue, "mouseleave", () => {
      this.forEachView((v) => {
        v.showDeps = false;
      });

      this.drawAll();
    });

    this.addListener(hideBlue, "click", () => {
      const locked = !this.en.showDepsLocked;

      this.forEachView((v) => {
        v.showDepsLocked = locked;
      });

      hideBlue.textContent = locked ? "Hide Dependency" : "Show Dependency";

      this.drawAll();
    });

    this.addListener(
      document.getElementById("sentence-input"),
      "keydown",
      (e) => {
        if (e.key === "Enter") {
          this.drawAll();
        }
      },
    );

    const resizeHandler = () => {
      clearTimeout(this._resizeTimer);

      this._resizeTimer = setTimeout(() => {
        this.drawAll();
      }, 100);
    };

    window.addEventListener("resize", resizeHandler);

    this._listeners.push(() =>
      window.removeEventListener("resize", resizeHandler),
    );
  }
}

export let views;

async function createViews(dualViews) {
  if (views) {
    views.destroy();
  document.querySelector("#svg-en").innerHTML = "";
  document.querySelector("#svg-lang").innerHTML = "";
  }
    
  views = new Views(dualViews);
  await views.init();
}

async function initApp() {
  const dualViewBtn = document.getElementById("dual-views");

  dualViewBtn.addEventListener("click", async () => {
    const pressed = dualViewBtn.getAttribute("aria-pressed") === "true";

    const next = !pressed;

    dualViewBtn.setAttribute("aria-pressed", String(next));

    dualViewBtn.classList.toggle("on", next);
    await createViews(next);
  });

  await createViews(dualViewBtn.getAttribute("aria-pressed") === "true");
}

initApp();