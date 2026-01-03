import csv
import os
import itertools

# Path to CSV (assuming script and CSV are in the same folder)
csv_path = os.path.join(os.path.dirname(__file__), "words.csv")

# Load words into memory by length
words_by_length = {}  # {length: [word1, word2, ...]}
with open(csv_path, newline='', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        word = row['word'].strip()
        length_str = row['length'].strip()
        if not length_str.isdigit():  # skip invalid lengths
            continue
        length = int(length_str)
        if length not in words_by_length:
            words_by_length[length] = []
        words_by_length[length].append(word)

def parse_constraints(patterns):
    """
    Convert a list of patterns like "300-310,301-322" into a list of constraints.
    Each constraint is a tuple: (len1, ref1, pos1, len2, ref2, pos2)
    """
    constraints = []
    for p in patterns.split(','):
        try:
            first, second = p.split('-')
            if len(first) != 3 or len(second) != 3:
                print(f"Skipping invalid pattern: {p}")
                continue
            len1, ref1, pos1 = int(first[0]), int(first[1]), int(first[2])
            len2, ref2, pos2 = int(second[0]), int(second[1]), int(second[2])
            constraints.append((len1, ref1, pos1, len2, ref2, pos2))
        except Exception as e:
            print(f"Error parsing pattern {p}: {e}")
    return constraints

def generate_combinations(constraints):
    """
    Generate all valid word combinations based on constraints.
    """
    # Determine how many words we need
    max_ref = max(max(c[1], c[4]) for c in constraints)
    total_words = max_ref + 1

    # Collect possible words for each reference based on lengths in constraints
    words_for_ref = [set() for _ in range(total_words)]
    for c in constraints:
        len1, ref1, _, len2, ref2, _ = c
        words_for_ref[ref1].update(words_by_length.get(len1, []))
        words_for_ref[ref2].update(words_by_length.get(len2, []))

    # Convert sets to lists for iteration
    words_for_ref = [list(s) for s in words_for_ref]

    # Generate all possible combinations
    all_combinations = itertools.product(*words_for_ref)
    valid_combinations = []

    for combo in all_combinations:
        valid = True
        for c in constraints:
            len1, ref1, pos1, len2, ref2, pos2 = c
            w1, w2 = combo[ref1], combo[ref2]
            if pos1 >= len(w1) or pos2 >= len(w2) or w1[pos1] != w2[pos2]:
                valid = False
                break
        if valid:
            valid_combinations.append(combo)

    return valid_combinations

if __name__ == "__main__":
    user_input = input("Enter patterns (comma separated, e.g., 300-310,301-322): ").strip()
    constraints = parse_constraints(user_input)
    matches = generate_combinations(constraints)

    if matches:
        print(f"Found {len(matches)} matching combinations:")
        for combo in matches:
            print('-'.join(combo))
    else:
        print("No matches found.")
