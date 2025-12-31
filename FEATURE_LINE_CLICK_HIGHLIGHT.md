# Connection Line Click Highlighting Feature

## Configuration

The feature can be enabled or disabled via `config.js`:

```javascript
ENABLE_LINE_CLICK_HIGHLIGHTING: true  // Set to false to disable the feature
```

When disabled, connection lines will not be interactive and no highlighting will occur.

## Overview
When a player clicks on a connection line, the feature highlights word bank cells that could potentially fit across that connection. This helps players identify valid word placements in difficult levels.

## How It Works

### 1. Connection Line Interaction
- All connection lines are now **interactive** and respond to clicks
- Each line stores its rule information (positions, operation, etc.)

### 2. Grouping Algorithm
When a line is clicked, the system:

1. **Decodes the line rule** to determine which positions need to match
   - Example: If a line connects cell 3 of slot A to cell 2 of slot B, positions are 3 and 2

2. **Analyzes all words in the word bank** (not yet placed)
   - For each word, extracts letters at the relevant positions

3. **Forms groups** based on matching letters:
   - Words with the same letter at position 3 are grouped together
   - Words with the same letter at position 2 are grouped together
   - Only groups with 2+ cells are highlighted

4. **Assigns colors** from the SASHA_PALETTE:
   - First group gets first tint color
   - Second group gets second tint color
   - And so on...

### 3. Example

**Words in bank:** SPA, CAR, JAM, TAN, BRA

**Line rule:** Position 2 → Position 3 (with "same" operation)

**Grouping:**
- Position 2: 'A' appears in SPA, CAR, JAM, TAN → Group 1 (4 words, position 2)
- Position 3: 'A' appears in BRA → Not highlighted (only 1 word)
- Highlight SPA[2], CAR[2], JAM[2], TAN[2] with color 1

## Implementation Details

### New Methods in game.js

1. **`handleConnectionLineClick(ruleInfo)`**
   - Entry point when a line is clicked
   - Clears previous highlights
   - Calls grouping algorithm
   - Applies colors to groups

2. **`groupWordsByMatchingLetters(bankWords, pos1, pos2)`**
   - Core algorithm for finding matching letter groups
   - Returns array of groups, each containing word+position info
   - Tracks processed cells to avoid duplicates

3. **`highlightWordCell(wordContainer, letterIdx, tintColor)`**
   - Applies tint color to a specific cell in a word
   - Marks cell as highlighted for later clearing

4. **`clearWordBankHighlights()`**
   - Removes all highlights from word bank cells
   - Called when dragging words or clicking elsewhere

### Color Palette
Uses `CONFIG.SASHA_PALETTE` tint colors:
- 20 distinct soft tint colors
- Automatically cycles through palette for many groups
- First group: #fad1da (light red)
- Second group: #d8f0db (light green)
- etc.

## User Experience

### When to Use
- Difficult levels with many potential word placements
- When multiple words share similar letter patterns
- To quickly identify valid word pairs

### Behavior
- Click a line → highlights appear
- Drag a word → highlights clear
- Click elsewhere → highlights clear
- Click different line → new highlights replace old ones

## Technical Notes

- Only words in the bank (not placed) are considered
- Words shorter than the required positions are skipped
- Highlighting persists until user takes another action
- No performance impact on levels with few words
- Scales well with many words and multiple groups
