import csv
import os

# -------- CONFIG --------
CSV_PATH = os.path.join("words", "words.csv")
# ------------------------

def parse_rules(rule_string):
    """
    Converts '1-0,2-2' → [(1,0), (2,2)]
    """
    rules = []
    for pair in rule_string.split(","):
        a, b = pair.split("-")
        rules.append((int(a), int(b)))
    return rules


def load_words_of_length(n):
    words = []
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            length_value = row.get("length", "").strip()

            # Skip rows with NA or invalid length
            if not length_value.isdigit():
                continue

            if int(length_value) == n:
                words.append(row["word"].lower())

    return words


def find_matches(words, rules):
    results = []

    for master in words:
        for other in words:
            if master == other:
                continue

            match = True
            for m_idx, o_idx in rules:
                if master[m_idx] != other[o_idx]:
                    match = False
                    break

            if match:
                results.append((master, other))

    return results


def main():
    n = int(input("Enter word length: "))
    rule_input = input("Enter index rules (e.g. 1-0,2-2): ")

    rules = parse_rules(rule_input)
    words = load_words_of_length(n)
    matches = find_matches(words, rules)

    print(f"\nFound {len(matches)} matches:\n")
    for master, other in matches:
        print(f"{master}  ->  {other}")


if __name__ == "__main__":
    main()
