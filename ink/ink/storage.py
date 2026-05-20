from pathlib import Path
import json
from datetime import datetime

LOG_DIR = Path.home() / "inklog"
LOG_FILE = LOG_DIR / "log.jsonl"


def save_entry(command: str, input_text: str, output_text: str):
    LOG_DIR.mkdir(exist_ok=True)

    entry = {
        "timestamp": datetime.now().isoformat(),
        "command": command,
        "input": input_text,
        "output": output_text,
    }

    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def read_log() -> list[dict]:
    if not LOG_FILE.exists():
        return []

    entries = []

    with open(LOG_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    return entries
