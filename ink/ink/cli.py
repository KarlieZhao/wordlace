# ink/cli.py

import typer
import random
from typing import List, Optional
from prompt_toolkit import prompt

from ink.transform import last_word, reduce, retrieve, echo, ripple
from ink.storage import save_entry

app = typer.Typer()

ALL_COMMANDS = [last_word, echo, reduce, ripple]

# last words from stdin
STOP_WORDS = ["Bye.", "Remember.", "Dont forget.", "Shh."]

def process(command: str, text: str):
    if command == "distill":
        result = reduce(text)
    elif command == "recall":
        result = retrieve()
    elif command == "ripple":
        result = ripple()
    else:
        fn = random.choice(ALL_COMMANDS)
        result = fn(text)

    print(f"> {result}")
    save_entry(command=command, input_text=text, output_text=result)


@app.callback(invoke_without_command=True)
def main(args: Optional[List[str]] = typer.Argument(None)):
    if args:
        # inline: first token is command or default
        if args[0] in ["distill", "recall"]:
            command = args[0]
            text = " ".join(args[1:])
        else:
            command = "ink"
            text = " ".join(args)

        process(command, text)
        return

    # stdin
    while True:
        try:
            line = prompt("> ")

            if line.strip() in ["exit", "quit"]:
                break

            #  allow commands
            parts = line.split(" ", 1)

            if parts[0] == "distill" and len(parts) > 1:
                process("distill", parts[1])
            else:
                process("ink", line)

        except KeyboardInterrupt:
            print(f"\n{random.choice(STOP_WORDS)}")
            break


if __name__ == "__main__":
    app()
