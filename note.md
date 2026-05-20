
### Identify Part of Speech
- currently using compromise - pretty cool! But might have to switch to spacy for more indepth fun...
- simpler grouping: Nouns, verbs, adjectives, and everything else--function words lumped together, a common simplification in NLP and typology

### visualize words

- number of syllable: connecting utterance with the text

- part of speech: probably still need some kind of model to recognize a word's POS within context, but pretty robust method. Con is the lines connecting the words can get very messy and meaningless.

- word2vec/GloVe: essentially distributional clusters; words are clustered purely by their contexts, with no predefined categories. the clusters are fuzzy, unlabeled. 
  - this gets us to see the trajectory of how the subject, or meaning shifts within the sentence, i guess? 
  - we might have to lose the vertical order of the words, can still represent the order with arrows

- WordNet: groups all nouns into ~25 broad semantic classes (person, animal, artifact, event, state...) and verbs into ~15. 
  - Looks pretty promising, but it's kinda nutoriously known for its biases. 
  - could be fun to get some experiences w
  - https://www.nltk.org/howto/wordnet.html

- word co-occurance network 
  - two nodes are connected by an edge if those words appear near each other in text (within some window, say 5 words)
edges can be weighted by how often they co-occur
  - you can see how words are related to each other
  - but sometimes meaning isn't in words at all 

- Syntactic tree of a sentence
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

### NLP and relationality 
- words don't have intrinsic categories. (how much do i believe that?)
  - meaning = usage distribution
  - grammar = patterns of co-occurrence
  - category = convenience summary of behavior


### typological features of languages
- Linguistic typology is the systematic comparison of languages to find out what varies, what doesn't, and what patterns show up across unrelated languages.



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



# TODO
- next word options (what makes a sentence)?
- chinese
- make it real time
