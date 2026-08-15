// One [head, label] pair per token. head is 1-indexed; head === 0 means "root".
export type DepEdgeRaw = [number, string];

export interface DepDoc {
  tok: string[][];
  dep: DepEdgeRaw[][];
  pos: string[][];

  ner?: any;
  srl?: any;
  "sdp/dm"?: any;
  "sdp/pas"?: any;
  "sdp/psd"?: any;
  con?: any;
  lem?: string[][];
  fea?: string[][];
}

export const POS_COLOR_MAP: Record<string, string> = {
  ADJ: "#F28E2B",
  ADV: "#76B7B2",
  PRON: "#B07AA1",
  PROPN: "#59A14F",
  DET: "#EDC948",
  NOUN: "#4E79A7",
  ADP: "#AF7AA1",
  CCONJ: "#FF9DA7",
  PUNCT: "#9C9C9C",
  VERB: "#E15759",
  AUX: "#D37295",
  SCONJ: "#8CD17D",
  PART: "#B6992D",
};
