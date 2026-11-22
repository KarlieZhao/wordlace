// TODO:
// . translation
//          - try legend/side note type
// word Y positions: part of speech, word vector?
// dual views would be cool?

// TODO: add animation: highlight words one by one follow their order in the text
// TODO: maybe worth trying an ai model
// what other nlp methods?

// tokenize the word, project them on a 2d plane/word vector - based on their meanings?
// Train or download Word2Vec, GloVe, or FastText embeddings: gensim (python, word2vec, fastText, GloVe)

//according to chatgpt i can train my own embeddings
// https://chatgpt.com/c/6a62bfa6-a958-83ea-8ca0-1e81c055b4d5

// exploring: 
// 1. pos and dependency chain
// 2. markov chain
// 3. word embeddings (word2vec)

// use most translated famous text as examples?
// 1. identify the center word (based on dependency and other rules maybe)?
// 2. somehow calculate and decide the positions of other words in the sentence.

// 4 rows: adj+adv, nouns, verbs, everything else

import "./style.css";
import { DependencyGraph } from "./weave";
import { drawLinear } from "./braid";
import { Translator } from "./translate";

const POEM_FILES = [
  "karlie_starting_tokens",
  // "karlie_notes2_tokens",
  "borges_art_poetry_full",
  "borges_two_english_poems",
  "tselliot_tokens",
  "ch_tokens",
  // "bolano_ernesto_cardenal_and_i_tokens",
  // "ERNESTO_CARDENAL_Y_YO_tokens",
  // "aiqing_tokens"
];

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
    const svg = document.getElementById(this.svgId);
    svg.innerHTML = "";
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
    this.titleDiv = document.querySelector("#--poem--title");
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
    this.updateTitle(0)
    this.forEachView((v) => v.loadChapter(0));
  }

  updateTitle(index) {
    if (this.views[0].poems[index]) this.titleDiv.innerHTML = this.views[0].poems[index][0].title + "<br/>" + this.views[0].poems[index][0].author// TODO: crap...
    else {
      this.titleDiv.innerHTML = ""
    }
  }

  loadChapter(index) {
    index = ((index % POEM_FILES.length) + POEM_FILES.length) % POEM_FILES.length;
    this.updateTitle(index)
    this.forEachView((v) => v.loadChapter(index));
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
      this.views.forEach((view) => {
        this.viewScale += 0.1;
        this.viewScale = Math.min(3, this.viewScale);
        const svg = document.querySelector(`#${view.svgId}`);
        svg.style.transform = `scale(${this.viewScale})`;
      });
    });
    this.addListener(document.getElementById("shrink"), "click", () =>
      this.views.forEach((view) => {
        this.viewScale -= 0.1;
        this.viewScale = Math.max(0.1, this.viewScale);
        const svg = document.querySelector(`#${view.svgId}`);
        svg.style.transform = `scale(${this.viewScale})`;
      }),
    );

    // ==== show dependency labels ===
    const showDepBtn = document.getElementById("show-dep");
    this.addListener(showDepBtn, "mouseenter", () => {
      this.forEachView((v) => {
        if (!v.showDepsLocked) {
          const depLabels = document.querySelectorAll(".dep-label");
          depLabels.forEach((ele) => {
            ele.classList.remove("hidden");
          });
        }
      });
    });

    this.addListener(showDepBtn, "mouseleave", () => {
      this.forEachView((v) => {
        if (!v.showDepsLocked) {
          const depLabels = document.querySelectorAll(".dep-label");
          depLabels.forEach((ele) => {
            ele.classList.add("hidden");
          });
        }
      });
    });

    this.addListener(showDepBtn, "click", () => {
      const locked = !this.en.showDepsLocked;
      this.forEachView((v) => {
        v.showDepsLocked = locked;
        const depLabels = document.querySelectorAll(".dep-label");
        depLabels.forEach((ele) => {
          ele.classList.toggle("hidden", !v.showDepsLocked);
        });
      });
      showDepBtn.textContent = locked ? "Hide Dependency" : "Show Dependency";
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
  const closeIntro = document.getElementById("close-intro--input");
  const label = document.getElementById("close-intro-label");
  closeIntro.checked = false;
  document.querySelector(".intro-overlay-bg").classList.add("hidden");

  closeIntro.addEventListener("click", () => {
    document.querySelector(".intro-overlay-bg").classList.toggle("hidden");
  });
  
  // const dualViewBtn = document.getElementById("dual-views");

  // if (dualViewBtn) {
  //   dualViewBtn.addEventListener("click", async () => {
  //     const pressed = dualViewBtn.getAttribute("aria-pressed") === "true";

  //     const next = !pressed;

  //     dualViewBtn.setAttribute("aria-pressed", String(next));

  //     dualViewBtn.classList.toggle("on", next);
  //     await createViews(next);
  //   });
  // }

  await createViews(false);
}

initApp();