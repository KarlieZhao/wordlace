#!/usr/bin/env python3
import os
import hanlp
import json
import numpy as np
from wordvecs import run_word2vec
import string
import shutil

HERE = os.path.dirname(os.path.realpath(__file__))

HanLP = hanlp.load(
    hanlp.pretrained.mtl.UD_ONTONOTES_TOK_POS_LEM_FEA_NER_SRL_DEP_SDP_CON_XLMR_BASE
)


def clean_list(strings):
    seen = set()
    result = []
    for s in strings:
        cleaned = s.translate(str.maketrans("", "", string.punctuation))
        if cleaned not in seen:
            seen.add(cleaned)
            result.append(cleaned)
    return result


def run():
    filename = "emily_dickinson"
    with open(f"./input/{filename}.json", "r") as file:
        input = json.load(file)
        print()
        print("Processing dependency...")
        output = HanLP(input)
        tokens = [item for sublist in output["tok"] for item in sublist]

        filtered_tokens = clean_list(tokens)

        print()
        print("Creating word vectors...")
        vecs = run_word2vec(filtered_tokens, ["light", "dark"],["positive", "negative"])

        destination = os.path.join(os.path.dirname(HERE), "web2", "public")

        tok_path = os.path.join("output", f"{filename}_tokens.json")
        vec_path = os.path.join("output", f"{filename}_vecs.json")

        with open(tok_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
            print(f"Created dependency output to {tok_path}.")

        with open(vec_path, "w", encoding="utf-8") as f:
            json.dump(vecs, f, ensure_ascii=False, indent=2)
            print(f"Created vector output to {vec_path}.")

        shutil.copy(tok_path, destination)
        shutil.copy(vec_path, destination)
        print(f"data copied to {destination}.")


if __name__ == "__main__":
    run()
    print("done.")
