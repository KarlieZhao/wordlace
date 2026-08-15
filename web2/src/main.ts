import "./style.css";

// dep parser

// node position
// word index: y
// x: random number for now

// render
// draw lines (svg lines)

import { renderDocSvg } from './dep';
import type { DepDoc } from './types';
import data from "../public/data.json";

const doc = data as DepDoc;

const el = document.getElementById('app') as HTMLDivElement;
el.innerHTML = renderDocSvg(doc);