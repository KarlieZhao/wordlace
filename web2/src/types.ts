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
