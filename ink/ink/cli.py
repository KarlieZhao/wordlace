# ink/cli.py

# TODO: check out argparse 
# https://github.com/charmbracelet/bubbletea

import typer
from typing import List, Optional
from prompt_toolkit import prompt

from ink.transform import last_word, reduce, retrieve
from ink.storage import save_entry

app = typer.Typer()


def process(command: str, text: str):
    if command == "distill":
        result = reduce(text)
    elif command == "retrieve":
        result = retrieve()
    else:
        result = last_word(text)

    print(f"> {result}")

    save_entry(command=command, input_text=text, output_text=result)


@app.callback(invoke_without_command=True)
def main(args: Optional[List[str]] = typer.Argument(None)):
    if args:
        # inline: first token is command or default
        if args[0] in ["distill", "retrieve"]:
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
            print("\nbye")
            break


if __name__ == "__main__":
    app()
