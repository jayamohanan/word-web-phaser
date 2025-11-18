# Win Scene Documentation

## Overview
The Win Scene is displayed when the player successfully fills all slots with valid words that satisfy all constraints. The scene features a clean, simple UI that matches the game's aesthetic.

## Win Condition

### When Does the Player Win?
✅ **All slots are filled with words**  
✅ **All constraints are automatically satisfied** (the game prevents invalid placements)  
❌ **Not all words need to be used** (some levels may have extra words for difficulty)

### Win Detection Logic
```javascript
checkWinCondition() {
    const allSlotsFilled = this.slotSprites.every(slotContainer => {
        return slotContainer.getData('filled') === true;
    });
    
    if (allSlotsFilled) {
        // Show win scene after 500ms delay
        this.time.delayedCall(500, () => {
            this.scene.launch('WinScene', {
                currentLevelIndex: this.currentLevelIndex,
                totalLevels: this.totalLevels
            });
            this.scene.pause(); // Pause game scene
        });
    }
}
```

**Called after:**
- Every successful word placement
- When a word is dropped on a slot and passes all validation checks

## Win Scene Design

### Visual Elements

```
┌─────────────────────────────────────┐
│                                     │
│    🎉 Level Complete! 🎉           │
│                                     │
│    All slots filled successfully!  │
│           Great job!                │
│                                     │
│    ┌─────────────────┐             │
│    │   Next Level    │ ← Button   │
│    └─────────────────┘             │
│                                     │
└─────────────────────────────────────┘
```

### UI Components

1. **Semi-transparent Overlay**
   - Black color with 50% opacity
   - Dims the game board behind it
   - Full screen coverage

2. **White Panel**
   - 400px × 300px
   - White background (`0xffffff`)
   - Black border (4px, `0x333333`)
   - Centered on screen

3. **Title Text**
   - "🎉 Level Complete! 🎉"
   - Font: Arial, 36px, bold
   - Color: Dark gray (`#222`)
   - Positioned at top of panel

4. **Message Text**
   - "All slots filled successfully!\nGreat job!"
   - Font: Arial, 20px
   - Color: Medium gray (`#555`)
   - Center-aligned
   - Positioned in middle of panel

5. **Next Button**
   - 200px × 60px
   - Green background (`0x4CAF50`)
   - Darker green border (`0x2E7D32`, 3px)
   - Text: "Next Level" (white, 24px, bold)
   - Positioned at bottom of panel

### Button Interactions

#### Hover State
```javascript
nextButton.on('pointerover', () => {
    nextButton.setFillStyle(0x66BB6A); // Lighter green
    nextButton.setScale(1.05);         // Slightly larger
    nextButtonText.setScale(1.05);
});
```

#### Normal State
```javascript
nextButton.on('pointerout', () => {
    nextButton.setFillStyle(0x4CAF50); // Original green
    nextButton.setScale(1);
    nextButtonText.setScale(1);
});
```

#### Click State
```javascript
nextButton.on('pointerdown', () => {
    nextButton.setScale(0.95);         // Slightly smaller (pressed)
    nextButtonText.setScale(0.95);
});
```

#### Action
```javascript
nextButton.on('pointerup', () => {
    // Go to next level (loops back to first level)
    const nextLevelIndex = (this.currentLevelIndex + 1) % this.totalLevels;
    this.scene.start('WordWebGame', { levelIndex: nextLevelIndex });
});
```

### Entrance Animation

The panel scales up from 0 to 1 with a bounce effect:

```javascript
winContainer.setScale(0);
this.tweens.add({
    targets: winContainer,
    scale: 1,
    duration: 500,
    ease: 'Back.easeOut' // Creates a slight overshoot for bounce effect
});
```

**Timeline:**
```
0ms:   scale = 0 (invisible)
500ms: scale = 1 (full size with bounce)
```

## Level Progression

### Level Looping
```javascript
const nextLevelIndex = (this.currentLevelIndex + 1) % this.totalLevels;
```

**Example:**
- Current level: 0
- Total levels: 1
- Next level: (0 + 1) % 1 = 0 (loops back to first level)

**With Multiple Levels:**
- Current level: 2
- Total levels: 5
- Next level: (2 + 1) % 5 = 3

- Current level: 4 (last level)
- Total levels: 5
- Next level: (4 + 1) % 5 = 0 (loops back to first)

### Level Index Handling

**In WordWebGame.init():**
```javascript
init(data) {
    this.currentLevelIndex = data.levelIndex !== undefined ? data.levelIndex : 0;
}
```

**In WordWebGame.create():**
```javascript
this.totalLevels = levels.levels.length;
this.level = levels.levels[this.currentLevelIndex % this.totalLevels];
```

**Passed to WinScene:**
```javascript
this.scene.launch('WinScene', {
    currentLevelIndex: this.currentLevelIndex,
    totalLevels: this.totalLevels
});
```

## Scene Management

### Scene Flow

```
WordWebGame (playing)
    ↓
All slots filled
    ↓
500ms delay
    ↓
WinScene launches (WordWebGame pauses)
    ↓
Player clicks "Next Level"
    ↓
WordWebGame restarts with next level index
```

### Scene Methods Used

1. **`scene.launch()`**: Starts WinScene without stopping WordWebGame
2. **`scene.pause()`**: Pauses WordWebGame (keeps it in background)
3. **`scene.start()`**: Restarts WordWebGame with new level data

## Responsive Design

### Window Resize Handling

```javascript
resize(gameSize) {
    const { width, height } = gameSize;
    
    // Update overlay size
    const overlay = this.children.list[0];
    if (overlay) {
        overlay.setSize(width, height);
    }
    
    // Re-center the win container
    const winContainer = this.children.list[1];
    if (winContainer) {
        winContainer.setPosition(width / 2, height / 2);
    }
}
```

**Handles:**
- Window resizing
- Orientation changes (mobile)
- Full-screen toggle

## Color Scheme

Matches the main game's aesthetic:

| Element | Color | Hex Code |
|---------|-------|----------|
| Overlay | Black (50% alpha) | `0x000000` |
| Panel Background | White | `0xffffff` |
| Panel Border | Dark Gray | `0x333333` |
| Title Text | Dark Gray | `#222` |
| Message Text | Medium Gray | `#555` |
| Button (Normal) | Green | `0x4CAF50` |
| Button (Hover) | Light Green | `0x66BB6A` |
| Button Border | Dark Green | `0x2E7D32` |
| Button Text | White | `#ffffff` |

## User Experience

### Timing
- **500ms delay** before showing win scene
  - Gives player time to see the final word placement
  - Feels more natural than instant popup

### Feedback
- ✅ Clear visual indication of success
- ✅ Smooth entrance animation
- ✅ Satisfying button interactions
- ✅ Easy-to-read text with high contrast

### Accessibility
- Large, clear text
- High contrast colors
- Interactive cursor (hand pointer on button)
- Visual feedback on all interactions

## Future Enhancements

### Possible Additions
1. **Level Statistics**
   - Time taken
   - Number of moves
   - Star rating based on performance

2. **Replay Button**
   - Option to replay the current level
   - Side-by-side with "Next Level"

3. **Celebration Effects**
   - Confetti particles
   - Sound effects
   - More elaborate animations

4. **Level Preview**
   - Show thumbnail of next level
   - Display difficulty rating

5. **Social Sharing**
   - Share completion on social media
   - Challenge friends

## Implementation Notes

### Dependencies
- **Phaser 3**: Scene system, tweens, graphics
- **game.js**: Provides level data (currentLevelIndex, totalLevels)

### File Structure
```
/game.js          ← Main game scene
/WinScene.js      ← Win screen scene
```

### Registration
```javascript
// In game.js config
scene: [WordWebGame, WinScene]
```

Both scenes must be registered in the Phaser config for the scene management to work correctly.

## Testing Checklist

- [ ] Win scene appears when all slots filled
- [ ] Panel animates in smoothly
- [ ] Button hover effects work
- [ ] Button click navigates to next level
- [ ] Level loops back to first when reaching the end
- [ ] Scene centers correctly on different screen sizes
- [ ] Window resize keeps scene centered
- [ ] Game scene is properly paused behind win scene

## Summary

The Win Scene provides:
- ✅ Clear win condition (all slots filled)
- ✅ Simple, clean UI matching game style
- ✅ Smooth animations and transitions
- ✅ Level progression with looping
- ✅ Responsive design
- ✅ Intuitive interactions

This creates a satisfying end-of-level experience that encourages players to continue playing! 🎮✨
