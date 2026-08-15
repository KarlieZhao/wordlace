import "./style.css";
import { renderDocSvg, addHoverEvents } from "./dep";
import { renderSdp } from "./sdp";
import type { DepDoc } from "./types";
import data from "../public/data.json";
import data_ch from "../public/data_ch.json";

const doc = data as DepDoc;
const doc_ch = data_ch as DepDoc;
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
  if (mode === "syntactic-tree") {
    elLeft.innerHTML = renderDocSvg(doc,"tree");
    addHoverEvents(elLeft);
  } else if (mode === "syntactic-net") {

    elLeft.innerHTML = renderDocSvg(doc, "net");
    addHoverEvents(elLeft);
  } else {
    renderSdp(elLeft, doc, mode);
  }
}

buttonConfig.forEach(({ id, mode }) => {
  const btn = navbar?.querySelector<HTMLElement>(`#${id}`);
  btn?.addEventListener("click", () => {
    setActiveButton(btn);
    renderView(mode);
  });
});

renderView("syntactic-tree");

// const elRight = document.getElementById("ch") as HTMLDivElement;
// elRight.innerHTML = renderDocSvg(doc_ch);
// addHoverEvents(elRight);
