# Sublevel System Implementation

## Overview
The game now supports multiple sublevels within a single level, allowing players to fill slots multiple times with different sets of words before advancing to the next level.

## Changes Made

### 1. Level Data Structure (levels.json)
- **Before**: `"words": ["PEW","PIE"]`
- **After**: `"words": [["PEW","PIE"]]`

All word arrays are now nested arrays, where each inner array represents a sublevel:
```json
"words": [
  ["PEW","PIE"],    // Sublevel 1
  ["RAT","REA"],    // Sublevel 2
  ["CAT","DOG"]     // Sublevel 3
]
```

### 2. Game State Tracking
Added new properties to track sublevel progress:
- `this.allSublevels`: Array of all sublevel word sets
- `this.totalSublevels`: Total number of sublevels in current level
- `this.currentSublevelIndex`: Current sublevel being played (0-indexed)
- `this.stepProgressBar`: UI container for progress indicator

### 3. Step Progress Bar
New UI component that shows sublevel completion:
- **Appearance**: Horizontal line with equally spaced circles
- **Location**: Centered below level number, 30px vertical gap from level text (Y=95)
- **Spacing**: Circles are 90px apart (tripled from original 30px)
- **Behavior**:
  - Grey circles for incomplete sublevels
  - Green check marks for completed sublevels
  - Only displayed if level has more than 1 sublevel
  - Updates after each sublevel completion

### 4. Sublevel Count Control
New optional property `subLevelCount` in level data:
- **Purpose**: Limit how many sublevels to use from words array
- **Example**: If words has 5 arrays but `subLevelCount: 3`, only first 3 are used
- **Use Cases**:
  - Create word pools without using all words
  - Test different sublevel counts
  - Flexible level design

```json
{
  "words": [
    ["WORD1", "WORD2"],
    ["WORD3", "WORD4"],
    ["WORD5", "WORD6"],
    ["WORD7", "WORD8"],
    ["WORD9", "WORD10"]
  ],
  "subLevelCount": 3  // Only use first 3 sublevels
}
```

### 5. Sublevel Flow

#### Initial Load
1. Level loads with first sublevel words
2. Progress bar created if multiple sublevels exist
3. Player fills slots with dragged words

#### Sublevel Completion
1. All slots filled → `checkWinCondition()` triggered
2. If more sublevels remain:
   - Show "Great!" feedback (non-blocking, 0.6s)
   - Update progress bar (add green check)
   - Clear all slots
   - Load next sublevel words
   - Player continues with new word set
3. If last sublevel:
   - Show full win screen
   - Advance to next level

### 5. Key Methods Added/Modified

#### New Methods
- `createStepProgressBar(centerX, centerY)`: Creates progress indicator UI (90px spacing between circles)
- `updateStepProgressBar()`: Updates progress bar visual state
- `showSublevelCompleteFeedback(callback)`: Shows "Great!" text between sublevels
- `loadNextSublevel()`: Loads next set of words and resets slots
- `clearAllSlots()`: Empties all slots, resets state, clears tints and highlights

#### Modified Methods
- `init()`: Added sublevel tracking variables
- `preload()`: Added green_check.png loading
- `create()`: Initialize sublevel system with subLevelCount support
- `createUIElements()`: Added progress bar creation with 30px gap
- `checkWinCondition()`: Now checks sublevel index before showing win screen

### 6. Bug Fixes
- **Slot Reset Issues**: Fixed slots retaining green tints between sublevels
  - All tints properly cleared via `clearTint()`
  - Highlighted data flags reset
  - Active highlights cleared
- **Word Placement**: Can now place words immediately after sublevel completion
- **Visual Spacing**: Progress bar properly spaced from level text (30px gap)

### 7. Visual Assets
Uses existing `graphics/green_check.png` for completed sublevel indicators.

## Testing Recommendations

1. **Single Sublevel Level**: Verify no progress bar shown, normal win behavior
2. **Multiple Sublevel Level**: Check that:
   - Progress bar displays correctly
   - Each sublevel clears slots properly
   - Words update between sublevels
   - Green checks appear sequentially
   - Win screen only shows after final sublevel
3. **Level Transitions**: Ensure proper reset when moving to next level

## Configuration
No configuration changes needed. The system automatically detects:
- Number of sublevels from word array structure
- Whether to show progress bar (based on sublevel count)

## Backwards Compatibility
✅ Fully backwards compatible - single-word-set levels work as before (the nested array structure is preserved with just one array inside).

## Future Enhancements (Optional)
- Custom feedback messages per sublevel
- Sublevel difficulty progression indicators
- Animated transitions between sublevels
- Different feedback based on sublevel performance
