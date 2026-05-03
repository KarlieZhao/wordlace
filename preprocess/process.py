#!/usr/bin/env python3
import json
import os
import shutil

import spacy  # pyright: ignore[reportMissingImports]
import en_core_web_sm  # pyright: ignore[reportMissingImports]
import zh_core_web_sm  # pyright: ignore[reportMissingImports]
from spacy import displacy  # pyright: ignore[reportMissingImports]

HERE = os.path.dirname(os.path.realpath(__file__))

nlp_en = spacy.load("en_core_web_sm")
# nlp_zh = spacy.load("zh_core_web_sm")

nlp_en = en_core_web_sm.load()
# nlp_zh = zh_core_web_sm.load()


def get_token_data(doc):
    return [
        {
            "word": token.text,
            "norm": token.norm_,
            "pos": token.pos_,
            "id": token.i,
        }
        for token in doc
    ]


def main():
    doc_en = nlp_en(
        "To be gorgeous you must first be seen, but to be seen allows you to be hunted."
    )
    # print([(w.text, w.pos_) for w in doc_en])

    # === CHINESE ===
    # doc_zh = nlp_zh("这是一句话。我正在分析这句话。")
    # print([(w.text, w.pos_) for w in doc_zh])
    # print("=== Dependencies ===")
    # for token in doc_zh:
    #     print(f"{token.text:<12} --[{token.dep_:<10}]--> {token.head.text}")

    result = get_token_data(doc_en)
    output_path = os.path.join("output", "tokens.json")
    destination = os.path.join(os.path.dirname(HERE), "web", "data")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    shutil.copy(output_path, destination)


if __name__ == "__main__":
    main()
    print("done.")
