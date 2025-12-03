import csv
import sys
import re
import os

def load_words(csv_file='words.csv'):
    """Load words from CSV file with columns: rank, word, total, length"""
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, csv_file)
    
    words = []
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Skip rows with NA or invalid length values
                try:
                    length = int(row['length'])
                    word = row['word'].lower().strip()
                    if word:  # Skip empty words
                        words.append({
                            'word': word,
                            'length': length
                        })
                except (ValueError, KeyError):
                    # Skip rows with invalid data
                    continue
        return words
    except FileNotFoundError:
        print(f"Error: {csv_file} not found in script directory: {script_dir}")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        sys.exit(1)

def pattern_to_regex(pattern):
    """Convert pattern with dots to regex (e.g., '..r.' -> '^..r.$')"""
    # Replace dots with regex pattern for any letter
    regex_pattern = pattern.replace('.', '[a-z]')
    return f'^{regex_pattern}$'

def search_pattern(pattern, words):
    """Search for words matching the pattern"""
    pattern_length = len(pattern)
    regex = re.compile(pattern_to_regex(pattern.lower()))
    
    matches = []
    for word_data in words:
        if word_data['length'] == pattern_length:
            if regex.match(word_data['word']):
                matches.append(word_data['word'])
    
    return matches

def main():
    # Load words from CSV
    print("Loading words from words.csv...")
    words = load_words()
    print(f"Loaded {len(words)} words\n")
    
    # Get pattern from command line or prompt user
    if len(sys.argv) > 1:
        pattern = sys.argv[1]
    else:
        pattern = input("Enter pattern: ")
    
    # Search for matches
    matches = search_pattern(pattern, words)
    
    # Display results
    if matches:
        print(f"\nFound {len(matches)} words matching pattern '{pattern}':")
        print("-" * 40)
        for word in matches:
            print(word)
    else:
        print(f"\nNo words found matching pattern '{pattern}'")

if __name__ == "__main__":
    main()