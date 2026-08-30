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

type ViewMode = "syntactic-net" | "syntactic-tree" | "dm" | "pas" | "psd";

const buttonConfig: { id: string; mode: ViewMode }[] = [
  { id: "syntactic-btn", mode: "syntactic-tree" },
  // { id: "syntactic-net-btn", mode: "syntactic-net" },
  { id: "semantic-relationship-btn", mode: "dm" },
  { id: "predicate-btn", mode: "pas" },
  { id: "semantic-functions-btn", mode: "psd" },
];

class Renderer {
  allBtns: HTMLElement[] | null;
  enVisualizerDiv: HTMLDivElement;
  syntaticRenderer: SyntacticDependencyRenderer;
  sdpRenderer: SdpDependencyRenderer;
  tileDiv: HTMLDivElement;

  constructor() {
    const navbar = document.querySelector(".nav-bar");
    this.allBtns = [];

    const gapSlider = navbar?.querySelector("#gap-size-slider") as HTMLInputElement;
    if (gapSlider) {
      gapSlider.addEventListener("input", (event: InputEvent) => {
        const target = event.target as HTMLInputElement;
        document.documentElement.style.setProperty("--sentence-height", `${target.value}px`);
      });
    }

    const subSentenceDiv = document.querySelector("#reconstruction") as HTMLDivElement;

    const updateReconstruction = (words: string[]) => {
      // TODO: only use "|" for word indexes that are not consecutive
      subSentenceDiv.textContent = words.join(" | ");
    };
    this.sdpRenderer = new SdpDependencyRenderer(updateReconstruction);

    this.syntaticRenderer = new SyntacticDependencyRenderer("tree");
    this.tileDiv = document.querySelector("#quilt") as HTMLDivElement;
    const buttonsNodeList = navbar?.querySelectorAll<HTMLElement>(".btn");
    if (buttonsNodeList) this.allBtns = [...buttonsNodeList];
    this.enVisualizerDiv = document.getElementById("en-visualizer") as HTMLDivElement;

    buttonConfig.forEach(({ id, mode }) => {
      const btn = navbar?.querySelector<HTMLElement>(`#${id}`);
      btn?.addEventListener("click", () => {
        this.setActiveButton(btn);
        this.renderView(mode);
      });

      if (btn?.classList.contains("active")) {
        this.renderView(mode);
      }
    });
    this.populatequilt();
    this.addTileLineListeners();
  }

  setActiveButton(btn: HTMLElement) {
    this.allBtns?.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }

  renderView(mode: ViewMode) {
    if (mode === "syntactic-tree" || mode === "syntactic-net") {
      const layout = mode === "syntactic-tree" ? "tree" : "net";
      this.syntaticRenderer.setMode(layout);
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
    const allPaths = [...this.enVisualizerDiv.querySelectorAll<SVGPathElement>("path")];
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

        const sentence = sentenceMap.get(id);
        if (!sentence) return;
        const tileRect = tileLine.getBoundingClientRect();
        const graphRect = sentence.graph.getBoundingClientRect();

        console.log(sentence.graph, tileRect.top, graphRect.top - tileRect.top);
        this.enVisualizerDiv.scrollBy({
          top: graphRect.top - tileRect.top + 80,
          behavior: "smooth",
        });

        allPaths.forEach((path) => path.classList.add("hidden"));
        allText.forEach((text) => text.classList.add("lighter"));

        sentence.paths.forEach((path) => path.classList.remove("hidden"));
        sentence.text.forEach((text) => text.classList.remove("lighter"));

        activeTileLine?.classList.remove("tile-line-active");
        tileLine.classList.add("tile-line-active");
        activeTileLine = tileLine;
      });
    });
  }
}

new Renderer();
