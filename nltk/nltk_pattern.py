import sys
import re

# Import nltk for word filtering
try:
    import nltk
    from nltk.corpus import words as nltk_words
    from nltk.corpus import brown
    try:
        english_words = set(w.lower() for w in nltk_words.words())
    except LookupError:
        print("Downloading NLTK words corpus...")
        nltk.download('words', quiet=True)
        english_words = set(w.lower() for w in nltk_words.words())
    
    # Try to get common words from Brown corpus
    try:
        # Brown corpus contains common English words used in texts
        brown_words = set(w.lower() for w in brown.words())
        common_words = brown_words.intersection(english_words)
    except LookupError:
        print("Downloading NLTK Brown corpus for common words...")
        nltk.download('brown', quiet=True)
        brown_words = set(w.lower() for w in brown.words())
        common_words = brown_words.intersection(english_words)
        
except ImportError:
    print("Error: nltk not installed. Install with: pip install nltk")
    sys.exit(1)

def pattern_to_regex(pattern):
    """Convert pattern with dots to regex (e.g., '..r..' -> '^..r..$')"""
    regex_pattern = pattern.replace('.', '[a-z]')
    return f'^{regex_pattern}$'

def search_pattern(pattern):
    """Search for words matching the pattern, separated into common and uncommon"""
    pattern_length = len(pattern)
    regex = re.compile(pattern_to_regex(pattern.lower()))
    
    common_matches = []
    uncommon_matches = []
    
    for word in english_words:
        if len(word) == pattern_length and regex.match(word):
            if word in common_words:
                common_matches.append(word)
            else:
                uncommon_matches.append(word)
    
    return sorted(common_matches), sorted(uncommon_matches)

def main():
    print(f"NLTK corpus loaded: {len(english_words)} English words")
    print(f"Common words identified: {len(common_words)}\n")
    
    # Get pattern from command line or prompt user
    if len(sys.argv) > 1:
        pattern = sys.argv[1]
    else:
        pattern = input("Enter pattern: ")
    
    # Search for matches
    common_matches, uncommon_matches = search_pattern(pattern)
    
    # Display results
    total = len(common_matches) + len(uncommon_matches)
    
    if total > 0:
        print(f"\nFound {total} words matching pattern '{pattern}'")
        print("=" * 50)
        
        if common_matches:
            print(f"\n✓ COMMON WORDS ({len(common_matches)}) - Good for word games:")
            print("-" * 50)
            for word in common_matches:
                print(word)
        
        if uncommon_matches:
            print(f"\n✗ UNCOMMON WORDS ({len(uncommon_matches)}) - Rare/obscure:")
            print("-" * 50)
            for word in uncommon_matches:
                print(word)
    else:
        print(f"\nNo words found matching pattern '{pattern}'")

if __name__ == "__main__":
    main()