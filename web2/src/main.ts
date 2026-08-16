import "./style.css";
import { NetDependencyRenderer } from "./rendernet";
import { SdpDependencyRenderer, type SdpDoc, type SdpMode } from "./rendersdp";
import type { DepDoc } from "./types";
import data from "../public/data.json";
import data_ch from "../public/data_ch.json";

const doc = data as DepDoc & SdpDoc;
const doc_ch = data_ch as DepDoc & SdpDoc;

const navbar = document.querySelector(".nav-bar");
const allBtns = navbar?.querySelectorAll<HTMLElement>(".btn");
const elLeft = document.getElementById("en") as HTMLDivElement;

type ViewMode = "syntactic-net" | "syntactic-tree" | "dm" | "pas" | "psd";

const buttonConfig: { id: string; mode: ViewMode }[] = [
  { id: "syntactic-btn", mode: "syntactic-tree" },
  { id: "syntactic-net-btn", mode: "syntactic-net" },
  { id: "semantic-relationship-btn", mode: "dm" },
  { id: "predicate-btn", mode: "pas" },
  { id: "semantic-functions-btn", mode: "psd" },
];

function setActiveButton(btn: HTMLElement) {
  allBtns?.forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

function renderView(mode: ViewMode) {
  if (mode === "syntactic-tree" || mode === "syntactic-net") {
    const layout = mode === "syntactic-tree" ? "tree" : "net";
    new NetDependencyRenderer(layout).render(elLeft, doc);
  } else {
    new SdpDependencyRenderer(mode as SdpMode).render(elLeft, doc);
  }
}

buttonConfig.forEach(({ id, mode }) => {
  const btn = navbar?.querySelector<HTMLElement>(`#${id}`);
  btn?.addEventListener("click", () => {
    setActiveButton(btn);
    renderView(mode);
  });

  if (btn?.classList.contains("active")) {
    renderView(mode);
  }
});

// const elRight = document.getElementById("ch") as HTMLDivElement;
// new NetDependencyRenderer("net").render(elRight, doc_ch);
