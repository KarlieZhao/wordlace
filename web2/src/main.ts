import "./style.css";

// dep parser

// node position
// word index: y
// x: random number for now

// render
// draw lines (svg lines)

// import { renderDocSvg } from "./dep";
import { renderDocSvg } from "./net";
import type { DepDoc } from "./types";
import data from "../public/data.json";
import data_ch from "../public/data_ch.json";

const doc = data as DepDoc;
const doc_ch = data_ch as DepDoc;

const elLeft = document.getElementById("en") as HTMLDivElement;
elLeft.innerHTML = renderDocSvg(doc);

const elRight = document.getElementById("ch") as HTMLDivElement;
elRight.innerHTML = renderDocSvg(doc_ch);
