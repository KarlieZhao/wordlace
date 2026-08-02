
### Identify Part of Speech
- currently using compromise - pretty cool! But might have to switch to spacy for more indepth fun...
- simpler grouping: Nouns, verbs, adjectives, and everything else--function words lumped together, a common simplification in NLP and typology

### visualize words

- number of syllable: connecting utterance with the text

- part of speech: probably still need some kind of model to recognize a word's POS within context, but pretty robust method. Con is the lines connecting the words can get very messy and meaningless.


#### word2vec
essentially distributional clusters; words are clustered purely by their contexts, with no predefined categories. the clusters are fuzzy, unlabeled. 
  - this gets us to see the trajectory of how the subject, or meaning shifts within the sentence, i guess? 
  - we might have to lose the vertical order of the words, can still represent the order with arrows
- could be fun to train it with different text, do the same math and see what difference results show up. (inspo: https://huggingface.co/blog/RDTvlokip/when-words-become-magic-vectors)
- Advantages
   - Captures meaning: similar words = close vectors
   - Magic analogies: king - man + woman = queen
   - Unsupervised: learns on raw text without labels
   - Compact: 300 dimensions vs vocabulary of 100k+ words
   - Fast to train: few hours on CPU/GPU
- Disadvantages
  - Polysemy ignored: "bank" (money) = "bank" (river)
  - Fixed vocabulary: new words = unknown
  - No context: same vector for "bank" everywhere
  - Cultural bias: reproduces corpus stereotypes
  - Obsolete: replaced by contextual (BERT, GPT)


#### WordNet

groups all nouns into ~25 broad semantic classes (person, animal, artifact, event, state...) and verbs into ~15. 
  - Looks pretty promising, but is kinda nutorious for its biases. 
  - could be fun to get some experiences w: https://www.nltk.org/howto/wordnet.html

#### word co-occurance network 
  - two nodes are connected by an edge if those words appear near each other in text (within some window, say 5 words)
edges can be weighted by how often they co-occur
  - you can see how words are related to each other
  - but sometimes meaning isn't in words at all 

#### Syntactic tree of a sentence
  - It splits into a noun phrase ("the cat") and a verb phrase ("chased the mouse")
  - The verb phrase splits into a verb ("chased") and another noun phrase ("the mouse")
  - Each noun phrase splits into a determiner ("the") and a noun ("cat" / "mouse")
  - shows how words nest into phrases hierarchically.

- dependency tree
  - with [spacy](https://stackoverflow.com/questions/36610179/how-to-get-the-dependency-tree-with-spacy)

- Attention maps: which words "look at" which words? 
  - damn, that'd be cool, sounds hard.

- POS tagger
  - would be cool to see text color coded by POS or something, visualizing the pattern

- thematic roles 
  - https://www.ling.upenn.edu/~beatrice/syntax-textbook/box-thematic.html

- sentence diagram 
  - 

- dissecting words
  - https://medium.com/@adecressac/beyond-simple-categories-a80633dfac39


- freqency of a word appearing in the language 
    informaiton theoretic (bits of information in a word)
  
#### NLP and relationality 
- words don't have intrinsic categories. (how much do i believe that?)
  - meaning = usage distribution
  - grammar = patterns of co-occurrence
  - category = convenience summary of behavior


### typological features of languages
- Linguistic typology is the systematic comparison of languages to find out what varies, what doesn't, and what patterns show up across unrelated languages.


#### word dependency
- this is what spacy does, with grammatical dependencies.
- Dependency grammar (DG) is a class of modern grammatical theories that are all based on the dependency relation (as opposed to the constituency relation of phrase structure).
- The following frameworks are dependency-based:
    Algebraic syntax
    Operator grammar
    Link grammar
    Functional generative description
    Lexicase
    Meaning–text theory
    Word grammar
    Extensible dependency grammar
    Universal Dependencies

#### semantic word dependency

popular semantic dependency formalisms

| Formalism                             | Focus                                                 |
| ------------------------------------- | ----------------------------------------------------- |
| PropBank                              | Predicate–argument roles (ARG0, ARG1, etc.)           |
| FrameNet                              | Semantic frames like *Buying*, *Travel*, *Giving*     |
| Abstract Meaning Representation (AMR) | Full graph representing sentence meaning              |
| DELPH-IN MRS / DM                     | Semantic dependency graphs derived from deep grammars |
| PAS (Predicate-Argument Structures)   | Predicate-centered semantic graphs                    |

- Semantic Role Labeling (SRL): AllenNLP SRL, HuggingFace SRL models
- SuPar (SDP): https://github.com/yzhangcs/parser
- AMR Parsing (Abstract Meaning Representation): look interesting, needs further investigation

- semantic distance

## what i've done
spacy.py process sentences into tokens.json

```python
 {
    "word": chunk.text,
    "norm": root.norm_,
    "pos": root.pos_,
    "id": chunk.start,
    "dep": root.dep_,
    "head_id": root.head.i,
    "is_phrase": True,
    "span": [chunk.start, chunk.end],  # token range
}
```

The dependency format works pretty well:
```json
{
  "nodes": [
    {"id":"John"},
    {"id":"give"},
    {"id":"book"},
    {"id":"Mary"}
  ],
  "edges":[
    {"from":"give","to":"John","label":"Agent"},
    {"from":"give","to":"book","label":"Theme"},
    {"from":"give","to":"Mary","label":"Recipient"}
  ]
}
```



# TODO
- next word options (what makes a sentence)?



A pipeline that's often a better fit is:

Extract entities and noun phrases.
Generate embeddings for each concept (e.g. with Sentence Transformers or E5).
Use SRL or OpenIE to identify explicit semantic relations.
Add embedding-based similarity edges between related concepts.
Lay out the resulting graph using a force-directed algorithm, UMAP, or another graph layout.

That produces a graph that reflects both explicit semantic relationships and latent semantic similarity, which is much richer for visualization and exploration.