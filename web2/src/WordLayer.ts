import { TRANSITION_PROPS_WHILE_SIMULATING } from "./config";
import { distToRect } from "./utils";

export class WordLayer {
  private wordEls: HTMLElement[] = [];
  private connected = new Set<number>();
  private hot = new Set<number>();
  private hoverCb: ((token: number | null) => void) | null = null;
  private clickCb: ((token: number | null) => void) | null = null;
  private focusCb: ((indices: ReadonlySet<number> | null) => void) | null = null;

  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;

    const THRESHOLD = 40;
    let lastIndex = -1;
    let raf = 0;

    root.addEventListener("mousemove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;

        let best: HTMLElement | null = null;
        let bestDist = THRESHOLD;

        root.querySelectorAll<HTMLElement>(".vector-word").forEach((el) => {
          for (const r of el.getClientRects()) {
            const d = distToRect(e.clientX, e.clientY, r);
            if (d < bestDist) {
              bestDist = d;
              best = el;
            }
          }
        });

        if (best) {
          const idx = Number((best as HTMLElement).dataset.index);
          if (idx !== lastIndex) {
            lastIndex = idx;
            this.hoverCb?.(idx);
          }
        }
      });
    });

    document.addEventListener("mousemove", (e) => {
      const rootPos = root.getBoundingClientRect();
      const vectorSVG = document.querySelector(".vector-edges");
      if (!vectorSVG) return;
      const inside =
        e.clientX > rootPos.left &&
        e.clientX < rootPos.right &&
        e.clientY > rootPos.top &&
        e.clientY < rootPos.top + vectorSVG.clientHeight - 80;

      if (!inside && lastIndex !== -1) {
        // console.log("out");
        lastIndex = -1;
        this.hoverCb?.(null);
      }
    });

    root.addEventListener("click", (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(".vector-word");
      if (el && this.root.contains(el)) {
        this.clickCb?.(Number(el.dataset.index));
      }
    });
  }

  getLayerBbox() {
    const bbox = this.root.getBoundingClientRect();
    return bbox;
  }

  onHover(cb: (token: number | null) => void): void {
    this.hoverCb = cb;
  }

  onClick(cb: (token: number | null) => void): void {
    this.clickCb = cb;
  }

  build(tokens: string[]): void {
    this.root.innerHTML = "";
    this.connected.clear();
    this.hot.clear();
    this.root.classList.remove("wv-focus");

    const fragment = document.createDocumentFragment();
    this.wordEls = tokens.map((token, i) => {
      const el = document.createElement("div");
      el.textContent = token;
      el.dataset.word = token.toLocaleLowerCase();
      el.dataset.index = String(i);
      el.classList.add("vector-word");
      fragment.appendChild(el);
      return el;
    });
    this.root.appendChild(fragment);
  }

  place(index: number, x: number, y: number): void {
    const style = this.wordEls[index]?.style;
    if (!style) return;
    style.left = `${x}px`;
    style.top = `${y}px`;
  }

  setTransitions(simulating: boolean): void {
    const value = simulating ? TRANSITION_PROPS_WHILE_SIMULATING : "";
    for (const el of this.wordEls) el.style.transitionProperty = value;
  }

  setSelected(indice: number): void {
    this.wordEls.forEach((el, i) => el.classList.toggle("wv-selected", indice === i));
  }

  onFocusChange(cb: (indices: ReadonlySet<number> | null) => void): void {
    this.focusCb = cb;
  }

  setFocus(indices: ReadonlySet<number> | null): void {
    this.diffClass(this.hot, indices ?? new Set(), "wv-hot");
    this.root.classList.toggle("wv-focus", indices !== null);
    this.focusCb?.(indices);
  }
  private diffClass(current: Set<number>, next: ReadonlySet<number>, cls: string): void {
    for (const i of current) {
      if (!next.has(i)) this.wordEls[i]?.classList.remove(cls);
    }
    for (const i of next) {
      if (!current.has(i)) this.wordEls[i]?.classList.add(cls);
    }
    current.clear();
    next.forEach((i) => current.add(i));
  }

  getText(index: number): string {
    return this.wordEls[index]?.textContent ?? "";
  }
}
