import type { EdgeLayer } from "./EdgeLayer";
import type { WordLayer } from "./WordLayer";

/**
 * Turns word/edge hover into a "focus set" and hands it to both layers.
 *
 *  - hover edge: that edge + its two words are hot; its label is shown.
 *  - hover word: that word + every edge touching it + every word on the other
 *                end of those edges are hot; all those labels are shown.
 *
 * Everything outside the focus set is pushed back by CSS (`.wv-focus`).
 */
export class HoverController {
  private key: string | null = null;

  private readonly words: WordLayer;
  private readonly edges: EdgeLayer;

  constructor(words: WordLayer, edges: EdgeLayer) {
    this.words = words;
    this.edges = edges;

    words.onHover((token) => {
      if (token === null) this.clear();
      else this.focusWord(token);
    });
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

    this.apply(wordSet, edgeSet);
  }
  /** False when this exact target is already focused. */
  private enter(key: string): boolean {
    if (this.key === key) return false;
    this.key = key;
    return true;
  }

  private apply(words: Set<number>, edges: Set<number>): void {
    this.words.setFocus(words);
    this.edges.setFocus(edges);
    this.edges.showLabels(edges);
  }
}