import type { DepEdge, DepRepresentation, DepSentence, Sentences } from "./basedependency";
import { REPRESENTATIONS } from "./config";

export type RawDeps = Partial<Record<"sdp/dm" | "sdp/pas" | "sdp/psd", DepSentence[]>>;

/**
 * Pure data model (no DOM): tokens, sentence offsets and dependency edges.
 * "Global index" = position of a token in the flattened token list.
 */
export class DependencyGraph {
  /** Original-case tokens, flattened across sentences. */
  tokens: string[] = [];
  /** Lower-cased tokens, same indexing as `tokens`. */
  words: string[] = [];

  private sentences: Sentences = [];
  private offsets: number[] = [];
  private deps: Record<DepRepresentation, DepSentence[]> = { dm: [], pas: [], psd: [] };
  private edgeCache = new Map<number, DepEdge[]>();

  load(sentences: Sentences, raw: RawDeps): void {
    this.sentences = sentences;
    this.deps = {
      dm: raw["sdp/dm"] ?? [],
      pas: raw["sdp/pas"] ?? [],
      psd: raw["sdp/psd"] ?? [],
    };
    this.edgeCache.clear();

    this.tokens = sentences.flat();
    this.words = this.tokens.map((t) => t.toLocaleLowerCase());

    this.offsets = [];
    let offset = 0;
    for (const sentence of sentences) {
      this.offsets.push(offset);
      offset += sentence.length;
    }
  }

  get sentenceCount(): number {
    return this.sentences.length;
  }

  sentenceText(sentence: number): string {
    return this.sentences[sentence]?.join(" ") ?? "";
  }

  globalIndex(sentence: number, word: number): number {
    return this.offsets[sentence] + word;
  }

  /** Half-open range [start, end) of global token indices for a sentence. */
  sentenceRange(sentence: number): [number, number] {
    const start = this.offsets[sentence];
    return [start, start + (this.sentences[sentence]?.length ?? 0)];
  }

  /** Edges never change for a given sentence, so they're computed once. */
  edges(sentence: number): DepEdge[] {
    const cached = this.edgeCache.get(sentence);
    if (cached) return cached;

    const edges: DepEdge[] = [];

    for (const representation of REPRESENTATIONS) {
      const tokens = this.deps[representation][sentence];
      if (!tokens) continue;

      tokens.forEach((relations, child) => {
        relations.forEach(([hanlpHead, relation], relationIndex) => {
          const head = hanlpHead - 1;
          if (head < 0 || head >= tokens.length || head === child) return;

          edges.push({
            id: [sentence, representation, head, child, relationIndex].join("-"),
            child,
            head,
            relation,
            representation,
          });
        });
      });
    }

    this.edgeCache.set(sentence, edges);
    return edges;
  }
}
