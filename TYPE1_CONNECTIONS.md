# Type 1 Connections - Letter Increment/Decrement

## Overview
Type 1 connections add variety to the puzzle by requiring letters to be **incremented or decremented** rather than matching exactly. This creates more interesting puzzles and allows for creative level design.

## Connection Types

### Type 0: Same Letter (Default)
```
Connection: "022-100"
Meaning: Letter at slot 0, square 2 must be SAME as slot 1, square 0
```

**Example:**
```
Slot 0: [S][O][F][T]  ← Square 2 = F
            ↓  (Type 0: same letter)
Slot 1: [F][A][T][E]  ← Square 0 = F
```

### Type 1: Increment/Decrement Letter
```
Connection: "022-100-1-plus1"
Meaning: Letter at slot 0, square 2 PLUS 1 = slot 1, square 0
```

**Example:**
```
Slot 0: [C][A][T]  ← Square 2 = T
           ↓  (Type 1: +1)
Slot 1: [U][S][E]  ← Square 0 = U  (T + 1 = U)
```

---

## Connection String Format

### Basic Format
```
"[from]-[to]-[type]-[increment]"
```

### Components

1. **[from]**: Source square (3 digits)
   - Digit 1: Slot index
   - Digit 2: Square index
   - Digit 3: Side index (0=top, 1=right, 2=bottom, 3=left)

2. **[to]**: Target square (3 digits)
   - Same format as [from]

3. **[type]**: Connection type (optional, defaults to 0)
   - `0` or omitted: Same letter (Type 0)
   - `1`: Increment/decrement letter (Type 1)

4. **[increment]**: Increment value (required for Type 1)
   - `plus1`: Add 1 to letter
   - `plus2`: Add 2 to letter
   - `minus1`: Subtract 1 from letter
   - `minus2`: Subtract 2 from letter
   - etc.

### Examples

```json
"022-100"              // Type 0: Same letter (default)
"022-100-0"            // Type 0: Same letter (explicit)
"022-100-1-plus1"      // Type 1: Add 1
"022-100-1-plus2"      // Type 1: Add 2
"022-100-1-minus1"     // Type 1: Subtract 1
"131-223-1-plus3"      // Type 1: Add 3, different slots/squares
```

---

## Letter Increment Logic

### Alphabet Wrapping
Letters wrap around the alphabet:
```
A + 1 = B
B + 1 = C
...
Y + 1 = Z
Z + 1 = A  ← Wraps around
```

```
Z - 1 = Y
Y - 1 = X
...
B - 1 = A
A - 1 = Z  ← Wraps around
```

### Examples

**Plus 1:**
```
A → B
E → F
T → U
Z → A
```

**Plus 2:**
```
A → C
B → D
Y → A  (wraps)
Z → B  (wraps)
```

**Minus 1:**
```
B → A
F → E
U → T
A → Z  (wraps)
```

**Minus 3:**
```
D → A
C → Z  (wraps)
B → Y  (wraps)
A → X  (wraps)
```

---

## Bidirectional Nature

Type 1 connections work **both ways**, just like Type 0:

### Example: "022-100-1-plus1"

**Direction 1: From Slot 0 → Slot 1**
```
If slot 0, square 2 has letter T
Then slot 1, square 0 gets hint U (T + 1)
```

**Direction 2: From Slot 1 → Slot 0**
```
If slot 1, square 0 has letter U
Then slot 0, square 2 gets hint T (U - 1)
```

**Key Point:** The increment is **reversed** when going backwards!
- Forward: +1
- Backward: -1

---

## Visual Indicators

### Line Label
Type 1 connections show the increment value on the connection line:

```
Slot 0: [C][A][T]
           │
           │  ┌─────┐
           └──┤ +1  │  ← Blue label shows increment
              └─────┘
                 │
Slot 1: [U][S][E]
```

**Label Properties:**
- **Position:** Midpoint of connection line
- **Color:** Blue background (`#2196F3`)
- **Text:** White text showing increment (`+1`, `-2`, etc.)
- **Font:** Arial, 20px

---

## Implementation Details

### Code Structure

#### 1. Parse Connection String
```javascript
decodeConn(str) {
    const parts = str.split('-');
    
    return {
        slotIdx: parseInt(parts[0][0]),
        squareIdx: parseInt(parts[0][1]),
        sideIdx: parseInt(parts[0][2]),
        toSlotIdx: parseInt(parts[1][0]),
        toSquareIdx: parseInt(parts[1][1]),
        toSideIdx: parseInt(parts[1][2]),
        type: parts.length > 2 ? parseInt(parts[2]) : 0,
        increment: parseIncrement(parts[3]) // e.g., "plus2" → 2
    };
}
```

#### 2. Calculate Hint Letter
```javascript
calculateHintLetter(sourceLetter, increment) {
    if (increment === 0) return sourceLetter;
    
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const sourceIndex = alphabet.indexOf(sourceLetter);
    let targetIndex = sourceIndex + increment;
    
    // Wrap around
    while (targetIndex < 0) targetIndex += 26;
    while (targetIndex >= 26) targetIndex -= 26;
    
    return alphabet[targetIndex];
}
```

#### 3. Render Line Label
```javascript
if (connInfo.type === 1 && connInfo.increment !== 0) {
    const midX = (fromPt.x + toPt.x) / 2;
    const midY = (fromPt.y + toPt.y) / 2;
    
    const incrementText = connInfo.increment > 0 
        ? `+${connInfo.increment}` 
        : `${connInfo.increment}`;
    
    const label = this.add.text(midX, midY, incrementText, {
        backgroundColor: '#2196F3', // Blue
        color: '#ffffff',
        fontSize: '20px',
        padding: { x: 6, y: 4 }
    }).setOrigin(0.5);
}
```

#### 4. Update Hints (Bidirectional)
```javascript
// Forward direction
if (fromSlot.filled && !toSlot.filled) {
    const sourceLetter = fromSquare.letter;
    const hintLetter = calculateHintLetter(sourceLetter, connInfo.increment);
    showHint(toSquare, hintLetter);
}

// Backward direction (negate increment)
if (toSlot.filled && !fromSlot.filled) {
    const sourceLetter = toSquare.letter;
    const hintLetter = calculateHintLetter(sourceLetter, -connInfo.increment);
    showHint(fromSquare, hintLetter);
}
```

#### 5. Validate Connection
```javascript
// Check if letters match according to connection type
const expectedToLetter = calculateHintLetter(fromLetter, connInfo.increment);

if (toLetter === expectedToLetter) {
    // Connection is valid!
    showValidationFeedback();
}
```

---

## Level Design Examples

### Example 1: Caesar Cipher Puzzle
```json
{
  "slots": [
    { "length": 3, "anchorCol": -2, "anchorRow": -7 },
    { "length": 3, "anchorCol": -2, "anchorRow": -3 }
  ],
  "words": ["CAT", "DBU"],
  "connections": [
    "020-100-1-plus1",
    "021-101-1-plus1",
    "022-102-1-plus1"
  ]
}
```
Each letter shifts by +1 (simple Caesar cipher).

### Example 2: Mixed Types
```json
{
  "slots": [
    { "length": 4, "anchorCol": -3, "anchorRow": -7 },
    { "length": 4, "anchorCol": -3, "anchorRow": -3 },
    { "length": 4, "anchorCol": 1, "anchorRow": -7 }
  ],
  "words": ["FAST", "FATE", "CASE"],
  "connections": [
    "020-100",              // Type 0: F = F (same)
    "021-101-1-plus1",      // Type 1: A + 1 = B (but word is FATE, so won't match)
    "032-200"               // Type 0: T = C? (won't match)
  ]
}
```
Mix of Type 0 and Type 1 connections for variety.

### Example 3: Alphabet Wrapping
```json
{
  "slots": [
    { "length": 3, "anchorCol": -2, "anchorRow": -7 },
    { "length": 3, "anchorCol": -2, "anchorRow": -3 }
  ],
  "words": ["ZAP", "ABC"],
  "connections": [
    "020-100-1-plus1"  // Z + 1 = A (wraps around)
  ]
}
```
Demonstrates alphabet wrapping.

---

## Testing Scenarios

### Scenario 1: Type 0 (Baseline)
```
Level: Two slots, "SOFT" and "FATE"
Connection: "022-100" (Type 0)
Expected: F must match F ✓
```

### Scenario 2: Type 1 Plus 1
```
Level: Two slots, "CAT" and "DOG"
Connection: "022-100-1-plus1" (Type 1, +1)
Place CAT first → Hint appears in slot 1: U (T + 1 = U)
Place DOG → Square 0 shows U → Doesn't match D ✗
Need to swap: "DBU" would work → T + 1 = U ✓
```

### Scenario 3: Bidirectional
```
Connection: "020-100-1-plus2" (Type 1, +2)
Place word with C in slot 0, square 0 → Hint E in slot 1
Place word with E in slot 1, square 0 → Hint C in slot 0 (E - 2 = C)
```

### Scenario 4: Wrapping
```
Connection: "020-100-1-plus1" (Type 1, +1)
Place word with Z in slot 0 → Hint A in slot 1 (Z + 1 = A)
Place word with A in slot 1 → Hint Z in slot 0 (A - 1 = Z)
```

---

## User Experience

### Visual Feedback

1. **Line Label**
   - Shows increment clearly (`+1`, `-2`, etc.)
   - Blue color distinguishes from Type 0
   - Always visible

2. **Hints**
   - Calculate based on increment
   - Animate from source square
   - Show correct letter (e.g., T → U for +1)

3. **Validation**
   - Check expected letter (not exact match)
   - Green pulse when correct
   - No feedback when incorrect

### Player Understanding

**What players see:**
1. Line with `+1` label → "Aha, letters must differ by 1"
2. Place word with T → Hint U appears → "T + 1 = U, makes sense"
3. Try different word → Hint changes → "Oh, it's based on what I place"
4. Place matching word → Green validation → "Got it!"

---

## Editor Notes

### Creating Type 1 Connections

Since the editor doesn't have UI for Type 1 connections, create them manually:

1. **Use editor to create basic connection:**
   ```
   Editor outputs: "022-100"
   ```

2. **Manually edit in levels.json:**
   ```
   Change to: "022-100-1-plus1"
   ```

3. **Test in game to verify.**

### Quick Reference Table

| Want | Connection String |
|------|------------------|
| Same letter | `"022-100"` |
| Next letter (+1) | `"022-100-1-plus1"` |
| Previous letter (-1) | `"022-100-1-minus1"` |
| Skip one (+2) | `"022-100-1-plus2"` |
| Skip back (-2) | `"022-100-1-minus2"` |
| Caesar shift (+3) | `"022-100-1-plus3"` |

---

## Future Enhancements

### Possible Additions

1. **Type 2: Vowel/Consonant**
   - Connection requires vowel if source is vowel
   - `"022-100-2-vowel"`

2. **Type 3: Same Family**
   - Letters in same position category (start, middle, end of alphabet)
   - `"022-100-3-family"`

3. **Type 4: Opposite Position**
   - A ↔ Z, B ↔ Y, C ↔ X
   - `"022-100-4-mirror"`

4. **Visual Variants**
   - Different colors for different increment values
   - Animated arrow showing direction
   - Number displayed on both endpoints

---

## Summary

✅ **Type 0 Connections:** Same letter (default)
✅ **Type 1 Connections:** Letter increment/decrement with wrapping
✅ **Bidirectional:** Works both ways (increment negated when reversed)
✅ **Visual Indicator:** Blue label shows increment value
✅ **Flexible Format:** Easy to add more types in future

Type 1 connections add significant puzzle variety while maintaining simple, understandable rules! 🎮✨
