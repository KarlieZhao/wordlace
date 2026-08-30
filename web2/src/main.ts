import "./style.css";
import { SyntacticDependencyRenderer } from "./rendersyntax";
import { SdpDependencyRenderer, type SdpDoc } from "./rendersdp";
import type { DepDoc } from "./types";
import data from "../public/Not_Even_This_tokens.json";
import txt from "../public/not_even_this_fulltxt.json";
// import data from "../public/data_ch.json";

const doc = data as DepDoc & SdpDoc;
const poem = txt as string[];
// const doc_ch = data_ch as DepDoc & SdpDoc;

type ViewMode = "syntactic-tree" | "dm" | "pas" | "psd";

const buttonConfig: { id: string; mode: ViewMode }[] = [
  { id: "syntactic-btn", mode: "syntactic-tree" },
  // { id: "syntactic-net-btn", mode: "syntactic-net" },
  { id: "semantic-relationship-btn", mode: "dm" },
  { id: "predicate-btn", mode: "pas" },
  { id: "semantic-functions-btn", mode: "psd" },
];

class Renderer {
  tileDiv: HTMLDivElement;
  navbar: HTMLDivElement;
  allBtns: HTMLElement[] | null;
  enVisualizerDiv: HTMLDivElement;
  syntaticRenderer: SyntacticDependencyRenderer;
  sdpRenderer: SdpDependencyRenderer;
  fullLineDiv: HTMLDivElement;

  mode: ViewMode;
  showingAllArcs = false;

  constructor() {
    this.tileDiv = document.querySelector("#quilt") as HTMLDivElement;
    this.allBtns = [];
    this.fullLineDiv = document.querySelector("#original--line") as HTMLDivElement;
    this.enVisualizerDiv = document.getElementById("en-visualizer") as HTMLDivElement;

    // nav
    this.navbar = document.querySelector(".nav-bar") as HTMLDivElement;
    const gapSlider = this.navbar?.querySelector("#gap-size-slider") as HTMLInputElement;
    if (gapSlider) {
      gapSlider.addEventListener("input", (event: InputEvent) => {
        const target = event.target as HTMLInputElement;
        document.documentElement.style.setProperty("--sentence-height", `${target.value}px`);
      });
    }

    // right side divs
    const reconstructDiv = document.querySelector("#reconstruction") as HTMLDivElement;
    const updateReconstruction = (words: string[]) => {
      // TODO: only use "|" for word indexes that are not consecutive
      reconstructDiv.textContent = words.join(" | ");
    };

    // === MAIN RENDER ===
    this.mode = "dm";
    this.sdpRenderer = new SdpDependencyRenderer(updateReconstruction);
    this.syntaticRenderer = new SyntacticDependencyRenderer("tree");

    const buttonsNodeList = this.navbar?.querySelectorAll<HTMLElement>(".btn");
    if (buttonsNodeList) this.allBtns = [...buttonsNodeList];

    buttonConfig.forEach(({ id, mode }) => {
      const btn = this.navbar?.querySelector<HTMLElement>(`#${id}`);
      btn?.addEventListener("click", () => {
        this.mode = mode;
        this.setActiveButton(btn);
        this.renderView();
      });

      if (btn?.classList.contains("active")) {
        this.mode = mode;
        this.renderView();
      }
    });
    this.populatequilt();
    this.addTileLineListeners();
    this.setupShowAllArcs();
  }

  setupShowAllArcs() {
    const showAllDeps = this.navbar?.querySelector("#show-all-hidden");
    const allSdpArcs = [...this.enVisualizerDiv.querySelectorAll(".sdp-arc")];

    showAllDeps?.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (target.checked) {
        allSdpArcs.forEach((arc) => arc.classList.remove("hidden"));
        this.showingAllArcs = true;
      } else {
        allSdpArcs.forEach((arc) => arc.classList.add("hidden"));
        this.showingAllArcs = false;
      }
    });
  }

  setActiveButton(btn: HTMLElement) {
    this.allBtns?.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }

  renderView() {
    if (this.mode === "syntactic-tree") {
      this.syntaticRenderer.setMode("tree");
      this.syntaticRenderer.render(this.enVisualizerDiv, doc);
    } else {
      this.sdpRenderer.render(this.enVisualizerDiv, doc);
    }
  }

  populatequilt() {
    let html = "";
    // poem.forEach((line, index) => (html += line + `</span>\n<span class="tile-line" data-id="${index + 1}">`));
    poem.forEach(
      (line, index) =>
        (html += `<span class="tile-line" data-id=${index} style="width: ${line.length * 1.5}px"></span>\n`),
    );

    this.tileDiv.innerHTML = html;
  }

  addTileLineListeners() {
    const lineDivs = [...this.enVisualizerDiv.querySelectorAll<HTMLElement>(".sdp-sentence-wrap")];
    const tileLines = [...this.tileDiv.querySelectorAll<HTMLSpanElement>(".tile-line")];
    const allArcs = [...this.enVisualizerDiv.querySelectorAll<SVGPathElement>("path")];
    const allText = [...this.enVisualizerDiv.querySelectorAll<SVGTextElement>("text")];
    const sentenceMap = new Map<
      string,
      {
        graph: HTMLElement;
        paths: SVGPathElement[];
        text: SVGTextElement[];
      }
    >();

    lineDivs.forEach((graph) => {
      const id = graph.dataset.sentence;

      if (!id) return;

      sentenceMap.set(id, {
        graph,
        paths: [...graph.querySelectorAll<SVGPathElement>("path")],
        text: [...graph.querySelectorAll<SVGTextElement>("text")],
      });
    });

    let activeTileLine: HTMLSpanElement | null = null;

    tileLines.forEach((tileLine) => {
      tileLine.addEventListener("mouseenter", () => {
        const id = tileLine.dataset.id;

        if (!id) return;

        if (this.mode === "dm") {
          const sentence = sentenceMap.get(id);
          if (!sentence) return;

          const tileRect = tileLine.getBoundingClientRect();
          const graphRect = sentence.graph.getBoundingClientRect();

          // console.log(sentence.graph, tileRect.top, graphRect.top - tileRect.top);

          // === scroll to view ===
          this.enVisualizerDiv.scrollBy({
            top: graphRect.top - tileRect.top + 80,
            behavior: "smooth",
          });

          if (!this.showingAllArcs) {
            allArcs.forEach((path) => path.classList.add("hidden"));
          }
          allText.forEach((text) => text.classList.add("lighter"));
          sentence.paths.forEach((path) => path.classList.remove("hidden"));
          sentence.text.forEach((text) => text.classList.remove("lighter"));

          activeTileLine?.classList.remove("tile-line-active");
          tileLine.classList.add("tile-line-active");
          activeTileLine = tileLine;
        } else if (this.mode === "syntactic-tree") {
        }

        // get the full sentence from SVG
        //   sentence.text
        //     .filter((el) => el.classList.contains("sdp-word"))
        //     .map((el) => el.textContent)
        //     .join(" "),

        // get full sentence from txt
        this.fullLineDiv.textContent = poem[parseInt(id)] || "";
      });
    });
  }
}

new Renderer();
