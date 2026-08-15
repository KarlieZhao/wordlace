// One [head, label] pair per token. head is 1-indexed; head === 0 means "root".
export type DepEdgeRaw = [number, string];

export interface DepDoc {
  tok: string[][];       // tok[sentenceIdx] = list of word strings, in sentence order
  dep: DepEdgeRaw[][];   // dep[sentenceIdx][tokenIdx] = [headIndex(1-based, 0=root), label]
}