export function mkDefs(svg) {
  const d = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.appendChild(d);
  return d;
}

export function mkArrowMarker(defs, id, color) {
  const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  m.setAttribute("id", id);
  m.setAttribute("markerWidth", "8");
  m.setAttribute("markerHeight", "8");
  m.setAttribute("refX", "7");
  m.setAttribute("refY", "4");
  m.setAttribute("orient", "auto");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  p.setAttribute("points", "0 0, 8 4, 0 8");
  p.setAttribute("fill", color);
  m.appendChild(p);
  defs.appendChild(m);
}


export function line(svg, x1, y1, x2, y2, stroke, sw, marker) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
  el.setAttribute("x1", x1);
  el.setAttribute("y1", y1);
  el.setAttribute("x2", x2);
  el.setAttribute("y2", y2);
  el.setAttribute("stroke", stroke);
  el.setAttribute("stroke-width", sw || 1);
  if (marker) el.setAttribute("marker-end", marker);
  svg.appendChild(el);
  return el;
}

export function text(svg, x, y, str, size, weight, fill, anchor, family) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
  el.setAttribute("x", x);
  el.setAttribute("y", y);
  el.setAttribute("text-anchor", anchor || "middle");
  el.setAttribute("dominant-baseline", "middle");
  el.setAttribute("font-size", size || 16);
  el.setAttribute("font-weight", weight || 400);
  el.setAttribute("fill", fill || "#111111");
  el.setAttribute("font-family", family || "IBM Plex Sans, sans-serif");
  el.textContent = str;
  svg.appendChild(el);
  return el;
}
