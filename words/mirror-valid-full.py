import csv
import re
import os

def is_valid(word):
    # Ignore words containing numbers, hyphens, apostrophes
    if re.search(r"[0-9\-']", word):
        return False
    # Ignore words that are ALL CAPS (except 1-letter words)
    if word.isupper() and len(word) > 1:
        return False
    return True

def load_words():
    # Always locate words.txt relative to script directory
    base = os.path.dirname(os.path.abspath(__file__))
    filepath = os.path.join(base, "words.txt")

    words = set()
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            w = line.strip()
            if w and is_valid(w):
                words.add(w.lower())
    return words

def main():
    words = load_words()
    seen = set()
    pairs = []

    for w in words:
        rw = w[::-1]
        if rw in words and (rw, w) not in seen and w != rw:
            pairs.append((w, rw, len(w)))  # ← add word length
            seen.add((w, rw))
            seen.add((rw, w))

    # Save output
    base = os.path.dirname(os.path.abspath(__file__))
    outfile = os.path.join(base, "mirror-valid-full.csv")

    with open(outfile, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["word", "reverse", "length"])  # ← updated header
        writer.writerows(pairs)

    print(f"Done! Found {len(pairs)} mirrored word pairs.")
    print(f"Saved to: {outfile}")

if __name__ == "__main__":
    main()
