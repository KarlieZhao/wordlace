import nlp from 'compromise/two';

//   // nouns
//   "noun":                        "NN",
//   "noun, singular":              "NN",
//   "noun, plural":                "NNS",
//   "proper noun, singular":       "NNP",
//   "proper noun, plural":         "NNPS",

//   // pronouns
//   "pronoun, personal":           "PRP",
//   "pronoun, possessive":         "PRP$",
//   "wh-pronoun":                  "WP",
//   "wh-pronoun, possessive":      "WP$",

//   // verbs
//   "verb, base form":             "VB",
//   "verb, 3rd person singular":   "VBZ",
//   "verb, past tense":            "VBD",
//   "verb, non-3rd person singular present": "VBP",
//   "verb, past participle":       "VBN",
//   "verb, gerund / present participle": "VBG",

//   // adjectives
//   "adjective":                   "JJ",
//   "adjective, comparative":      "JJR",
//   "adjective, superlative":      "JJS",

//   // adverbs
//   "adverb":                      "RB",
//   "adverb, comparative":         "RBR",
//   "adverb, superlative":         "RBS",
//   "wh-adverb":                   "WRB",

//   // determiners & predeterminers
//   "determiner":                  "DT",
//   "predeterminer":               "PDT",
//   "possessive ending":           "POS",
//   "wh-determiner":               "WDT",

//   // prepositions & particles
//   "preposition / subordinating conjunction": "IN",
//   "particle":                    "RP",
//   "infinitival to":              "TO",

//   // modals & auxiliaries
//   "modal":                       "MD",

//   // conjunctions
//   "coordinating conjunction":    "CC",

//   // numbers & symbols
//   "cardinal number":             "CD",
//   "list item marker":            "LS",
//   "symbol":                      "SYM",
//   "currency":                    "$",
//   "opening quotation mark":      "``",
//   "closing quotation mark":      "''",
//   "opening parenthesis":         "-LRB-",
//   "closing parenthesis":         "-RRB-",
//   "punctuation":                 ".",
//   "comma":                       ",",
//   "colon / semicolon / ellipsis": ":",

//   // other
//   "existential there":           "EX",
//   "foreign word":                "FW",
//   "interjection":                "UH",

export const POS_TRANSITIONS = {
  DET: ["ADJ", "NOUN", "PROPN", "ADV"],
  PRON: ["AUX", "VERB", "ADV"],
  AUX: ["VERB", "ADV", "PART"],
  VERB: ["DET", "NOUN", "PROPN", "ADP", "ADV", "PART", "PRON", "ADJ", "VERB"],
  NOUN: ["VERB", "AUX", "ADP", "CCONJ", "NOUN", "PART"],
  PROPN: ["VERB", "AUX", "ADP", "CCONJ", "PROPN", "NOUN"],
  ADJ: ["NOUN", "PROPN", "ADJ", "CCONJ"],
  ADV: ["VERB", "AUX", "ADJ", "ADV"],
  ADP: ["DET", "NOUN", "PROPN", "PRON", "VERB", "ADJ", "ADV"],
  CCONJ: ["DET", "NOUN", "PROPN", "PRON", "VERB", "ADJ", "ADV", "AUX", "ADP"],
  PART: ["VERB"],
  SCONJ: ["DET", "NOUN", "PROPN", "PRON", "VERB", "ADJ", "ADV"],
  NUM: ["NOUN", "PROPN", "ADJ"],
  INTJ: ["PUNCT"],
  X: ["NOUN", "VERB", "ADJ"],
};
export const COL_ORDER = ["NOUN", "PROPN", "ADV", "VERB", "AUX", "ADJ", "ADP", "DET", "CCONJ","PRON",  "SCONJ", "PART", "X", "PUNCT"];

export const COL_LABELS = {
  PRON: "pronoun",
  NOUN: "noun",
  PROPN: "proper noun",
  ADV: "adverb",
  VERB: "verb",
  AUX: "auxiliary",
  ADJ: "adj.",
  ADP: "prep.",
  DET: "det.",
  CCONJ: "conj.",
  SCONJ: "sub. conj.",
  PART: "particle",
  X: "other",
}

export const normalize = (str) => nlp(str).out('normal').trim();


/**
 * given a raw word, return its normalized followers as surface forms.
 * e.g. queryFollowers("hates") → ["this", "that"]
 */
export function queryFollowers(word) {
  const norm = normalize(word);
  const followers = bigramIndex.get(norm);
  if (!followers) return [];
  return [...followers].map(n => surfaceMap.get(n) || n);
}

/**
 * return the full bigram index as a plain object, for debugging
 */
export function getIndex() {
  const out = {};
  bigramIndex.forEach((followers, word) => {
    const surfaceWord = surfaceMap.get(word) || word;
    out[surfaceWord] = [...followers].map(n => surfaceMap.get(n) || n);
  });
  return out;
}
