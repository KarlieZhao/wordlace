import type { EdgeLayer } from "./EdgeLayer";
import type { WordLayer } from "./WordLayer";

export class HoverController {
  private key: string | null = null;

  private readonly words: WordLayer;
  private readonly edges: EdgeLayer;

  constructor(words: WordLayer, edges: EdgeLayer) {
    this.words = words;
    this.edges = edges;
  }

  setHoveredWord(token: number | null): void {
    if (token === null) {
      this.clear();
      return;
    }
    this.focusWord(token);
  }

  clear(): void {
    if (this.key === null) return;
    this.key = null;
    this.words.setFocus(null);
    this.edges.setFocus(null);
    this.edges.hideLabels();
  }

  private focusWord(token: number): void {
    if (!this.enter(`w${token}`)) return;

    const edgeSet = new Set(this.edges.incident(token));
    const wordSet = new Set<number>([token]);
    for (const e of edgeSet) {
      const [head, child] = this.edges.endpoints(e);
      wordSet.add(head);
      wordSet.add(child);
    }

    this.words.setFocus(wordSet);
    this.edges.setFocus(edgeSet);
    this.edges.showLabels(edgeSet);
  }

  private enter(key: string): boolean {
    if (this.key === key) return false;
    this.key = key;
    return true;
  }
}