import "./style.css";
import { SyntacticDependencyRenderer } from "./rendersyntax";
import { SdpDependencyRenderer, type SdpDoc, type SdpMode } from "./rendersdp";
import type { DepDoc } from "./types";
import data from "../public/Not_Even_This_tokens.json";
import data_ch from "../public/data_ch.json";

const doc = data as DepDoc & SdpDoc;
const doc_ch = data_ch as DepDoc & SdpDoc;

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
  elLeft: HTMLDivElement;
  syntaticRenderer: SyntacticDependencyRenderer;
  sdpRenderer: SdpDependencyRenderer;

  constructor() {
    const navbar = document.querySelector(".nav-bar");
    this.allBtns = [];
    this.sdpRenderer = new SdpDependencyRenderer();
    this.syntaticRenderer = new SyntacticDependencyRenderer("tree");

    const buttonsNodeList = navbar?.querySelectorAll<HTMLElement>(".btn");
    if (buttonsNodeList) this.allBtns = [...buttonsNodeList];
    this.elLeft = document.getElementById("en") as HTMLDivElement;

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
  }

  setActiveButton(btn: HTMLElement) {
    this.allBtns?.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }

  renderView(mode: ViewMode) {
    if (mode === "syntactic-tree" || mode === "syntactic-net") {
      const layout = mode === "syntactic-tree" ? "tree" : "net";
      this.syntaticRenderer.setMode(layout);
      this.syntaticRenderer.render(this.elLeft, doc);
    } else {
      this.sdpRenderer.render(this.elLeft, doc);
    }
  }
}

const renderer = new Renderer();

// const elRight = document.getElementById("ch") as HTMLDivElement;
// new NetDependencyRenderer("net").render(elRight, doc_ch);
