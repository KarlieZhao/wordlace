// TODO:
// . get "show dependency" working again
// . figure out the story of the tokens that are not aligned on the Y
// . add hovering: 
//     highlight: 1) same row (POS) (maybe)
//                2) words that have arrows to or from this
// . add more examples
// . figure out where the preface goes
// . translation
//               - try legend/side note type

// word Y positions: part of speech, word vector?
// dual views would be cool


import "./style.css";
import { DependencyGraph } from "./weave";
import { drawLinear } from "./braid";
import { Translator } from "./translate";
import { ArcDependencyGraph } from "./arcgraph";
import { PALETTE } from "./palette";

const POEM_FILES = [
  "borges_art_poetry_full",
  "borges_two_english_poems",
  "tselliot_tokens",
  "ch_poem_tokens",
  "aiqing_tokens"
]

class PoemView {
  constructor(lang, svgId, containerId, translateCallback = null) {
    this.lang = lang;
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

  async loadAll() {
    const results = await Promise.all(
      POEM_FILES.map(async (url) => {
        const res = await fetch(`/data/${url}.json`);
        return res.json();
      })
    );
    this.poems = results;
  }

  get currentPoem() {
    const poems = this.poems[this.chapterIndex];
    if (poems) return poems[0];
    else return null;
  }

  get currentTokens() {
    const poem = this.currentPoem;
    if (!poem) return [];
    return poem.content.flat();
  }

  loadChapter(index) {
    this.chapterIndex = ((index % POEM_FILES.length) + POEM_FILES.length) % POEM_FILES.length;
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
    this.viewScale = 1;
    this.views = [
      new PoemView(
        "en",
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

    await Promise.all(this.views.map((v) => v.loadAll()));

    this.forEachView((v) => v.loadChapter(0));
  }

  loadChapter(index) {
    this.forEachView((v) => v.loadChapter(index));

    // const input = document.getElementById("sentence-input");

    // if (input) {
    //   input.value = this.en.currentPoem?.title ?? "";
    // }
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
    // this.addListener(document.getElementById("tab-ngram"), "click", () =>
    //   this.switchView("linear"),
    // );
    // this.addListener(document.getElementById("tab-pos"), "click", () =>
    //   this.switchView("lace"),
    // );

    this.addListener(document.getElementById("prev-demo"), "click", () =>
      this.loadChapter(this.en.chapterIndex - 1),
    );
    this.addListener(document.getElementById("next-demo"), "click", () =>
      this.loadChapter(this.en.chapterIndex + 1),
    );


    this.addListener(document.getElementById("expand"), "click", () => {
      this.views.forEach(view => {
        this.viewScale += 0.1
        this.viewScale = Math.min(3, this.viewScale);
        const svg = document.querySelector(`#${view.svgId}`);
        svg.style.transform = `scale(${this.viewScale})`;
      })
    }
    );
    this.addListener(document.getElementById("shrink"), "click", () =>
      this.views.forEach(view => {
        this.viewScale -= 0.1
        this.viewScale = Math.max(0.1, this.viewScale);
        const svg = document.querySelector(`#${view.svgId}`);
        svg.style.transform = `scale(${this.viewScale})`;
      }));

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

    // const resizeHandler = () => {
    //   clearTimeout(this._resizeTimer);

    //   this._resizeTimer = setTimeout(() => {
    //     this.drawAll();
    //   }, 100);
    // };

    // window.addEventListener("resize", resizeHandler);

    // this._listeners.push(() =>
    //   window.removeEventListener("resize", resizeHandler),
    // );
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