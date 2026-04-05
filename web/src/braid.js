import { drawText, line, mkDefs, mkArrowMarker } from "./svgutils";
const BLACK = "#111111"

export function drawLinear(tokens) {
  const startY = 60;
  const stepY = 58;
  const svg = document.getElementById("svg");
  svg.innerHTML = "";

  const W = svg.clientWidth || 600;
  const cx = W / 2;

  const defs = mkDefs(svg);
  mkArrowMarker(defs, "arr", BLACK);
  const wordGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  svg.appendChild(wordGroup);
  tokens.forEach((t, i) => {
    const y = startY + i * stepY;
    if (i < tokens.length - 1) {
      const arrowY1 = y + 14;
      const arrowY2 = y + stepY - 14;
      line(svg, cx, arrowY1, cx, arrowY2, BLACK, 1, "url(#arr)");
    }

    drawText(wordGroup, null, cx, y, t.word, 18, 400, BLACK, "middle");
  });

}