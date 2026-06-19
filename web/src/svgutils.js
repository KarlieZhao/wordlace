export function mkDefs(svg) {
  const d = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.appendChild(d);
  return d;
}

export function mkArrowMarker(defs, id, color) {
  const m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  m.setAttribute("id", id);
  m.setAttribute("markerWidth", "3");
  m.setAttribute("markerHeight", "3");
  m.setAttribute("refX", "4");
  m.setAttribute("refY", "2");
  m.setAttribute("orient", "auto");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  p.setAttribute("points", "0 0, 8 4, 0 8");
  // p.setAttribute("points", "8 0, 0 4, 8 8");
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

export function drawText(group, id = null, x, y, str, size, weight, fill, anchor, family, className=null) {
  // hit area
  const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  hitArea.setAttribute("fill", "transparent");

  const el = document.createElementNS("http://www.w3.org/2000/svg", "text");
  el.setAttribute("x", x);
  el.setAttribute("y", y);
  el.setAttribute("text-anchor", anchor || "middle");
  el.setAttribute("dominant-baseline", "middle");
  el.setAttribute("font-size", size || 16);
  el.setAttribute("pointer-events", "none");
  el.setAttribute("font-weight", weight || 400);
  el.setAttribute("fill", fill || "#111111");
  el.setAttribute("font-family", family || "IBM Plex Sans, sans-serif");
  if (className) el.setAttribute("class", className);
  el.textContent = str;

  if (id) {
    el.setAttribute("id", id)
  }

  group.appendChild(hitArea);
  group.appendChild(el);

  requestAnimationFrame(() => {
    const pad = { x: 12, y: 8 };
    const bbox = el.getBBox();
    hitArea.setAttribute("x", bbox.x - pad.x);
    hitArea.setAttribute("y", bbox.y - pad.y);
    hitArea.setAttribute("width", bbox.width + pad.x * 2);
    hitArea.setAttribute("height", bbox.height + pad.y * 2);
  });

  return { text: el, hitArea };
}
