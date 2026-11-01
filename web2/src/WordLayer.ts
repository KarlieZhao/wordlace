import { TRANSITION_PROPS_WHILE_SIMULATING } from "./config";
export class WordLayer {
  private wordEls: HTMLElement[] = [];
  private connected = new Set<number>();
  private hot = new Set<number>();
  private hoverCb: ((token: number | null) => void) | null = null;
  private clickCb: ((token: number | null) => void) | null = null;

  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;

    root.addEventListener("mouseover", (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(".vector-word");
      if (el && this.root.contains(el)) this.hoverCb?.(Number(el.dataset.index));
    });

    root.addEventListener("mouseout", (e) => {
      const to = (e.relatedTarget as Element | null)?.closest?.(".vector-word");
      if (to) return;
      this.hoverCb?.(null);
    });

    root.addEventListener("click", (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(".vector-word");
      if (el && this.root.contains(el)) {
        this.clickCb?.(Number(el.dataset.index));
      }
    });
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

  setFocus(indices: ReadonlySet<number> | null): void {
    this.diffClass(this.hot, indices ?? new Set(), "wv-hot");
    this.root.classList.toggle("wv-focus", indices !== null);
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
