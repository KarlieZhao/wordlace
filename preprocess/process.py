#!/usr/bin/env python3
import json
import sys
import os
import shutil
import spacy
import re

import en_core_web_sm, zh_core_web_sm, es_core_news_sm

from spacy import displacy

HERE = os.path.dirname(os.path.realpath(__file__))
LANG = "zh"
END_PUNCT = re.compile(r'(?:[.!?。！？]+|……+|——+)["\')\]]*$')
# re.compile(r'[.!?]+["\')\]]*$')

if LANG == "en":
    nlp = spacy.load("en_core_web_sm")  # type: ignore
    nlp = en_core_web_sm.load()
elif LANG == "zh":
    nlp = spacy.load("zh_core_web_sm")  # type: ignore
    nlp = zh_core_web_sm.load()
elif LANG == "es":
    nlp = spacy.load("es_core_news_sm")  # type: ignore
    nlp = es_core_news_sm.load()


def get_noun_chunks_zh(doc):
    """Extract noun phrases using dependency relations."""
    chunks = []
    for token in doc:
        if token.dep_ in (
            "nsubj",
            "dobj",
            "nmod",
            "compound",
            "ROOT",
        ) and token.pos_ in ("NOUN", "PROPN"):
            start = token.i
            end = token.i + 1
            for child in token.children:
                if child.dep_ in ("compound", "nmod", "amod", "nummod"):
                    start = min(start, child.i)
                    end = max(end, child.i + 1)
            chunks.append(doc[start:end])
    return chunks


def get_phrase_data(doc):
    token_to_chunk = {}
    try:
        for chunk in doc.noun_chunks:
            for token in chunk:
                token_to_chunk[token.i] = chunk
    except NotImplementedError:
        token_to_chunk = get_noun_chunks_zh(doc)

    phrases = []
    visited = set()

    for token in doc:
        if token.i in token_to_chunk:
            chunk = token_to_chunk[token.i]
            if chunk.start not in visited:
                visited.add(chunk.start)
                root = chunk.root
                phrases.append(
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
                )
        else:
            # Non-noun tokens (verbs, conjunctions, etc.) cannot be "phrased"
            phrases.append(
                {
                    "word": token.text,
                    "norm": token.norm_,
                    "pos": token.pos_,
                    "id": token.i,
                    "dep": token.dep_,
                    "head_id": token.head.i,
                    "is_phrase": False,
                    "span": [token.i, token.i + 1],
                }
            )

    return phrases


def join_lines(lines):
    sentences = []
    buffer = []
    for line in lines:
        buffer.append(line.strip())
        if END_PUNCT.search(line.strip()):
            
            sentences.append(" ".join(buffer))
            buffer = []
    if buffer: 
        sentences.append(" ".join(buffer))
    return sentences


def main():
    if len(sys.argv) <= 1:
        print("Must enter input filename.")
        sys.exit()

    input_filename = sys.argv[1]

    if LANG == "en" or LANG == "zh" or LANG == "es":
        with open(f"./input/{input_filename}", "r") as file:
            poem = json.load(file)
    else:
        poem = ""
        print("to be implemented...")
        sys.exit()

    outgoing = []

    for chapter in poem:
        # print(chapter.keys())
        result = []
        for sentence in join_lines(chapter["content"]):
            doc_en = nlp(sentence)
            result.append(get_phrase_data(doc_en))
        data = {"title": chapter["title"], "content": result}
        outgoing.append(data)

    filename = f"{input_filename.split('.')[0]}_tokens.json"
    output_path = os.path.join("output", filename)
    destination = os.path.join(os.path.dirname(HERE), "web", "data")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(outgoing, f, ensure_ascii=False, indent=2)

    shutil.copy(output_path, destination)
    print("Data copied to ", os.path.join(destination, filename))


if __name__ == "__main__":
    main()
    print("done.")
