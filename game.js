import * as Utils from './utils.js';
import WinScene from './WinScene.js';
import TutorialManager from './TutorialManager.js';
import { WordAnimationStateMachine, AnimationSequenceBuilder, WordState } from './WordAnimationStateMachine.js';

// Main Phaser game logic for Word Web
// Loads level data, renders slots, words, and handles drag-drop

class WordWebGame extends Phaser.Scene {
    constructor() {
        super('WordWebGame');
    }
    init(data) {
        this.firstSquares = [];
        this.firstStrokes = [];
        this.originX = this.sys.game.canvas.width * CONFIG.ORIGIN_X_FACTOR;
        this.originY = this.sys.game.canvas.height * CONFIG.ORIGIN_Y_FACTOR;
        this.currentLevelIndex = data.levelIndex !== undefined ? data.levelIndex : 0;

        this.largeConfigSize = CONFIG.SIZE.LARGE;
        this.smallConfigSize = CONFIG.SIZE.SMALL;

        this.slotStrokeColor = CONFIG.SLOT_STROKE_COLOR;
        this.wordStrokeColor = CONFIG.WORD_STROKE_COLOR;
        this.letterFontFamily = 'Arial, sans-serif';
        this.letterFontWeight = 'normal';
        this.connectionHighlightColor = CONFIG.CONNECTION_HIGHLIGHT_COLOR;
        this.autopilotEnabled = CONFIG.AUTOPILOT_ENABLED;
        this.autopilotInProgress = false; // Track if autopilot is currently running
        this.placementAnimationMode = CONFIG.PLACEMENT_ANIMATION_MODE || 'cell';
        this.undoCount = 0; // Track number of times words are dragged back from slots
        this.mistakeCount = 0; // Track mistakes according to game rules
        this.activeHighlightLine = null; // Track currently highlighted line for toggle behavior
        this.hoveredZone = null; // Track currently hovered zone for reliable click detection

        // Initialize score system
        this.currentScore = 0;
        this.targetScore = 0;
        this.pointsPerCell = CONFIG.POINTS_PER_CELL_ON_HINT;
        this.scoreText = null;

        // Initialize sublevel tracking
        this.currentSublevelIndex = 0;
        this.totalSublevels = 0;
        this.stepProgressBar = null;
        this.cellFillColor = CONFIG.CELL_BG1_COLOR;

    }

    preload() {
        // Only load assets if not already cached (prevents reloading on scene restart)
        if (!this.cache.json.has('levels')) {
            this.load.json('levels', 'levels.json');
        }
        
        if (!this.cache.audio.has('fillSound')) {
            this.load.audio('fillSound', 'sounds/fill_sound4.wav');
            this.load.audio('burstSound', 'sounds/burst.wav');
            this.load.audio('invalidSound', 'sounds/invalid.ogg');
            this.load.audio('successSound', 'sounds/success1.wav');
        }
        
        if (!this.textures.exists('handPointer')) {
            this.load.image('handPointer', 'graphics/hand_pointer.webp');
            this.load.image('hintButton', 'graphics/hint.png');
            this.load.image('skipButton', 'graphics/skip.png');
            this.load.image('retryButton', 'graphics/retry.png');
            this.load.image('greenCheck', 'graphics/green_check.png');
            this.load.image('hintIcon', 'graphics/hint.png');
            this.load.image('square', 'graphics/square.png');
            this.load.image('square-stroke', 'graphics/square-stroke.png');
        }
    }

    async create() {
        const levels = this.cache.json.get('levels');

        if (!levels || !levels[CONFIG.LEVEL_TYPE]) {
            console.error('Failed to load levels data. Check if levels.json is loaded correctly.');
            console.error('Available JSON cache keys:', this.cache.json.getKeys());
            return;
        }
        const levelsObject = levels[CONFIG.LEVEL_TYPE];

        this.input.dragDistanceThreshold = CONFIG.DRAG_DISTANCE_THRESHOLD;

        this.totalLevels = levelsObject.length;
        // Use modulo to loop levels
        this.level = levelsObject[this.currentLevelIndex % this.totalLevels];

        this.configSize = this.level.size === 'small' ? this.smallConfigSize : this.largeConfigSize;

        // Cache CONFIG variables for performance
        this.squareWidth = this.configSize.SQUARE_WIDTH;
        this.squareGap = this.configSize.SQUARE_GAP;
        this.gridSize = this.configSize.SQUARE_WIDTH + this.configSize.SQUARE_GAP;
        this.slotStrokeWidth = this.configSize.SLOT_STROKE_WIDTH;
        this.wordStrokeWidth = this.configSize.WORD_STROKE_WIDTH;
        this.slotCellFontSize = this.configSize.SLOT_CELL_FONT_SIZE;
        this.wordCellFontSize = this.configSize.WORD_CELL_FONT_SIZE;



        // Create gradient backgrounds
        // this.createGradientBackgrounds();

        this.slotSprites = [];
        this.bankSprites = [];
        this.connectionLines = [];
        this.selectedWord = null;
        this.wordBankArea = [];
        this.wordSlotArea = [];
        this.activeArrowAnimations = new Map(); // Track arrow animations by slot index

        // Normalize rules: convert negative increments to positive with reversed direction
        if (this.level.rules) {
            this.level.rules = this.level.rules.map(rule => {
                if (rule.type === 'cell' && rule.op && rule.op.startsWith('-')) {
                    // Extract the negative increment value
                    const increment = parseInt(rule.op);
                    if (increment < 0) {
                        // Convert to positive increment and swap a and b
                        return {
                            ...rule,
                            a: rule.b,  // Swap: b becomes a
                            b: rule.a,  // Swap: a becomes b
                            op: `+${Math.abs(increment)}`  // Convert -1 to +1, -2 to +2, etc.
                        };
                    }
                }
                return rule;
            });
        }

        // Parse word pairs for antonym support
        // Support both object format {"word": "LOVE", "opposite": "HATE"} and legacy "LOVE-HATE" format
        // Make it bidirectional so both LOVE→HATE and HATE→LOVE work
        this.wordAntonymMap = new Map();
        
        // Initialize sublevel system
        // Words should be an array of arrays: [["PEW","PIE"], ["RAT","REA"], ...]
        // But handle old format gracefully: ["PEW","PIE"]
        let wordsArray = this.level.words || [];
        
        // Check if words is already nested (new format) or flat (old format)
        if (wordsArray.length > 0 && !Array.isArray(wordsArray[0])) {
            // Old format: ["PEW","PIE"] -> convert to [["PEW","PIE"]]
            console.log('Converting old format words to nested format for level', this.currentLevelIndex);
            wordsArray = [wordsArray];
        }
        
        this.allSublevels = wordsArray;
        // Use subLevelCount if specified, otherwise use all sublevels
        this.totalSublevels = this.level.subLevelCount !== undefined 
            ? Math.min(this.level.subLevelCount, this.allSublevels.length)
            : this.allSublevels.length;
        this.currentSublevelIndex = 0;
        
        // Get words for current sublevel
        const currentSublevelWords = this.allSublevels[this.currentSublevelIndex] || [];
        
        if (currentSublevelWords && Array.isArray(currentSublevelWords)) {
            this.level.words = currentSublevelWords.map(wordData => {
                // Handle both string and object formats
                if (typeof wordData === 'object' && wordData.opposite) {
                    // New format: {"word": "LOVE", "opposite": "HATE"}
                    const word = wordData.word;
                    const opposite = wordData.opposite;
                    // Store both directions for bidirectional mapping
                    this.wordAntonymMap.set(word, opposite);
                    this.wordAntonymMap.set(opposite, word);
                    // Return word object without opposite property (just word and group if present)
                    const result = { word: word };
                    if (wordData.group !== undefined) {
                        result.group = wordData.group;
                    }
                    return result;
                } else if (typeof wordData === 'string' && wordData.includes('-')) {
                    // Legacy format: "LOVE-HATE"
                    const [original, antonym] = wordData.split('-');
                    // Store both directions for bidirectional mapping
                    this.wordAntonymMap.set(original, antonym);
                    this.wordAntonymMap.set(antonym, original);
                    return original; // Use original word for rendering
                } else if (typeof wordData === 'object' && wordData.word && wordData.word.includes('-')) {
                    // Legacy format in object: {"word": "LOVE-HATE", "group": 1}
                    const [original, antonym] = wordData.word.split('-');
                    // Store both directions for bidirectional mapping
                    this.wordAntonymMap.set(original, antonym);
                    this.wordAntonymMap.set(antonym, original);
                    // Return in original format with group if present
                    if (wordData.group !== undefined) {
                        return { word: original, group: wordData.group };
                    }
                    return original;
                }
                return wordData; // Return as-is
            });
        }

        this.createAreas();

        // No longer creating dynamic textures - using square.png and square-stroke.png instead

        // Calculate max swap pairs (used for tinting)
        this.maxSwapPairs = this.calculateMaxSwapPairs();

        // Show portrait boundary for debugging (if enabled in config)
        if (CONFIG.SHOW_PORTRAIT_BOUNDARY) {
            this.createPortraitBoundary();
        }

        this.renderSlots();
        this.renderBank();
        this.renderConnections();
        this.renderSlotLabels();

        // Calculate target score based on number of lines/slots
        this.targetScore = this.level.slots.length * this.pointsPerCell;
        this.currentScore = 0;

        // Initialize tutorial manager and create tutorial elements if level has tutorial data
        this.tutorialManager = new TutorialManager(this);
        this.tutorialManager.createTutorial(this.level, this.slotSprites, this.bankSprites);

        // Create UI elements (level display and buttons)
        this.createUIElements();

        // Add background click handler to clear highlights (if feature enabled)
        if (CONFIG.ENABLE_LINE_CLICK_HIGHLIGHTING) {
            this.input.on('pointerdown', (pointer) => {

                // If a zone is hovered, the user clicked on a line
                if (this.hoveredZone) {
                    const lineGraphics = this.hoveredZone.getData('connectionLine');
                    const ruleInfo = this.hoveredZone.getData('ruleInfo');
                    if (ruleInfo && lineGraphics) {
                        console.log('Handling line click from hovered zone');
                        this.handleConnectionLineClick(ruleInfo, lineGraphics);
                        return; // Don't clear highlights
                    }
                }

                // Check if we clicked on a word container
                const hitObjects = this.input.hitTestPointer(pointer);
                const clickedWord = hitObjects.some(obj =>
                    this.bankSprites && this.bankSprites.includes(obj)
                );

                if (!clickedWord) {
                    // Clear highlights when clicking on background
                    this.clearWordBankHighlights();
                    this.clearLineHighlight();
                    this.activeHighlightLine = null;
                }
            });
        }

        // Disable input initially and start entrance animations
        this.input.enabled = false;
        this.playEntranceAnimations();

        // Removed debug red square at canvas center

        // Add right-click handler to remove words from slots
        // this.input.on('pointerdown', (pointer) => {
        //     console.log('jaya');
        //     if (pointer.rightButtonDown()) {
        //         console.log('rightButtonDown');
        //         // Check if clicking on a filled slot to remove the word
        //         this.slotSprites.forEach((slotContainer, slotIdx) => {
        //             console.log(`Checking slot ${slotIdx}`);
        //             if (slotContainer.getData('filled')) {
        //                 const bounds = slotContainer.getBounds();
        //                 if (bounds.contains(pointer.worldX, pointer.worldY)) {
        //                     console.log(`Removing word from slot ${slotIdx}`);
        //                     // Find the word container that was placed here
        //                     this.bankSprites.forEach(wordContainer => {
        //                         if (wordContainer.getData('placed') && wordContainer.getData('slotIdx') === slotIdx) {
        //                             // Animate word back to its original position
        //                             this.tweenBackToBottom(wordContainer);
        //                             // Clear placement data immediately
        //                             wordContainer.setData('placed', false);
        //                             wordContainer.setData('slotIdx', null);
        //                         }
        //                     });
        //                     // Remove word from slot and update hints
        //                     this.removeWordFromSlot(slotIdx);
        //                 }
        //             }
        //         });
        //     }
        // });


        // Highlight slot squares when dragging over drop zone
        this.input.on('dragenter', (pointer, gameObject, dropZone) => {
            if (!dropZone || dropZone.getData('slotIdx') === undefined) return;
            if (!gameObject || !gameObject.getData('word')) return;

            const slotIdx = dropZone.getData('slotIdx');
            const word = gameObject.getData('word');
            const wordGroup = gameObject.getData('group') !== undefined ? gameObject.getData('group') : 0;
            const slotContainer = this.slotSprites[slotIdx];
            const slotGroup = slotContainer.getData('group') !== undefined ? slotContainer.getData('group') : 0;
            const slotCells = slotContainer.getData('slotCells');

            // Check group constraint - word and slot must be in same group
            if (wordGroup !== slotGroup) return;

            // Only check length constraint and if slot is filled during hover
            // Other constraints (hints/connections) will be checked after drop and snap
            if (slotCells.length !== word.length) return;
            const slotFilled = slotCells.some(cell => cell.squareContainer.getData('filled'));
            if (slotFilled) return;

            // Highlight slot cells with blue tint
            slotCells.forEach(cell => {
                const square = cell.squareContainer.getData('square');
                if (square) {
                    square.setTint(0x2196F3); // Blue highlight
                }
            });

            // Highlight connection lines connected to this slot
            this.connectionLines.forEach(line => {
                if (line.setStrokeStyle) { // Only for line objects, not text labels
                    const lineSlotIdx = line.getData('slotIdx');
                    const lineToSlotIdx = line.getData('toSlotIdx');
                    if (lineSlotIdx === slotIdx || lineToSlotIdx === slotIdx) {
                        line.setStrokeStyle(3, 0x2196F3); // Blue line
                    }
                }
            });
        });

        // Remove highlight when dragging out of drop zone
        this.input.on('dragleave', (pointer, gameObject, dropZone) => {
            if (!dropZone || dropZone.getData('slotIdx') === undefined) return;

            const slotIdx = dropZone.getData('slotIdx');
            const slotContainer = this.slotSprites[slotIdx];
            const slotCells = slotContainer.getData('slotCells');

            // Clear blue tint from slot cells, but restore green tint for hint cells
            slotCells.forEach(cell => {
                const square = cell.squareContainer.getData('square');
                if (square) {
                    // Check if this cell has a hint
                    const letterText = cell.squareContainer.getData('letterText');
                    const hasHint = letterText && letterText.text && letterText.text.trim() !== '';

                    if (hasHint) {
                        // Restore green tint for hint cells
                        square.setTint(this.connectionHighlightColor);
                    } else {
                        // Clear tint for non-hint cells
                        square.clearTint();
                    }
                }
            });

            // Reset connection lines connected to this slot
            this.connectionLines.forEach(line => {
                if (line.setStrokeStyle) { // Only for line objects, not text labels
                    const lineSlotIdx = line.getData('slotIdx');
                    const lineToSlotIdx = line.getData('toSlotIdx');
                    if (lineSlotIdx === slotIdx || lineToSlotIdx === slotIdx) {
                        const originalColor = line.getData('originalColor');
                        line.setStrokeStyle(3, originalColor); // Original color
                    }
                }
            });
        });

        // Global drop handler for slots - using state machine
        this.input.on('drop', (pointer, gameObject, dropZone) => {
            // Only handle if dropZone is a slot square
            if (!dropZone || dropZone.getData('slotIdx') === undefined) {
                console.assert.log('No drop zone or slotIdx');
                return;
            }
            const slotIdx = dropZone.getData('slotIdx');
            const slotContainer = this.slotSprites[slotIdx];
            const slotCells = slotContainer.getData('slotCells');

            // Clear hover highlight immediately on drop
            slotCells.forEach(cell => {
                const square = cell.squareContainer.getData('square');
                if (square) {
                    square.clearTint();
                }
            });

            // Only allow drop if slot is not filled and word length matches slot length
            if (!gameObject || !gameObject.getData('word')) {
                console.assert.log('No gameObject or word data');
                this.tweenBackToBottom(gameObject);
                return;
            }

            const word = gameObject.getData('word');
            const wordGroup = gameObject.getData('group') !== undefined ? gameObject.getData('group') : 0;
            const slotGroup = slotContainer.getData('group') !== undefined ? slotContainer.getData('group') : 0;

            // Check group constraint - word and slot must be in same group
            if (wordGroup !== slotGroup) {
                console.log('group mismatch, going back');
                this.tweenBackToBottom(gameObject);
                return;
            }

            if (slotCells.length !== word.length) {
                console.log('length mismatch, going back');
                this.tweenBackToBottom(gameObject);
                return;
            }

            // Check if slot is already filled
            let slotFilled = slotCells.some(cell => cell.squareContainer.getData('filled'));
            if (slotFilled) {
                console.log('slot is already filled, going back');
                this.tweenBackToBottom(gameObject);
                return;
            }

            // Get transformed word and slot rule
            const transformedWord = this.getTransformedWord(word, slotIdx);
            const slotRule = this.getSlotRule(slotIdx);
            const willTransform = slotRule && (slotRule.op === 'opposite' || slotRule.op === 'reverse' || slotRule.op === 'swap') && transformedWord !== word;

            // Store original word before any transformation
            if (willTransform) {
                gameObject.setData('originalWordBeforeTransform', word);
            }
            gameObject.setData('animationsComplete', false);

            // Get state machine
            const stateMachine = gameObject.getData('stateMachine');
            if (!stateMachine) {
                console.error('No state machine found on word container');
                return;
            }

            // Build appropriate animation sequence
            let sequence;
            if (willTransform) {
                sequence = AnimationSequenceBuilder.buildTransformationSequence(
                    this, gameObject, slotIdx, transformedWord, slotRule
                );
            } else {
                sequence = AnimationSequenceBuilder.buildSimplePlacementSequence(
                    this, gameObject, slotIdx, word
                );
            }

            // Start the animation sequence NOW (before snap completes)
            stateMachine.startSequence(sequence, {
                originalWord: word,
                transformedWord: transformedWord,
                slotIdx: slotIdx,
                slotContainer: slotContainer,
                slotCells: slotCells
            });

            // Snap to slot position
            const offset = 0;
            const snapDuration = 200;

            // Since word children are offset to center in container,
            // we need to adjust snap position by half word width minus half cell
            const wordWidth = word.length * this.gridSize;
            const snapAdjustment = (wordWidth / 2) - (this.gridSize / 2);

            const snapTween = this.tweens.add({
                targets: gameObject,
                x: dropZone.x + offset + snapAdjustment,
                y: dropZone.y - offset,
                duration: snapDuration,
                ease: 'Power2',
                onComplete: () => {
                    // Clear snap tween reference and notify sequence to continue
                    stateMachine.clearSnapTween();
                    stateMachine.notifySnapComplete();
                }
            });

            // Register the snap tween with state machine for cancellation tracking
            stateMachine.setSnapTween(snapTween);

            // Reset connection line highlights
            this.connectionLines.forEach(line => {
                if (line.setStrokeStyle) {
                    const lineSlotIdx = line.getData('slotIdx');
                    const lineToSlotIdx = line.getData('toSlotIdx');
                    if (lineSlotIdx === slotIdx || lineToSlotIdx === slotIdx) {
                        const originalColor = line.getData('originalColor');
                        line.setStrokeStyle(3, originalColor); // Original color
                    }
                }
            });

            // Note: Hints, connection highlights, and arrows are now updated AFTER 
            // the sequential letter animation completes (see playPlacementAnimation callback)
        });
        

  this.input.keyboard.on('keydown-Y', () => {
    console.log('Y pressed changing color');
    
    if(this.firstSquares.length > 0){
        this.firstSquares.forEach(square => {
            square.setTint(0x00ff00);
        });
    }
    if(this.firstStrokes.length > 0){
        this.firstStrokes.forEach(stroke => {
            stroke.setTint(0x0000ff);
        });
    }
    
  });



    }
    // Play sequential letter bounce animation when word is placed
    playPlacementAnimation(wordContainer, onComplete) {
        // if (onComplete) onComplete();
        // return;
        const wordCells = wordContainer.getData('wordCells');
        const letters = wordCells.map(cell => cell.letter);
        const squares = wordCells.map(cell => cell.square);
        const strokes = wordCells.map(cell => cell.stroke);
        const slotIdx = wordContainer.getData('slotIdx');

        if (letters.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        // Store animation tweens for potential cancellation
        const animationTweens = [];
        wordContainer.setData('placementAnimationTweens', animationTweens);

        // Determine animation targets based on mode
        const animateSquares = this.placementAnimationMode === 'cell';

        // Animate each letter sequentially with a delay
        letters.forEach((letter, i) => {
            const square = squares[i];
            const stroke = strokes[i];
            const delay = i * 50; // 50ms delay between each letter for smoother cascade

            // Choose targets based on mode: letter-only or cell (letter + square with baked-in stroke)
            const targets = (animateSquares ? [letter, square, stroke] : [letter]).filter(Boolean);
            // const targets = [letter];          
            
            targets.forEach(t => {
                if (!t.getData('baseScaleX')) {
                    t.setData('baseScaleX', t.scaleX);
                    t.setData('baseScaleY', t.scaleY);
                }
            });


            const SCALE_FACTOR = 1.4;

const tween = this.tweens.add({
  targets,
  scaleX: (target) => target.getData('baseScaleX') * SCALE_FACTOR,
  scaleY: (target) => target.getData('baseScaleY') * SCALE_FACTOR,
  duration: 120,
  ease: 'Back.easeOut',
  delay,
  yoyo: true,
  onComplete: () => {
    targets.forEach(t => {
      t.setScale(
        t.getData('baseScaleX'),
        t.getData('baseScaleY')
      );
    });

    // your existing logic
    if (slotIdx !== undefined) {
      this.showInducedLetter(slotIdx, i);
    }

    if (i === letters.length - 1) {
      wordContainer.setData('placementAnimationTweens', null);
      if (onComplete) onComplete();
    }
  }
});

            // Bounce animation: scale up then back to normal
            // const tween = this.tweens.add({
            //     targets: targets,
            //     scaleX: 1.4,
            //     scaleY: 1.4,
            //     duration: 120,
            //     ease: 'Back.easeOut',
            //     delay: delay,
            //     yoyo: true,
            //     onComplete: () => {
            //         // Reset scale to ensure it's back to normal
            //         letter.setScale(1);
            //         if (square) square.setScale(1);
            //         if (stroke) stroke.setScale(1);

            //         // Show induced letter in correlated slot(s) as this letter completes
            //         if (slotIdx !== undefined) {
            //             this.showInducedLetter(slotIdx, i);
            //         }

            //         // If this is the last letter, call onComplete
            //         if (i === letters.length - 1) {
            //             wordContainer.setData('placementAnimationTweens', null);
            //             if (onComplete) onComplete();
            //         }
            //     }
            // });

            animationTweens.push(tween);
        });
    }

    // Cancel placement animation and reset letter scales
    cancelPlacementAnimation(wordContainer) {
        const animationTweens = wordContainer.getData('placementAnimationTweens');
        if (animationTweens) {
            // Stop all tweens
            animationTweens.forEach(tween => {
                if (tween && tween.isPlaying()) {
                    tween.stop();
                }
            });

            // Reset all letter and square scales
            const wordCells = wordContainer.getData('wordCells');
            const letters = wordCells.map(cell => cell.letter);
            const squares = wordCells.map(cell => cell.square);
            letters.forEach(letter => letter.setScale(1));
            squares.forEach(square => square.setScale(1));

            wordContainer.setData('placementAnimationTweens', null);
        }
    }

    // Cancel all animations related to word placement (transformation, placement, etc.)
    cancelAllWordAnimations(wordContainer) {
        // Cancel placement animation
        this.cancelPlacementAnimation(wordContainer);

        // Kill all tweens on the word container itself
        this.tweens.killTweensOf(wordContainer);

        // Kill all tweens on letters and squares
        const wordCells = wordContainer.getData('wordCells');
        if (wordCells) {
            const letters = wordCells.map(cell => cell.letter);
            const squares = wordCells.map(cell => cell.square);

            letters.forEach(letter => {
                this.tweens.killTweensOf(letter);
                letter.setScale(1);
                letter.setDepth(0);
            });

            squares.forEach(square => {
                this.tweens.killTweensOf(square);
                square.setScale(1);
            });
        }
    }

    // Apply word transformation with appropriate animation
    applyWordTransformation(wordContainer, originalWord, transformedWord, slotIdx, slotRule, onComplete) {
        const wordCells = wordContainer.getData('wordCells');
        const letters = wordCells.map(cell => cell.letter);

        // Update word container's data so when dragged again it uses the new word
        wordContainer.setData('word', transformedWord);

        // Determine which animation to use
        if (slotRule.op === 'opposite') {
            // Use flip animation for opposite
            this.applyFlipAnimation(wordContainer, letters, transformedWord, slotIdx, onComplete);
        } else if (slotRule.op === 'reverse' || slotRule.op === 'swap') {
            // Use swap animation for reverse and swap (letters only, not cells)
            this.applySwapAnimation(wordContainer, letters, originalWord, transformedWord, slotIdx, slotRule, onComplete);
        } else {
            // Fallback: just update text
            this.updateSlotWithTransformedWord(slotIdx, transformedWord);
            if (onComplete) onComplete();
        }
    }

    // Flip animation for opposite transformation
    applyFlipAnimation(wordContainer, letters, transformedWord, slotIdx, onComplete) {
        letters.forEach((letterText, i) => {
            // Scale down to 0.1 vertically
            this.tweens.add({
                targets: letterText,
                scaleY: 0.1,
                duration: 150,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    // Change letter halfway through animation
                    letterText.setText(transformedWord[i]);

                    // Scale back up
                    this.tweens.add({
                        targets: letterText,
                        scaleY: 1,
                        duration: 150,
                        ease: 'Quad.easeOut',
                        onComplete: () => {
                            // Pop animation to indicate new letter
                            this.tweens.add({
                                targets: letterText,
                                scaleX: 1.3,
                                scaleY: 1.3,
                                duration: 100,
                                ease: 'Back.easeOut',
                                yoyo: true,
                                onComplete: () => {
                                    // Update slot squares with new letters
                                    this.updateSlotWithTransformedWord(slotIdx, transformedWord);

                                    // Call completion callback after last letter
                                    if (i === letters.length - 1 && onComplete) {
                                        onComplete();
                                    }
                                }
                            });
                        }
                    });
                }
            });
        });
    }

    // Swap animation for reverse and swap transformations (letters only, cells stay in place)
    applySwapAnimation(wordContainer, letters, originalWord, transformedWord, slotIdx, slotRule, onComplete) {
        // Determine swap pairs
        let swapPairs = [];
        const isSwapOp = slotRule.op === 'swap'; // Track if it's a swap operation (not reverse)

        if (slotRule.op === 'reverse') {
            // Generate pairs for reverse: 1-n, 2-(n-1), etc., skipping middle if odd
            const len = originalWord.length;
            for (let i = 0; i < Math.floor(len / 2); i++) {
                swapPairs.push([i, len - 1 - i]);
            }
        } else if (slotRule.op === 'swap' && slotRule.pairs) {
            // Convert 1-based pairs to 0-based
            swapPairs = slotRule.pairs.map(pair => [pair[0] - 1, pair[1] - 1]);
        }

        if (swapPairs.length === 0) {
            this.updateSlotWithTransformedWord(slotIdx, transformedWord);
            if (onComplete) onComplete();
            return;
        }

        // Get word cells for background highlighting (only for swap operation)
        const wordCells = wordContainer.getData('wordCells');

        // Animate swaps simultaneously (letters only, not the bg cells)
        let completedSwaps = 0;
        const totalSwaps = swapPairs.length;

        swapPairs.forEach(([idx1, idx2], pairIndex) => {
            if (idx1 >= letters.length || idx2 >= letters.length) return;

            const letter1 = letters[idx1];
            const letter2 = letters[idx2];

            // Store original positions
            const pos1 = { x: letter1.x, y: letter1.y };
            const pos2 = { x: letter2.x, y: letter2.y };

            // Bring letters to front during animation so they stay visible above tiles
            letter1.setDepth(100000);
            letter2.setDepth(100000);

            // Highlight cell backgrounds during swap animation (only for swap operation, not reverse)
            let square1, square2, originalTexture1, originalTexture2;
            if (isSwapOp && wordCells && pairIndex < this.maxSwapPairs) {
                const cell1 = wordCells[idx1];
                const cell2 = wordCells[idx2];
                square1 = cell1.square;
                square2 = cell2.square;

                // Store original tints
                originalTexture1 = square1.tintTopLeft; // Store tint value instead of texture
                originalTexture2 = square2.tintTopLeft;

                // Apply grayscale highlight tint
                const highlightTint = this.getSwapHighlightTint(pairIndex);
                square1.setTint(highlightTint);
                square2.setTint(highlightTint);
            }

            // Animate only letters swapping positions (not the cells/squares)
            const duration = 900;
            const curve = 'Back.easeInOut';

            // Move letter1 to position 2
            this.tweens.add({
                targets: letter1,
                x: pos2.x,
                y: pos2.y,
                duration: duration,
                ease: curve,
                easeParams: [4]

            });

            // Move letter2 to position 1
            this.tweens.add({
                targets: letter2,
                x: pos1.x,
                y: pos1.y,
                duration: duration,
                ease: curve,
                easeParams: [4],
                onComplete: () => {
                    // Restore original cell tints (only for swap operation)
                    if (isSwapOp && square1 && square2) {
                        square1.setTint(originalTexture1);
                        square2.setTint(originalTexture2);
                    }

                    completedSwaps++;
                    if (completedSwaps === totalSwaps) {
                        // All swaps complete - now reset positions and update text values
                        letters.forEach((letter, i) => {
                            letter.setText(transformedWord[i]);
                            // Reset depth after animation
                            letter.setDepth(0);
                        });

                        // Reset all letters to their original container positions
                        letters.forEach((letter, i) => {
                            const originalX = i * this.gridSize;
                            letter.x = originalX;
                            letter.y = 0;
                        });

                        // Update slot with transformed word
                        this.updateSlotWithTransformedWord(slotIdx, transformedWord);

                        if (onComplete) onComplete();
                    }
                }
            });
        });
    }

    // Helper method to update slot squares with transformed word
    updateSlotWithTransformedWord(slotIdx, transformedWord) {
        return;
        const slotContainer = this.slotSprites[slotIdx];
        const slotCells = slotContainer.getData('slotCells');

        // Update slot container's word data to transformed word
        slotContainer.setData('word', transformedWord);

        slotCells.forEach((cell, idx) => {
            if (cell.letterText && idx < transformedWord.length) {
                cell.letterText.setText(transformedWord[idx]);
                cell.letterText.setAlpha(1.0);
            }
            if (idx < transformedWord.length) {
                cell.squareContainer.setData('letter', transformedWord[idx]);
            }
        });
    }

    // Apply antonym transformation with flip animation (kept for backwards compatibility)
    applyAntonymTransformation(wordContainer, originalWord, antonymWord, slotIdx, onComplete) {
        const wordCells = wordContainer.getData('wordCells');
        const letters = wordCells.map(cell => cell.letter);
        wordContainer.setData('word', antonymWord);
        const slotRule = { op: 'opposite' };
        this.applyWordTransformation(wordContainer, originalWord, antonymWord, slotIdx, slotRule, onComplete);
    }

    // Instantly reset word to original (no animation) - used when transformation fails constraint check
    resetWordToOriginal(wordContainer, originalWord) {
        const wordCells = wordContainer.getData('wordCells');
        const letters = wordCells.map(cell => cell.letter);

        // Update word container's data back to original
        wordContainer.setData('word', originalWord);

        // Instantly update all letter texts to original word
        letters.forEach((letter, i) => {
            letter.setText(originalWord[i]);
            letter.setScale(1); // Reset any scale changes
            letter.setDepth(0); // Reset depth

            // Reset letter position to original container position
            const originalX = i * this.gridSize;
            letter.x = originalX;
            letter.y = 0;
        });

        // Stop any ongoing tweens on these letters
        letters.forEach(letter => {
            this.tweens.killTweensOf(letter);
        });
    }

    // Mark word as placed and slot as filled - only called after constraint validation
    markWordAsPlaced(gameObject, slotIdx, slotContainer, slotCells, originalWord, transformedWord, wasTransformed) {
        // Check if this is a mistake (word was in a different slot before)
        const draggedFromSlotIdx = gameObject.getData('draggedFromSlotIdx');
        if (draggedFromSlotIdx !== undefined && draggedFromSlotIdx !== null && draggedFromSlotIdx !== slotIdx) {
            this.mistakeCount++;
            console.log(`Mistake: Word moved from slot ${draggedFromSlotIdx} to slot ${slotIdx}. Mistakes: ${this.mistakeCount}`);

            // Decrement score if the word had earned points in the previous slot
            const previousPointsEarned = gameObject.getData('pointsEarnedInSlot') || 0;
            if (previousPointsEarned > 0) {
                this.currentScore = Math.max(0, this.currentScore - previousPointsEarned);
                this.updateScoreDisplay();
            }
        }
        // Clear the drag tracking
        gameObject.setData('draggedFromSlotIdx', null);

        // Check for cells placed over hints and award points
        let pointsEarned = 0;
        slotCells.forEach((cell, i) => {
            const letterText = cell.squareContainer.getData('letterText');
            // Check if this cell had a hint (letterText with content and not filled)
            if (letterText && letterText.text && letterText.text.trim() !== '' && !cell.squareContainer.getData('filled')) {
                const hintLetter = letterText.text.trim().toUpperCase();
                const placedLetter = transformedWord[i].toUpperCase();

                // Only award points if the placed letter matches the hint
                if (hintLetter === placedLetter) {
                    pointsEarned += this.pointsPerCell;

                    // Get world position of this cell for animation
                    const matrix = cell.squareContainer.getWorldTransformMatrix();
                    const worldPos = matrix.transformPoint(0, 0);

                    // Show +10 animation at this cell
                    this.showPointAnimation(worldPos.x, worldPos.y, this.pointsPerCell);
                }
            }
        });

        // Store points earned in this placement for future reference
        gameObject.setData('pointsEarnedInSlot', pointsEarned);

        // Update score if points were earned
        if (pointsEarned > 0) {
            this.currentScore += pointsEarned;
            this.updateScoreDisplay();
        }

        gameObject.setData('placed', true);
        gameObject.setData('slotIdx', slotIdx);
        gameObject.setData('lastPlacedSlotIdx', slotIdx);

        // Mark slot as filled with the final word (transformed or original)
        slotContainer.setData('filled', true);
        slotContainer.setData('word', transformedWord);
        slotContainer.setData('originalWord', originalWord); // Store original for reference

        slotCells.forEach((cell, i) => {
            cell.squareContainer.setData('filled', true);
            cell.squareContainer.setData('letter', transformedWord[i]);
            // Restore full opacity for placed words
            if (cell.letterText) {
                cell.letterText.setAlpha(1.0);
            }
        });

        // Check for words rules and trigger induced placements
        this.triggerInducedPlacements(slotIdx, transformedWord, gameObject);
    }

    // Trigger induced word placements based on words rules
    triggerInducedPlacements(sourceSlotIdx, sourceWord, sourceWordContainer) {
        const wordsRule = this.getWordsRule(sourceSlotIdx);
        if (!wordsRule) return;

        const correlatedSlots = this.getCorrelatedSlots(sourceSlotIdx);

        correlatedSlots.forEach(targetSlotIdx => {
            // Check if target slot is already filled
            const targetSlotContainer = this.slotSprites[targetSlotIdx];
            if (targetSlotContainer.getData('filled')) {
                return; // Skip if already filled
            }

            // Apply words transformation to get the induced word
            let inducedWord = this.applyWordsTransformation(sourceWord, wordsRule);

            // Setup induced placement - letters will appear as source slot letters animate
            this.setupInducedPlacement(targetSlotIdx, sourceWord, inducedWord, sourceWordContainer);
        });
    }

    // Setup induced placement - creates actual word container at target slot
    setupInducedPlacement(targetSlotIdx, originalWord, finalWord, sourceWordContainer) {
        const targetSlotContainer = this.slotSprites[targetSlotIdx];

        // Mark slot as being filled (but not fully filled yet)
        targetSlotContainer.setData('filling', true);
        targetSlotContainer.setData('targetWord', finalWord);

        // Copy the exact bank position from the source word container (identical twin)
        const bankPosition = sourceWordContainer.getData('initPosition');

        // Create an actual word container (identical twin) at the target slot position
        const targetSlotCells = targetSlotContainer.getData('slotCells');
        const slotX = targetSlotCells[0].squareContainer.getWorldTransformMatrix().tx;
        const slotY = targetSlotCells[0].squareContainer.getWorldTransformMatrix().ty;

        // Create word container
        let wordContainer = this.add.container(slotX, slotY);
        let wordCells = [];

        // Create all background squares first (hidden initially)
        for (let i = 0; i < finalWord.length; i++) {
            let x = i * this.gridSize;
            let y = 0;
            let square = this.add.image(x, y, 'wordCellTexture');
            square.setDisplaySize(this.squareWidth, this.squareWidth);
            square.setData({ wordIdx: -1, letterIdx: i });
            square.setAlpha(0); // Start hidden
            wordContainer.add(square);
            wordCells.push({ square: square, letter: null, index: i });
        }

        // Create all letters (initially hidden)
        for (let i = 0; i < finalWord.length; i++) {
            let x = i * this.gridSize;
            let y = 0;
            let letter = this.add.text(x, y, finalWord[i], {
                fontFamily: this.letterFontFamily,
                fontWeight: this.letterFontWeight,
                fontSize: this.wordCellFontSize,
                color: '#222',
                resolution: window.devicePixelRatio || 2
            }).setOrigin(0.5);
            letter.setAlpha(0); // Start hidden
            wordContainer.add(letter);
            wordCells[i].letter = letter;
        }

        wordContainer.setDepth(100);
        wordContainer.setData('word', finalWord);
        wordContainer.setData('placed', true);
        wordContainer.setData('slotIdx', targetSlotIdx);
        wordContainer.setData('isInduced', true);
        wordContainer.setData('wordCells', wordCells);
        wordContainer.setData('initPosition', bankPosition); // Use exact same bank position as source

        // Create state machine
        const stateMachine = new WordAnimationStateMachine(this, wordContainer);
        wordContainer.setData('stateMachine', stateMachine);

        // Make it draggable (identical behavior to original word)
        // Calculate word dimensions for proper centering when scaling
        const wordWidth = finalWord.length * this.gridSize;
        const halfWordWidth = wordWidth / 2;

        wordContainer.setInteractive(
            new Phaser.Geom.Rectangle(
                -halfWordWidth,
                -this.gridSize / 2,
                wordWidth,
                this.gridSize
            ),
            Phaser.Geom.Rectangle.Contains
        );
        this.input.setDraggable(wordContainer);

        // Add hover effects for desktop (only when word is in bank, not placed)
        wordContainer.on('pointerover', () => {
            if (!wordContainer.getData('placed')) {
                // Apply scale effect if enabled
                if (CONFIG.HOVER_SCALE_ENABLED) {
                    this.tweens.add({
                        targets: wordContainer,
                        scale: 1.1,
                        duration: 150,
                        ease: 'Power2'
                    });
                }

                // Apply tint to all cells if enabled (but don't override line-click highlights)
                if (CONFIG.HOVER_TINT_ENABLED) {
                    const cells = wordContainer.getData('wordCells');
                    if (cells) {
                        cells.forEach(cell => {
                            // Only tint if not already highlighted by line click
                            if (cell.square && !cell.square.getData('highlighted')) {
                                cell.square.setTint(CONFIG.HOVER_TINT_COLOR);
                                cell.square.setData('hoverTinted', true);
                            }
                        });
                    }
                }
            }
        });

        wordContainer.on('pointerout', () => {
            if (!wordContainer.getData('placed')) {
                // Remove scale effect if it was enabled
                if (CONFIG.HOVER_SCALE_ENABLED) {
                    this.tweens.add({
                        targets: wordContainer,
                        scale: 1.0,
                        duration: 150,
                        ease: 'Power2'
                    });
                }

                // Clear tint only from cells that were hover-tinted (not line-click highlighted)
                if (CONFIG.HOVER_TINT_ENABLED) {
                    const cells = wordContainer.getData('wordCells');
                    if (cells) {
                        cells.forEach(cell => {
                            if (cell.square && cell.square.getData('hoverTinted') && !cell.square.getData('highlighted')) {
                                cell.square.clearTint();
                                cell.square.setData('hoverTinted', false);
                            }
                        });
                    }
                }
            }
        });

        let dragOffset = { x: 0, y: 0 };
        wordContainer.on('dragstart', (pointer) => {
            if (this.autopilotInProgress) return;

            // Enable slot drop zones for dragging
            this.enableSlotDropZones();

            // Reset scale and clear tint when dragging starts
            wordContainer.setScale(1.0);
            this.tweens.killTweensOf(wordContainer);

            // Clear tint from all cells
            const cells = wordContainer.getData('wordCells');
            if (cells) {
                cells.forEach(cell => {
                    if (cell.square) cell.square.clearTint();
                });
            }

            if (this.tutorialManager) {
                this.tutorialManager.cleanup();
            }

            dragOffset.x = pointer.x - wordContainer.x;
            dragOffset.y = pointer.y - wordContainer.y;
            wordContainer.setDepth(2000);

            const stateMachine = wordContainer.getData('stateMachine');
            if (stateMachine && stateMachine.isPlacing()) {
                const originalWord = wordContainer.getData('originalWordBeforeTransform');
                if (originalWord) {
                    this.resetWordToOriginal(wordContainer, originalWord);
                }
                stateMachine.onDragStart();
            }

            // Remove from slot and delete correlated words
            if (wordContainer.getData('placed')) {
                const slotIdx = wordContainer.getData('slotIdx');
                // Store which slot this word is being dragged FROM for mistake tracking
                wordContainer.setData('draggedFromSlotIdx', slotIdx);
                this.removeWordFromSlot(slotIdx);
                wordContainer.setData('placed', false);
                wordContainer.setData('slotIdx', null);
                wordContainer.setData('isInduced', false);
                // Increment undo count when user drags word back from slot
                this.undoCount++;
            }
        });

        wordContainer.on('drag', (pointer, dragX, dragY) => {
            wordContainer.x = pointer.x - dragOffset.x;
            wordContainer.y = pointer.y - dragOffset.y;
        });

        wordContainer.on('dragend', (pointer, dragX, dragY, dropped) => {
            // Disable slot drop zones after dragging
            this.disableSlotDropZones();

            wordContainer.setDepth(100);
            if (!dropped) {
                // Not dropped on a slot - return to exact same bank position as original
                const initPos = wordContainer.getData('initPosition');

                // Check if this is a mistake (word was dragged from a slot and dropped outside)
                const draggedFromSlotIdx = wordContainer.getData('draggedFromSlotIdx');
                if (draggedFromSlotIdx !== undefined && draggedFromSlotIdx !== null) {
                    this.mistakeCount++;
                    console.log(`Mistake: Word dragged from slot ${draggedFromSlotIdx} and dropped outside. Mistakes: ${this.mistakeCount}`);

                    // Decrement score if the word had earned points in that slot
                    const pointsEarnedInSlot = wordContainer.getData('pointsEarnedInSlot') || 0;
                    if (pointsEarnedInSlot > 0) {
                        this.currentScore = Math.max(0, this.currentScore - pointsEarnedInSlot);
                        this.updateScoreDisplay();
                    }

                    // Clear the tracking data
                    wordContainer.setData('draggedFromSlotIdx', null);
                    wordContainer.setData('pointsEarnedInSlot', 0);
                }

                this.tweens.add({
                    targets: wordContainer,
                    x: initPos.x,
                    y: initPos.y,
                    duration: 300,
                    ease: 'Power2',
                    onComplete: () => {
                        // Convert to normal bank word instead of destroying
                        wordContainer.setData('isInduced', false);
                        wordContainer.setData('placed', false);
                        wordContainer.setData('slotIdx', null);
                    }
                });
            }
        });

        // Add to bankSprites for tracking
        this.bankSprites.push(wordContainer);

        // Store reference in slot data
        targetSlotContainer.setData('inducedWordContainer', wordContainer);
    }

    // Show induced letter at specific index (called during animation)
    showInducedLetter(sourceSlotIdx, letterIndex) {
        const wordsRule = this.getWordsRule(sourceSlotIdx);
        if (!wordsRule) return;

        const correlatedSlots = this.getCorrelatedSlots(sourceSlotIdx);

        correlatedSlots.forEach(targetSlotIdx => {
            const targetSlotContainer = this.slotSprites[targetSlotIdx];
            if (!targetSlotContainer.getData('filling')) return;

            const wordContainer = targetSlotContainer.getData('inducedWordContainer');
            if (!wordContainer) return;

            const wordCells = wordContainer.getData('wordCells');
            const finalWord = targetSlotContainer.getData('targetWord');
            if (!wordCells || !finalWord) return;

            // Reveal both background square and letter together
            if (letterIndex >= 0 && letterIndex < wordCells.length) {
                const square = wordCells[letterIndex].square;
                const letter = wordCells[letterIndex].letter;

                // Show background cell texture
                if (square) {
                    square.setAlpha(1.0);
                }

                // Show letter
                if (letter) {
                    letter.setAlpha(1.0);
                }

                // Also update slot cell data
                const targetSlotCells = targetSlotContainer.getData('slotCells');
                const cell = targetSlotCells[letterIndex];
                cell.squareContainer.setData('filled', true);
                cell.squareContainer.setData('letter', finalWord[letterIndex]);
            }

            // Check if all letters are done
            if (letterIndex === finalWord.length - 1) {
                // All letters placed, finalize the slot
                targetSlotContainer.setData('filled', true);
                targetSlotContainer.setData('word', finalWord);
                targetSlotContainer.setData('filling', false);

                // DON'T play sound here (already played for source word)

                // Update hints and connections
                this.updateAllConstraintHints(true);
                this.updateConnectionHighlights();
            }
        });
    }

    // Show +10 point animation at cell position
    showPointAnimation(x, y, points) {
        // Skip animation if score system is disabled
        if (!CONFIG.ENABLE_SCORE_SYSTEM) return;

        // Create text at the exact cell position
        const pointText = this.add.text(x, y, `+${points}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#000000',
            stroke: '#ffffff',
            strokeThickness: 6,
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5, 0.5).setDepth(10002);

        // Animate: move up slightly and fade out
        this.tweens.add({
            targets: pointText,
            y: y - 100, // Move up 100 pixels (2x height)
            alpha: 0,  // Fade out
            duration: 2400,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                pointText.destroy();
            }
        });
    }

    // Update score display
    updateScoreDisplay() {
        if (CONFIG.ENABLE_SCORE_SYSTEM && this.scoreText) {
            this.scoreText.setText(`${this.currentScore}/${this.targetScore}`);
        }
    }

    tweenBackToBottom(gameObject) {
        // Check if this word was dragged from a slot and is being rejected
        const draggedFromSlotIdx = gameObject.getData('draggedFromSlotIdx');
        if (draggedFromSlotIdx !== undefined && draggedFromSlotIdx !== null) {
            // Word was dragged from a slot and rejected by another slot
            // Decrement score if the word had earned points in the previous slot
            const pointsEarnedInSlot = gameObject.getData('pointsEarnedInSlot') || 0;
            if (pointsEarnedInSlot > 0) {
                this.currentScore = Math.max(0, this.currentScore - pointsEarnedInSlot);
                this.updateScoreDisplay();
            }

            // Clear the tracking data
            gameObject.setData('draggedFromSlotIdx', null);
            gameObject.setData('pointsEarnedInSlot', 0);
        }

        this.tweens.add({
            targets: gameObject,
            x: gameObject.getData('initPosition').x,
            y: gameObject.getData('initPosition').y,
            duration: 200,
            ease: 'Power2'
        });
    }

    createGradientBackgrounds() {
        const { width, height } = this.sys.game.canvas;

        // Convert hex colors to integers
        const portraitTopColor = parseInt(CONFIG.PORTRAIT_BG_GRADIENT_TOP.replace('#', '0x'));
        const portraitBottomColor = parseInt(CONFIG.PORTRAIT_BG_GRADIENT_BOTTOM.replace('#', '0x'));

        // Portrait area gradient (covers entire 720x1280 canvas)
        // The outer gradient is handled by HTML body CSS for the flanks
        const portraitGradient = this.add.graphics();
        portraitGradient.fillGradientStyle(
            portraitTopColor,
            portraitTopColor,
            portraitBottomColor,
            portraitBottomColor,
            1 // Alpha
        );
        portraitGradient.fillRect(0, 0, width, height);
        portraitGradient.setDepth(-999); // Behind game elements
    }

    createAreas() {
        const { width, height } = this.sys.game.canvas;
        this.slotAreaY = 0;
        this.slotAreaHeight = height * 0.6;
        this.bankAreaY = this.slotAreaHeight;
        this.bankAreaHeight = height * 0.4;
    }

    // No longer creating dynamic textures - using square.png and square-stroke.png with tinting
    // This function now just returns colors for a group
    
    getCellFillColor(group = 0) {
        // Always return white fill color - tinting will be applied to the base white texture
        return 0xf7f7f7; // CELL_BG1_COLOR - white for all cells
    }

    // Get stroke color for a group
    getGroupStrokeColor(group) {
        if (group === 0 || group === undefined) {
            // Default group uses standard colors
            return {
                word: this.wordStrokeColor,
                slot: this.slotStrokeColor
            };
        }

        // Get color from SASHA_PALETTE (group 1 = index 0, group 2 = index 1, etc.)
        const paletteIndex = (group - 1) % CONFIG.SASHA_PALETTE.length;
        const tintColor = CONFIG.SASHA_PALETTE[paletteIndex].hex;
        const colorHex = parseInt(tintColor.replace('#', ''), 16);
        return {
            word: colorHex,
            slot: colorHex
        };
    }

    getLineColorFromGroup(group) {
        if (group === 0 || group === undefined) {
            // Default group uses standard line color
            return CONFIG.LINE_COLOR;
        }

        // Get color from SASHA_PALETTE (group 1 = index 0, group 2 = index 1, etc.)
        const paletteIndex = (group - 1) % CONFIG.SASHA_PALETTE.length;
        const tintColor = CONFIG.SASHA_PALETTE[paletteIndex].hex;
        return parseInt(tintColor.replace('#', ''), 16);
    }

    // Calculate maximum number of swap pairs in level
    calculateMaxSwapPairs() {
        if (!this.level.rules) return 0;

        let maxPairs = 0;
        this.level.rules.forEach(rule => {
            if (rule.type === 'word' && rule.op === 'swap' && rule.pairs) {
                maxPairs = Math.max(maxPairs, rule.pairs.length);
            }
        });

        return maxPairs;
    }

    // Get grayscale tint color for swap animation highlighting
    getSwapHighlightTint(pairIndex) {
        // Calculate grayscale value: 0.9, 0.7, 0.5, 0.3, etc.
        const grayValue = Phaser.Math.Clamp(0.7 - pairIndex * 0.2, 0, 1);
        const gray = Math.floor(255 * grayValue);
        return (gray << 16) | (gray << 8) | gray; // Convert to hex color
    }

    createUIElements() {
        const { width, height } = this.sys.game.canvas;

        // 1. Level number display at top center
        const levelNumber = this.currentLevelIndex + 1; // Convert to 1-indexed
        const levelText = this.add.text(width / 2, 30, `Level ${levelNumber}`, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#333333',
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5, 0).setDepth(10001);

        // 2. Step progress bar (only if more than one sublevel)
        if (this.totalSublevels > 1) {
            this.createStepProgressBar(width / 2, 95); // 30 + 30 + 35 = 95 (Level text top + Level text height + gap)
        }

        // 2.5. Callout block (if callout text exists in level data)
        let calloutBottomY = null;
        if (this.level.callout) {
            const calloutY = this.totalSublevels > 1 ? 135 + 30 : 80 + 30; // Below progress bar or level number
            calloutBottomY = this.createCalloutBlock(width / 2, calloutY, this.level.callout);
        }

        // 3. Score display below level number (only if score system is enabled)
        if (CONFIG.ENABLE_SCORE_SYSTEM) {
            let scoreY = this.totalSublevels > 1 ? 130 : 65; // Adjust position if progress bar exists
            // Further adjust if callout exists
            if (calloutBottomY !== null) {
                scoreY = calloutBottomY + 15; // 15px below callout
            }
            this.scoreText = this.add.text(width / 2, scoreY, `${this.currentScore}/${this.targetScore}`, {
                fontFamily: 'Arial, sans-serif',
                fontSize: '24px',
                fontWeight: '500',
                color: '#555555',
                resolution: window.devicePixelRatio || 2
            }).setOrigin(0.5, 0).setDepth(10001);
        }

        // 4. UI Buttons
        const buttonSize = 80; // Button display size
        const buttonGap = 50; // Gap between buttons
        const sideMargin = 20; // Distance from screen edge
        const bottomMargin = height * 0.20; // 10% from bottom

        // Hint button - right side, 10% from bottom
        const hintButton = this.add.image(width - sideMargin - buttonSize / 2, height - bottomMargin, 'hintButton')
            // .setDisplaySize(buttonSize, buttonSize)
            .setInteractive({ useHandCursor: true })
            .setDepth(10001);

        hintButton.on('pointerdown', () => {
            // TODO: Implement hint functionality
            console.log('Hint button clicked');
        });

        const hintBtnScale = buttonSize / hintButton.width;
        hintButton.setScale(hintBtnScale);
        // Skip button - right side, directly above hint button
        const skipButton = this.add.image(
            width - sideMargin - buttonSize / 2,
            height - bottomMargin - buttonSize - buttonGap,
            'skipButton'
        )
            // .setDisplaySize(buttonSize, buttonSize)
            .setInteractive({ useHandCursor: true })
            .setDepth(10001);

        skipButton.on('pointerdown', () => {
            // TODO: Implement skip functionality
            console.log('Skip button clicked');
        });
        const skipBtnScale = buttonSize / skipButton.width;
        skipButton.setScale(skipBtnScale);

        // Retry button - left side, symmetrically opposite to hint button
        const retryButton = this.add.image(sideMargin + buttonSize / 2, height - bottomMargin, 'retryButton')
            // .setDisplaySize(buttonSize, buttonSize)
            .setInteractive({ useHandCursor: true })
            .setDepth(10001);

        retryButton.on('pointerdown', () => {
            // Reload the current level (reset everything)
            this.scene.restart({ levelIndex: this.currentLevelIndex });
        });
        const retryBtnScale = buttonSize / retryButton.width;
        retryButton.setScale(retryBtnScale);
    }

    createCalloutBlock(centerX, centerY, calloutText) {
        const padding = 16;
        const iconSize = 48;
        const iconGap = 12;
        const maxWidth = this.sys.game.canvas.width * 0.85; // 85% of screen width
        
        // Create text to measure dimensions
        const textStyle = {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            fontWeight: '400',
            color: '#000000ff',
            resolution: window.devicePixelRatio || 2,
            wordWrap: { width: maxWidth - (padding * 2) - iconSize - iconGap }
        };
        
        const tempText = this.add.text(0, 0, calloutText, textStyle);
        const textWidth = tempText.width;
        const textHeight = tempText.height;
        tempText.destroy();
        
        // Calculate rectangle dimensions
        const rectWidth = Math.min(textWidth + (padding * 2) + iconSize + iconGap, maxWidth);
        const rectHeight = Math.max(textHeight + (padding * 2), iconSize + (padding * 2));
        
        // Create container for callout
        const calloutContainer = this.add.container(centerX, centerY);
        calloutContainer.setDepth(10001);
        
        // Create background rectangle with light color
        const bgRect = this.add.graphics();
        bgRect.fillStyle(0xFFF9E6, 1); // Light yellow background
        bgRect.lineStyle(1, 0xE8E0C8, 1); // Subtle border
        bgRect.fillRoundedRect(-rectWidth / 2, 0, rectWidth, rectHeight, 8);
        bgRect.strokeRoundedRect(-rectWidth / 2, 0, rectWidth, rectHeight, 8);
        calloutContainer.add(bgRect);
        
        // Add hint icon
        const hintIcon = this.add.image(
            -rectWidth / 2 + padding + iconSize / 2,
            rectHeight / 2,
            'hintIcon'
        ).setDisplaySize(iconSize, iconSize);
        calloutContainer.add(hintIcon);
        
        // Add text
        const text = this.add.text(
            -rectWidth / 2 + padding + iconSize + iconGap,
            padding,
            calloutText,
            textStyle
        ).setOrigin(0, 0);
        calloutContainer.add(text);
        
        // Return bottom Y position for subsequent UI element positioning
        return centerY + rectHeight;
    }

    createStepProgressBar(centerX, centerY) {
        // Create a container for the progress bar
        this.stepProgressBar = this.add.container(centerX, centerY);
        this.stepProgressBar.setDepth(10001);
        
        const circleRadius = 8;
        const circleGap = 90; // Tripled from 30 to 90
        const lineThickness = 2;
        const totalWidth = (this.totalSublevels - 1) * circleGap;
        
        // Starting X position (to center the progress bar)
        const startX = -totalWidth / 2;
        
        // Store circle and check mark references
        this.stepProgressBar.circles = [];
        this.stepProgressBar.checkMarks = [];
        
        // Create the horizontal line connecting all circles
        const lineGraphics = this.add.graphics();
        lineGraphics.lineStyle(lineThickness, 0x999999);
        lineGraphics.lineBetween(startX, 0, startX + totalWidth, 0);
        this.stepProgressBar.add(lineGraphics);
        this.stepProgressBar.lineGraphics = lineGraphics;
        
        // Create circles for each sublevel
        for (let i = 0; i < this.totalSublevels; i++) {
            const x = startX + i * circleGap;
            
            // Create circle
            const circle = this.add.graphics();
            circle.lineStyle(2, 0x999999);
            circle.fillStyle(0xcccccc); // Grey fill for incomplete
            circle.fillCircle(x, 0, circleRadius);
            circle.strokeCircle(x, 0, circleRadius);
            this.stepProgressBar.add(circle);
            this.stepProgressBar.circles.push(circle);
            
            // Create check mark (hidden initially)
            const checkMark = this.add.image(x, 0, 'greenCheck');
            checkMark.setDisplaySize(circleRadius * 2.2, circleRadius * 2.2);
            checkMark.setVisible(false);
            this.stepProgressBar.add(checkMark);
            this.stepProgressBar.checkMarks.push(checkMark);
        }
    }

    updateStepProgressBar() {
        if (!this.stepProgressBar || this.totalSublevels <= 1) return;
        
        // Update circles and check marks based on current sublevel
        for (let i = 0; i < this.totalSublevels; i++) {
            if (i < this.currentSublevelIndex) {
                // Completed sublevel - show check mark
                this.stepProgressBar.checkMarks[i].setVisible(true);
            } else {
                // Not yet completed
                this.stepProgressBar.checkMarks[i].setVisible(false);
            }
        }
        
        // Update the line color for completed portions
        const lineGraphics = this.stepProgressBar.lineGraphics;
        if (lineGraphics && this.currentSublevelIndex > 0) {
            lineGraphics.clear();
            
            const circleGap = 90; // Must match createStepProgressBar
            const totalWidth = (this.totalSublevels - 1) * circleGap;
            const startX = -totalWidth / 2;
            
            // Draw grey line for incomplete portion
            lineGraphics.lineStyle(2, 0x999999);
            lineGraphics.lineBetween(startX, 0, startX + totalWidth, 0);
            
            // Draw green line for completed portion
            if (this.currentSublevelIndex > 0) {
                const completedWidth = (this.currentSublevelIndex - 1) * circleGap;
                lineGraphics.lineStyle(2, 0x4CAF50); // Green color
                lineGraphics.lineBetween(startX, 0, startX + completedWidth, 0);
            }
        }
    }

    createPortraitBoundary() {
        const { width, height } = this.sys.game.canvas;

        // Draw a darker background outside the portrait area
        // Portrait area is 720x1280 centered in the canvas
        const portraitWidth = 720;
        const portraitHeight = 1280;

        // Calculate offsets if canvas is larger than portrait area
        const leftOffset = (width - portraitWidth) / 2;
        const topOffset = (height - portraitHeight) / 2;

        if (leftOffset > 0 || topOffset > 0) {
            // Draw darker background panels on sides
            const darkerBg = 0xd0e0f0; // Slightly darker blue-gray

            // Left panel
            if (leftOffset > 0) {
                const leftPanel = this.add.rectangle(0, 0, leftOffset, height, darkerBg);
                leftPanel.setOrigin(0, 0);
                leftPanel.setDepth(-1000);

                // Right panel
                const rightPanel = this.add.rectangle(width - leftOffset, 0, leftOffset, height, darkerBg);
                rightPanel.setOrigin(0, 0);
                rightPanel.setDepth(-1000);
            }

            // Top panel (only in the portrait area width)
            if (topOffset > 0) {
                const topPanel = this.add.rectangle(leftOffset, 0, portraitWidth, topOffset, darkerBg);
                topPanel.setOrigin(0, 0);
                topPanel.setDepth(-1000);

                // Bottom panel
                const bottomPanel = this.add.rectangle(leftOffset, height - topOffset, portraitWidth, topOffset, darkerBg);
                bottomPanel.setOrigin(0, 0);
                bottomPanel.setDepth(-1000);
            }
        }

        // Draw portrait boundary outline
        const portraitX = width / 2;
        const portraitY = height / 2;

        const boundaryGraphics = this.add.graphics();
        boundaryGraphics.lineStyle(3, 0xff6600, 0.8); // Orange border, semi-transparent
        boundaryGraphics.strokeRect(
            portraitX - portraitWidth / 2,
            portraitY - portraitHeight / 2,
            portraitWidth,
            portraitHeight
        );
        boundaryGraphics.setDepth(10000); // Above everything

        // Add label
        const labelText = this.add.text(
            portraitX,
            portraitY - portraitHeight / 2 - 20,
            'Portrait Area (720x1280)',
            {
                fontFamily: 'Arial, sans-serif',
                fontSize: '16px',
                color: '#ff6600',
                fontStyle: 'bold',
                backgroundColor: '#ffffff',
                padding: { x: 8, y: 4 }
            }
        );
        labelText.setOrigin(0.5, 1);
        labelText.setDepth(10001);
    }

    renderSlots() {
        this.slotSprites = [];
        const slotAreaWidth = this.sys.game.canvas.width;
        const slotAreaHeight = this.slotAreaHeight;

        this.level.slots.forEach((slot, slotIdx) => {
            let slotContainer = this.add.container();
            slotContainer.setDepth(10); // Slots at depth 10
            let slotCells = [];

            // First pass: Create all shadow layers and background images
            for (let i = 0; i < slot.length; i++) {
                let x = i * this.gridSize;
                let y = 0;

                // Create a sub-container for each square to hold both graphics and text
                let squareContainer = this.add.container(x, y);

                // Create shadow layers for depth effect using graphics with rounded corners
                const radius = CONFIG.SQUARE_RADIUS;

                // Bottom-right inner shadow (dark) - creates depth
                // let shadowDark = this.add.graphics();
                // shadowDark.fillStyle(0x000000, 0.35);
                // shadowDark.fillRoundedRect(-this.squareWidth / 2 + CONFIG.SHADOW_DARK_OFFSET, -this.squareWidth / 2 + CONFIG.SHADOW_DARK_OFFSET, 
                //     this.squareWidth, this.squareWidth, radius);

                // Secondary softer shadow for more depth
                let shadowMid = this.add.graphics();
                shadowMid.fillStyle(0x666666, 0.2);
                shadowMid.fillRoundedRect(-this.squareWidth / 2 + CONFIG.SHADOW_MID_OFFSET, -this.squareWidth / 2 + CONFIG.SHADOW_MID_OFFSET,
                    this.squareWidth, this.squareWidth, radius);

                // Top-left edge highlight for beveled look
                // let highlightEdge = this.add.graphics();
                // highlightEdge.fillStyle(0xffffff, 0);
                // highlightEdge.fillRoundedRect(-this.squareWidth / 2 - 2, -this.squareWidth / 2 - 2, 
                //     this.squareWidth - 4, this.squareWidth - 4, radius);

                // Get group from slot (default to 0)
                const slotGroup = slot.group !== undefined ? slot.group : 0;
                const strokeColors = this.getGroupStrokeColor(slotGroup);

                // Create fill image (square.png) - tint to light grey/white
                let square = this.add.image(0, 0, 'square');
                square.setDisplaySize(this.squareWidth, this.squareWidth);
                square.setTint(this.cellFillColor); // Light grey/white fill
                square.setAlpha(1.0); // Ensure full opacity

                // Create stroke image (square-stroke.png) on top - tint to stroke color
                let stroke = this.add.image(0, 0, 'square-stroke');
                stroke.setDisplaySize(this.squareWidth, this.squareWidth);
                stroke.setAlpha(1.0);
                stroke.setTint(strokeColors.slot); // Black/grey or group color
                
                stroke.setAlpha(1.0); // Ensure full opacity

                // Add shadows, square fill, and stroke (text will be added in second pass)
                // squareContainer.add(shadowDark);
                squareContainer.add(shadowMid);
                squareContainer.add(square);
                squareContainer.add(stroke);
                // squareContainer.add(highlightEdge);

                // Store data on the squareContainer (not the rectangle)
                squareContainer.setData({ slotIdx, squareIdx: i, filled: false, letter: null, group: slotGroup });
                squareContainer.setData('square', square);
                squareContainer.setData('stroke', stroke);

                // Add squareContainer to the slotContainer
                slotContainer.add(squareContainer);

                // Store cell object
                slotCells.push({
                    squareContainer: squareContainer,
                    // shadowDark: shadowDark,
                    shadowMid: shadowMid,
                    // highlightEdge: highlightEdge,
                    square: square,
                    stroke: stroke,
                    letterText: null, // Will be set in second pass
                    index: i
                });
            }

            // Second pass: Create all text elements (so they render above all squares)
            for (let i = 0; i < slot.length; i++) {
                const squareContainer = slotContainer.list[i];

                // Create the text centered at (0, 0) within the squareContainer
                let letterText = this.add.text(0, 0, '', {
                    fontFamily: this.letterFontFamily,
                    fontWeight: this.letterFontWeight,
                    fontSize: this.slotCellFontSize,
                    color: '#222',
                    resolution: window.devicePixelRatio || 2 // High resolution for crisp text
                }).setOrigin(0.5);

                squareContainer.add(letterText);
                squareContainer.setData('letterText', letterText);

                // Update cell object with letter reference
                slotCells[i].letterText = letterText;
            }

            // Store slotCells array on the slot container
            slotContainer.setData('slotCells', slotCells);

            // Add swap pair dots if this slot has a swap rule
            const slotRule = this.getSlotRule(slotIdx);
            if (slotRule && slotRule.op === 'swap' && slotRule.pairs) {
                // Dot positions: top-right, bottom-left, top-center, bottom-center
                var gapFactor = 12;
                const dotPositions = [
                    { x: this.squareWidth / 2 - gapFactor, y: -this.squareWidth / 2 + gapFactor }, // top-right
                    { x: -this.squareWidth / 2 + gapFactor, y: this.squareWidth / 2 - gapFactor }, // bottom-left
                    { x: 0, y: -this.squareWidth / 2 + gapFactor }, // top-center
                    { x: 0, y: this.squareWidth / 2 - gapFactor }  // bottom-center
                ];

                slotRule.pairs.forEach((pair, pairIdx) => {
                    if (pairIdx >= dotPositions.length) return; // Max 4 pairs

                    const dotPos = dotPositions[pairIdx];
                    const dotRadius = 3;
                    const dotColor = this.slotStrokeColor;

                    // Add dot to first position in pair
                    const idx1 = pair[0] - 1; // Convert to 0-based
                    if (idx1 >= 0 && idx1 < slot.length) {
                        const squareContainer1 = slotContainer.list[idx1];
                        const dot1 = this.add.circle(dotPos.x, dotPos.y, dotRadius, dotColor);
                        squareContainer1.add(dot1);
                    }

                    // Add dot to second position in pair
                    const idx2 = pair[1] - 1; // Convert to 0-based
                    if (idx2 >= 0 && idx2 < slot.length) {
                        const squareContainer2 = slotContainer.list[idx2];
                        const dot2 = this.add.circle(dotPos.x, dotPos.y, dotRadius, dotColor);
                        squareContainer2.add(dot2);
                    }
                });
            }

            // Position slot at anchor cell center, relative to grid origin
            const anchorCellPoints = Utils.getGridCellPoints(slot.anchorCol, slot.anchorRow, this.originX, this.originY, this.gridSize);
            slotContainer.setPosition(anchorCellPoints.center.x, anchorCellPoints.center.y);
            //shift slot by half grid for better alignment for odd slots
            if (this.level.shiftX) {
                slotContainer.x += this.gridSize / 2;
            }
            let extra = this.gridSize;
            // Make the entire slot container a dropzone
            slotContainer.setInteractive(new Phaser.Geom.Rectangle(
                -this.gridSize / 2 - extra / 2, -this.gridSize / 2 - extra / 2, slot.length * this.gridSize + extra, this.gridSize + extra
            ), Phaser.Geom.Rectangle.Contains);
            slotContainer.input.dropZone = true;
            // Disable drop zone initially - will be enabled during dragging to prevent overlap with line zones
            slotContainer.disableInteractive();

            const slotGroup = slot.group !== undefined ? slot.group : 0;
            slotContainer.setData('slotIdx', slotIdx);
            slotContainer.setData('group', slotGroup);
            slotContainer.setData('filled', false);
            slotContainer.setData('word', null);
            this.slotSprites.push(slotContainer);
        });

        // Add italic letter markers for correlated slots (words rules)
        this.addWordsRuleMarkers();
    }

    // Add italic letter markers to slots that are part of words rules
    addWordsRuleMarkers() {
        const rules = this.level.rules || [];
        const wordsRules = rules.filter(rule => rule.type === 'words' && rule.slots && rule.slots.length >= 2);

        const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']; // Support up to 8 different groups

        wordsRules.forEach((rule, ruleIndex) => {
            if (ruleIndex >= letters.length) return; // Skip if too many rules

            const markerLetter = letters[ruleIndex];

            rule.slots.forEach(slotIdx => {
                const slotContainer = this.slotSprites[slotIdx];
                if (!slotContainer) return;

                const bounds = slotContainer.getBounds();

                // Add italic letter marker to the left of the slot
                const marker = this.add.text(
                    bounds.left - 7.5,
                    bounds.centerY,
                    markerLetter,
                    {
                        fontFamily: 'Arial, sans-serif',
                        fontStyle: 'italic',
                        fontWeight: 'normal',
                        fontSize: '32px',
                        color: '#666666',
                        resolution: window.devicePixelRatio || 2
                    }
                ).setOrigin(1, 0.5);
                marker.setDepth(15);

                // Store marker for cleanup
                if (!this.slotMarkers) {
                    this.slotMarkers = [];
                }
                this.slotMarkers.push(marker);
            });
        });
    }

    // Check if a slot has a word-level rule (like opposite)
    getSlotRule(slotIdx) {
        const rules = this.level.rules || [];
        return rules.find(rule => rule.type === 'word' && rule.slot === slotIdx);
    }

    // Check if a slot has a words-level rule (correlation between slots)
    getWordsRule(slotIdx) {
        const rules = this.level.rules || [];
        return rules.find(rule => rule.type === 'words' && rule.slots && rule.slots.includes(slotIdx));
    }

    // Get other slots in a words rule
    getCorrelatedSlots(slotIdx) {
        const wordsRule = this.getWordsRule(slotIdx);
        if (wordsRule && wordsRule.slots) {
            return wordsRule.slots.filter(s => s !== slotIdx);
        }
        return [];
    }

    // Apply words transformation (correlation between slots)
    applyWordsTransformation(word, wordsRule) {
        if (!wordsRule || !wordsRule.op) return word;

        if (wordsRule.op === 'same') {
            return word;
        } else if (wordsRule.op === 'opposite') {
            const antonym = this.wordAntonymMap.get(word);
            return antonym || word;
        } else if (wordsRule.op === 'reverse') {
            return word.split('').reverse().join('');
        } else if (wordsRule.op.startsWith('swap')) {
            // Parse swap operation like "swap 3-4"
            const match = wordsRule.op.match(/swap\s+(\d+)-(\d+)/);
            if (match) {
                const letters = word.split('');
                const idx1 = parseInt(match[1]) - 1;
                const idx2 = parseInt(match[2]) - 1;
                if (idx1 >= 0 && idx1 < letters.length && idx2 >= 0 && idx2 < letters.length) {
                    const temp = letters[idx1];
                    letters[idx1] = letters[idx2];
                    letters[idx2] = temp;
                }
                return letters.join('');
            }
        }
        return word;
    }

    // Get the transformed word for a slot (apply opposite, reverse, or swap if rule exists)
    getTransformedWord(word, slotIdx) {
        const slotRule = this.getSlotRule(slotIdx);
        if (slotRule && slotRule.op === 'opposite') {
            const antonym = this.wordAntonymMap.get(word);
            return antonym || word;
        } else if (slotRule && slotRule.op === 'reverse') {
            // Reverse the word: LOOP becomes POOL
            return word.split('').reverse().join('');
        } else if (slotRule && slotRule.op === 'swap' && slotRule.pairs) {
            // Swap letters according to pairs: [[1,2],[3,4]] swaps positions 1-2 and 3-4
            const letters = word.split('');
            slotRule.pairs.forEach(pair => {
                const idx1 = pair[0] - 1; // Convert to 0-based index
                const idx2 = pair[1] - 1;
                if (idx1 >= 0 && idx1 < letters.length && idx2 >= 0 && idx2 < letters.length) {
                    // Swap
                    const temp = letters[idx1];
                    letters[idx1] = letters[idx2];
                    letters[idx2] = temp;
                }
            });
            return letters.join('');
        }
        return word;
    }

    renderBank() {
        const startY = this.bankAreaY + 40;
        const startX = this.sys.game.canvas.width / 2;
        // this.add.rectangle(startX, this.bankAreaY , 300, 1, 0x000000).setAlpha(0.5).setDepth(5);

        const verticalGap = this.squareWidth + 24;
        this.level.words.forEach((wordData, wordIdx) => {
            // Handle both string and object formats
            let word, wordGroup;
            if (typeof wordData === 'string') {
                word = wordData;
                wordGroup = 0; // Default group
            } else if (typeof wordData === 'object') {
                word = wordData.word || wordData.text || Object.keys(wordData)[0]; // Support various formats
                wordGroup = wordData.group !== undefined ? wordData.group : 0;
            }

            // Calculate word dimensions
            const wordWidth = word.length * this.gridSize;
            const halfWordWidth = wordWidth / 2;

            // Position container so word is centered
            
            let baseY = startY + wordIdx * verticalGap;
            let wordContainer = this.add.container(startX, baseY);
            let wordCells = [];

            const strokeColors = this.getGroupStrokeColor(wordGroup);

            // First, create all background squares and strokes and add them to container
            // Position children relative to container with offset for centering
            for (let i = 0; i < word.length; i++) {
                let x = i * this.gridSize - halfWordWidth + this.gridSize / 2;
                let y = 0;
                
                // Create fill image (square.png) - tint to light grey/white
                let square = this.add.image(x, y, 'square');
                square.setDisplaySize(this.squareWidth, this.squareWidth);
                
                square.setTint(this.cellFillColor); // Light grey/white fill
              
                // square.clearTint();
                square.setAlpha(1.0); // Ensure full opacity
                // square.setAlpha(0);
                square.setData({ wordIdx, letterIdx: i });
                wordContainer.add(square);

                // Create stroke image (square-stroke.png) on top - tint to stroke color
                let stroke = this.add.image(x, y, 'square-stroke');
                stroke.setDisplaySize(this.squareWidth, this.squareWidth);
                stroke.setTint(strokeColors.word); // Black/grey or group color
                stroke.setAlpha(1.0); // Ensure full opacity
                stroke.setData({ wordIdx, letterIdx: i });
                wordContainer.add(stroke);
                 if(i===0){
                    this.firstSquares.push(square);
                    this.firstStrokes.push(stroke);
                }
                // Store cell object with references
                wordCells.push({ square: square, stroke: stroke, letter: null, index: i });
            }

            // Then, create all letters and add them to container (so they render above all squares)
            for (let i = 0; i < word.length; i++) {
                let x = i * this.gridSize - halfWordWidth + this.gridSize / 2;
                let y = 0;
                let letter = this.add.text(x, y, word[i], {
                    fontFamily: this.letterFontFamily,
                    fontWeight: this.letterFontWeight,
                    fontSize: this.wordCellFontSize,
                    color: '#222',
                    resolution: window.devicePixelRatio || 2 // High resolution for crisp text
                }).setOrigin(0.5);
                wordContainer.add(letter);

                // Update cell object with letter reference
                wordCells[i].letter = letter;
            }

            wordContainer.setDepth(100);
            wordContainer.setData('initPosition', { x: startX, y: baseY });
            wordContainer.setData({ word, wordIdx, placed: false, origY: baseY, startX, group: wordGroup });
            wordContainer.setData('wordCells', wordCells); // Store wordCells array

            // Create and attach state machine to word container
            const stateMachine = new WordAnimationStateMachine(this, wordContainer);
            wordContainer.setData('stateMachine', stateMachine);

            // Interactive area centered on container
            wordContainer.setInteractive(
                new Phaser.Geom.Rectangle(
                    -halfWordWidth,
                    -this.gridSize / 2,
                    wordWidth,
                    this.gridSize
                ),
                Phaser.Geom.Rectangle.Contains);
            this.input.setDraggable(wordContainer);

            // Add hover effects for desktop (only when word is in bank, not placed)
            wordContainer.on('pointerover', () => {
                if (!wordContainer.getData('placed')) {
                    // Apply scale effect if enabled
                    if (CONFIG.HOVER_SCALE_ENABLED) {
                        this.tweens.add({
                            targets: wordContainer,
                            scale: 1.1,
                            duration: 150,
                            ease: 'Power2'
                        });
                    }

                    // Apply tint to all cells if enabled (but don't override line-click highlights)
                    if (CONFIG.HOVER_TINT_ENABLED) {
                        const cells = wordContainer.getData('wordCells');
                        if (cells) {
                            cells.forEach(cell => {
                                // Only tint if not already highlighted by line click
                                if (cell.square && !cell.square.getData('highlighted')) {
                                    cell.square.setTint(CONFIG.HOVER_TINT_COLOR);
                                    cell.square.setData('hoverTinted', true);
                                }
                            });
                        }
                    }
                }
            });

            wordContainer.on('pointerout', () => {
                if (!wordContainer.getData('placed')) {
                    // Remove scale effect if it was enabled
                    if (CONFIG.HOVER_SCALE_ENABLED) {
                        this.tweens.add({
                            targets: wordContainer,
                            scale: 1.0,
                            duration: 150,
                            ease: 'Power2'
                        });
                    }

                    // Clear tint only from cells that were hover-tinted (not line-click highlighted)
                    if (CONFIG.HOVER_TINT_ENABLED) {
                        const cells = wordContainer.getData('wordCells');
                        if (cells) {
                            cells.forEach(cell => {
                                if (cell.square && cell.square.getData('hoverTinted') && !cell.square.getData('highlighted')) {
                                    cell.square.clearTint();
                                    cell.square.setData('hoverTinted', false);
                                }
                            });
                        }
                    }
                }
            });

            let dragOffset = { x: 0, y: 0 };
            wordContainer.on('dragstart', (pointer) => {
                this.clearLineHighlight();

                // Enable slot drop zones for dragging
                this.enableSlotDropZones();

                // Clear connection line highlights when dragging starts (if feature enabled)
                if (CONFIG.ENABLE_LINE_CLICK_HIGHLIGHTING) {
                    this.clearWordBankHighlights();
                }

                // Reset scale and clear tint when dragging starts
                wordContainer.setScale(1.0);
                this.tweens.killTweensOf(wordContainer);

                // Clear tint from all cells
                const cells = wordContainer.getData('wordCells');
                if (cells) {
                    cells.forEach(cell => {
                        if (cell.square) cell.square.clearTint();
                    });
                }

                // Ignore if autopilot is in progress
                if (this.autopilotInProgress) return;

                // Hide tutorial when user starts interacting
                if (this.tutorialManager) {
                    this.tutorialManager.cleanup();
                }

                dragOffset.x = pointer.x - wordContainer.x;
                dragOffset.y = pointer.y - wordContainer.y;

                // Bring to front while dragging
                wordContainer.setDepth(2000);

                // Get state machine to handle drag start
                const stateMachine = wordContainer.getData('stateMachine');

                if (stateMachine) {

                    // If word is being placed, cancel all animations and reset
                    if (stateMachine.isPlacing()) {
                        const originalWord = wordContainer.getData('originalWordBeforeTransform');
                        if (originalWord) {
                            this.resetWordToOriginal(wordContainer, originalWord);
                        }
                    }

                    // Notify state machine of drag start (will cancel animations)
                    const wasCancelled = stateMachine.onDragStart();
                }

                // If this word was placed on a slot, remove it from that slot
                if (wordContainer.getData('placed')) {
                    const slotIdx = wordContainer.getData('slotIdx');
                    console.log(`Dragging placed word from slot ${slotIdx}`);
                    // Store which slot this word is being dragged FROM for mistake tracking
                    wordContainer.setData('draggedFromSlotIdx', slotIdx);

                    this.removeWordFromSlot(slotIdx);
                    // Clear placement data
                    wordContainer.setData('placed', false);
                    wordContainer.setData('slotIdx', null);
                    wordContainer.setData('animationsComplete', false);
                    wordContainer.setData('originalWordBeforeTransform', null);
                }
            });
            wordContainer.on('drag', (pointer, dragX, dragY) => {
                wordContainer.x = pointer.x - dragOffset.x;
                wordContainer.y = pointer.y - dragOffset.y;
            });
            wordContainer.on('dragend', (pointer, dragX, dragY, dropped) => {
                // Disable slot drop zones after dragging
                this.disableSlotDropZones();

                // Restore normal depth
                wordContainer.setDepth(100);

                if (!dropped) {
                    // Not dropped on a valid slot, animate back to original position
                    // Check if this is a mistake (word was dragged from a slot and dropped outside)
                    const draggedFromSlotIdx = wordContainer.getData('draggedFromSlotIdx');
                    if (draggedFromSlotIdx !== undefined && draggedFromSlotIdx !== null) {
                        this.mistakeCount++;
                        console.log(`Mistake: Word dragged from slot ${draggedFromSlotIdx} and dropped outside. Mistakes: ${this.mistakeCount}`);
                        wordContainer.setData('draggedFromSlotIdx', null);
                    }
                    // Make sure placement flags are cleared
                    wordContainer.setData('placed', false);
                    wordContainer.setData('slotIdx', null);
                    this.tweens.add({
                        targets: wordContainer,
                        x: startX,
                        y: baseY,
                        duration: 300,
                        ease: 'Power2'
                    });
                }
            });
            this.bankSprites.push(wordContainer);
        });

       
    }

    makeDraggable(wordGroup) {
        wordGroup.getChildren().forEach(child => {
            child.setInteractive();
        });
        this.input.setDraggable(wordGroup);
        wordGroup.on('dragstart', (pointer) => {
            this.selectedWord = wordGroup;
        });
        wordGroup.on('drag', (pointer, dragX, dragY) => {
            wordGroup.getChildren().forEach(child => {
                child.x += dragX - child.x;
                child.y += dragY - child.y;
            });
        });
        wordGroup.on('dragend', (pointer, dragX, dragY, dropped) => {
            // Reset all slot highlights when drag ends
            this.slotSprites.forEach(slotContainer => {
                const slotCells = slotContainer.getData('slotCells');
                slotCells.forEach(cell => {
                    if (cell.square && !cell.squareContainer.getData('filled')) {
                        cell.square.setStrokeStyle(this.slotStrokeWidth, this.slotStrokeColor); // Original stroke
                    }
                });
            });

            // Reset all connection lines
            this.connectionLines.forEach(line => {
                if (line.setStrokeStyle) { // Only for line objects, not text labels
                    const originalColor = line.getData('originalColor');
                    if (originalColor !== undefined) {
                        line.setStrokeStyle(3, originalColor); // Original color
                    }
                }
            });

            if (!dropped) {
                // Animate back to original position
                wordGroup.getChildren().forEach(child => {
                    this.tweens.add({
                        targets: child,
                        x: child.x,
                        y: wordGroup.getData('origY'),
                        duration: 300,
                        ease: 'Power2'
                    });
                });
            }
        });
    }

    renderSlotLabels() {
        // Render labels for word-level rules (like 'opposite', 'reverse', etc.)
        const rules = this.level.rules || [];

        rules.forEach(rule => {
            if (rule.type === 'word' && rule.slot !== undefined) {
                const slotIdx = rule.slot;
                const slotContainer = this.slotSprites[slotIdx];
                if (!slotContainer) return;

                // Get the label text based on operation
                let labelText = '';
                labelText = rule.op.charAt(0).toUpperCase() + rule.op.slice(1).toLowerCase();

                const swapArrow = '⇄'; // Unicode arrow

                // Add pairs information for swap operation
                if (rule.op === 'swap' && rule.pairs && rule.pairs.length > 0) {
                    const pairsText = rule.pairs.map(pair => `${pair[0]} ${swapArrow} ${pair[1]}`).join(' ');
                    labelText += ' ' + pairsText;
                }

                // Get slot bounds for positioning
                const bounds = slotContainer.getBounds();

                const labelPos = rule.labelPos !== undefined ? parseInt(rule.labelPos) : 0;

                let labelX, labelY;
                const sideGap = 11; // Gap for left/right positions
                const topBottomGap = -4; // Reduced gap for top/bottom positions

                // Calculate position based on labelPos
                switch (labelPos) {
                    case 1: // Right of slot
                        labelX = bounds.right + sideGap;
                        labelY = bounds.centerY;
                        break;
                    case 2: // Bottom of slot
                        labelX = bounds.centerX;
                        labelY = bounds.bottom + topBottomGap;
                        break;
                    case 3: // Left of slot
                        labelX = bounds.left - sideGap;
                        labelY = bounds.centerY;
                        break;
                    case 0: // Top of slot (default)
                    default:
                        labelX = bounds.centerX;
                        labelY = bounds.top - topBottomGap;
                        break;
                }

                // Create the label text
                const label = this.add.text(labelX, labelY, labelText, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '22px',
                    color: '#434343ff', // Grey color
                    resolution: window.devicePixelRatio || 2
                }).setDepth(15);

                // Set origin based on position for proper alignment
                if (labelPos === 3) {
                    // Left of slot - align right
                    label.setOrigin(1, 0.5);
                } else if (labelPos === 1) {
                    // Right of slot - align left
                    label.setOrigin(0, 0.5);
                } else if (labelPos === 2) {
                    // Bottom of slot - center horizontally, top align
                    label.setOrigin(0.5, 0);
                } else {
                    // Top of slot (default) - center horizontally, bottom align
                    label.setOrigin(0.5, 1);
                }
            }
        });
    }

    renderConnections() {
        // Support both 'rules' (new) and 'connections' (legacy)
        const rules = this.level.rules || this.level.connections || [];

        // Words rules are now marked with italic letters on slots (no lines/labels)

        // Render cell rules

        rules.forEach((rule, ruleIndex) => {
            //rule info ionly has cell rule(lines) and has type property 0 for 'same' and 1 for 'increment/decrement'
            const ruleInfo = this.parseRule(rule);
            if (!ruleInfo) return; // Skip invalid rules

            // Get line color from rule.group if present (only for cell type rules)
            const lineGroup = (rule.type === 'cell' && rule.group !== undefined) ? rule.group : 0;
            const connectionColor = this.getLineColorFromGroup(lineGroup);

            // Get the squareContainer from the slot
            const fromSquareContainer = this.slotSprites[ruleInfo.slotIdx].list[ruleInfo.squareIdx];
            const toSquareContainer = this.slotSprites[ruleInfo.toSlotIdx].list[ruleInfo.toSquareIdx];
            const fromPt = this.getSquareSideMidpoint(fromSquareContainer, ruleInfo.sideIdx);
            const toPt = this.getSquareSideMidpoint(toSquareContainer, ruleInfo.toSideIdx);
            let line = this.add.line(0, 0, fromPt.x, fromPt.y, toPt.x, toPt.y, connectionColor).setOrigin(0, 0).setLineWidth(3);
            line.setDepth(-100);
            // Store slot indices on the line for later reference
            line.setData('slotIdx', ruleInfo.slotIdx);
            line.setData('toSlotIdx', ruleInfo.toSlotIdx);
            line.setData('originalColor', connectionColor);
            line.setData('ruleInfo', ruleInfo); // Store the complete rule info
            line.setData('ruleIndex', ruleIndex); // Store the rule index

            this.connectionLines.push(line);

            // Make line interactive for click handling if feature is enabled
            if (ruleInfo.type === 0) {
                if (CONFIG.ENABLE_LINE_CLICK_HIGHLIGHTING) {

                    // Create an invisible interactive zone over the line for click detection
                    const hitWidth = 20; // Width of the clickable area
                    const lineLength = Math.sqrt(Math.pow(toPt.x - fromPt.x, 2) + Math.pow(toPt.y - fromPt.y, 2));
                    const angle = Math.atan2(toPt.y - fromPt.y, toPt.x - fromPt.x);

                    // Calculate midpoint of the line for proper zone centering
                    const midX = (fromPt.x + toPt.x) / 2;
                    const midY = (fromPt.y + toPt.y) / 2;

                    // Create an invisible rectangle zone for interaction, centered on the line's midpoint
                    const zone = this.add.zone(midX, midY, lineLength, hitWidth).setOrigin(0.5, 0.5);
                    zone.setRotation(angle);
                    zone.setInteractive({ useHandCursor: true });
                    zone.setDepth(-99); // Just above the line

                    // Store reference to the line
                    zone.setData('connectionLine', line);
                    zone.setData('ruleInfo', ruleInfo);


                    // Add hover effect for visual feedback
                    zone.on('pointerover', () => {
                        this.hoveredZone = zone; // Track hovered zone
                        // Only change width if line is not actively highlighted
                        if (this.activeHighlightLine !== line) {
                            line.setLineWidth(5);
                        }
                    });
                    zone.on('pointerout', () => {
                        this.hoveredZone = null; // Clear hovered zone
                        // Only reset if line is not actively highlighted
                        if (this.activeHighlightLine !== line) {
                            line.setLineWidth(3);
                        }
                    });

                    // Store zone for cleanup if needed
                    this.connectionLines.push(zone);

                }

            }


            // Draw directional arrows for incremental rules only (type 1)
            if (ruleInfo.type === 1 && ruleInfo.increment !== 0) {
                const isBidirectional = ruleInfo.direction === 'bi';
                this.drawConnectionArrow(fromPt, toPt, connectionColor, isBidirectional);
            }

            // If type 1 connection, add increment label
            if (ruleInfo.type === 1 && ruleInfo.increment !== 0) {
                const midX = (fromPt.x + toPt.x) / 2;
                const midY = (fromPt.y + toPt.y) / 2;

                // Calculate line angle and perpendicular offset
                const angle = Math.atan2(toPt.y - fromPt.y, toPt.x - fromPt.x);
                const isHorizontal = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));

                // Offset distance from the line
                const offset = 20;

                // Position label perpendicular to the line
                let labelX, labelY;
                if (isHorizontal) {
                    // For horizontal lines, place label above or below
                    labelX = midX;
                    labelY = midY - offset; // Place above the line
                } else {
                    // For vertical or diagonal lines, place label to the side
                    labelX = midX + offset; // Place to the right of the line
                    labelY = midY;
                }

                // Format increment as +1, -2, etc.
                const incrementText = ruleInfo.increment > 0 ? `+${ruleInfo.increment}` : `${ruleInfo.increment}`;

                // Create label with black text, no background
                const label = this.add.text(labelX, labelY, incrementText, {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '20px',
                    color: '#000000', // Black text
                    resolution: window.devicePixelRatio || 2
                }).setOrigin(0.5);
                label.setDepth(-50); // Above line, below words
                this.connectionLines.push(label); // Store for cleanup
            }
        });
    }

    parseRule(rule) {
        // Parse rule - can be either old string format or new object format
        if (typeof rule === 'string') {
            // Legacy format: "022-100" or "022-100-1-plus2"
            return this.decodeConn(rule);
        }

        // New object format
        if (rule.type === 'cell') {
            const result = {
                slotIdx: rule.a.slot,
                squareIdx: rule.a.cell,
                sideIdx: rule.a.side,
                toSlotIdx: rule.b.slot,
                toSquareIdx: rule.b.cell,
                toSideIdx: rule.b.side,
                type: 0,
                increment: 0,
                direction: rule.direction || 'uni', // Default to unidirectional
                group: rule.group // Store group for line coloring
            };

            // Parse operation
            if (rule.op === 'same' || rule.op === '=') {
                result.type = 0;
                result.increment = 0;
            } else if (rule.op.startsWith('+')) {
                result.type = 1;
                result.increment = parseInt(rule.op.substring(1));
            } else if (rule.op.startsWith('-')) {
                result.type = 1;
                result.increment = parseInt(rule.op);
            }

            return result;
        }

        // Word-level rules (like 'opposite') are handled separately by getSlotRule
        if (rule.type === 'word') {
            return null; // Not an error - these rules don't define cell connections
        }

        // Words-level rules (like correlation between slots) are handled separately by getWordsRule
        if (rule.type === 'words') {
            return null; // Not an error - these rules don't define cell connections
        }

        // Fallback for unknown format
        console.error('Unknown rule format:', rule);
        return null;
    }

    decodeConn(str) {
        // Parse connection string: "022-100" (type 0) or "022-100-1-plus2" (type 1 with +2)
        // This is kept for backward compatibility
        const parts = str.split('-');

        const result = {
            slotIdx: parseInt(parts[0][0]),
            squareIdx: parseInt(parts[0][1]),
            sideIdx: parseInt(parts[0][2]),
            toSlotIdx: parseInt(parts[1][0]),
            toSquareIdx: parseInt(parts[1][1]),
            toSideIdx: parseInt(parts[1][2]),
            type: 0, // Default type 0 (same letter)
            increment: 0 // For type 1 connections
        };

        // Check if there are additional parts for type 1
        if (parts.length > 2) {
            result.type = parseInt(parts[2]);

            // Parse increment value (e.g., "plus2", "minus1")
            if (parts.length > 3 && result.type === 1) {
                const incrementStr = parts[3];
                if (incrementStr.startsWith('plus')) {
                    result.increment = parseInt(incrementStr.substring(4));
                } else if (incrementStr.startsWith('minus')) {
                    result.increment = -parseInt(incrementStr.substring(5));
                }
            }
        }

        return result;
    }

    // Calculate the expected letter based on connection type
    calculateHintLetter(sourceLetter, increment) {
        if (increment === 0) return sourceLetter;

        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const sourceIndex = alphabet.indexOf(sourceLetter.toUpperCase());

        if (sourceIndex === -1) return sourceLetter; // Not a letter

        // Apply increment with wrapping
        let targetIndex = sourceIndex + increment;

        // Wrap around the alphabet
        while (targetIndex < 0) targetIndex += 26;
        while (targetIndex >= 26) targetIndex -= 26;

        return alphabet[targetIndex];
    }

    drawConnectionArrow(fromPt, toPt, color, isBidirectional) {
        // Don't draw any arrows for bidirectional connections
        if (isBidirectional) {
            return;
        }

        // Calculate angle from fromPt to toPt
        const angle = Math.atan2(toPt.y - fromPt.y, toPt.x - fromPt.x);
        const arrowSize = 15; // Increased by 50% from 10 to 15

        // Calculate midpoint of the line
        const midX = (fromPt.x + toPt.x) / 2;
        const midY = (fromPt.y + toPt.y) / 2;

        // Unidirectional: single arrow at midpoint pointing towards B
        this.drawArrowhead(midX, midY, angle, arrowSize, color);
    }

    drawArrowhead(x, y, angle, size, color) {
        // Draw a filled triangle arrowhead
        const arrow = this.add.graphics();
        arrow.fillStyle(color, 1);

        // Define triangle vertices (pointing right)
        const points = [
            { x: size, y: 0 },           // Tip
            { x: -size / 2, y: -size / 2 },  // Top corner
            { x: -size / 2, y: size / 2 }    // Bottom corner
        ];

        // Rotate and translate points
        const rotatedPoints = points.map(pt => ({
            x: x + pt.x * Math.cos(angle) - pt.y * Math.sin(angle),
            y: y + pt.x * Math.sin(angle) + pt.y * Math.cos(angle)
        }));

        // Draw the triangle
        arrow.beginPath();
        arrow.moveTo(rotatedPoints[0].x, rotatedPoints[0].y);
        arrow.lineTo(rotatedPoints[1].x, rotatedPoints[1].y);
        arrow.lineTo(rotatedPoints[2].x, rotatedPoints[2].y);
        arrow.closePath();
        arrow.fillPath();

        arrow.setDepth(-99); // Just above the line
        this.connectionLines.push(arrow);
    }

    getSquareSideMidpoint(squareContainer, sideIdx) {
        // Get the actual square graphics from the container
        const square = squareContainer.getData('square');
        // Use fixed square dimensions
        const width = this.squareWidth;
        const height = this.squareWidth;
        let localX = 0, localY = 0;
        switch (sideIdx) {
            case 0: // top
                localX = 0;
                localY = -height / 2;
                break;
            case 1: // right
                localX = width / 2;
                localY = 0;
                break;
            case 2: // bottom
                localX = 0;
                localY = height / 2;
                break;
            case 3: // left
                localX = -width / 2;
                localY = 0;
                break;
            default:
                localX = 0;
                localY = 0;
        }
        // Use the squareContainer's transform matrix to get world coordinates
        const matrix = squareContainer.getWorldTransformMatrix();
        const worldPoint = matrix.transformPoint(localX, localY);
        return { x: worldPoint.x, y: worldPoint.y };
    }

    // Check if placing a word would violate any constraint hints
    checkConstraintViolation(slotIdx, word) {
        const slotContainer = this.slotSprites[slotIdx];
        const slotCells = slotContainer.getData('slotCells');

        // Check each square for hint violations
        for (let i = 0; i < slotCells.length; i++) {
            const cell = slotCells[i];
            if (cell.letterText) {
                const hintLetter = cell.letterText.text.trim().toUpperCase();
                const wordLetter = word[i].toUpperCase();

                // If there's a hint and it doesn't match the word letter, it's a violation
                if (hintLetter && hintLetter !== wordLetter) {
                    return {
                        violated: true,
                        squareIdx: i,
                        expectedLetter: hintLetter,
                        actualLetter: wordLetter
                    };
                }
            }
        }
        // No violations found
        return { violated: false };
    }

    // Show visual feedback when a constraint is violated
    showConstraintViolationFeedback(slotIdx, squareIdx) {
        const slotContainer = this.slotSprites[slotIdx];
        const squareContainer = slotContainer.list[squareIdx];
        const square = squareContainer.getData('square');
        const letterText = squareContainer.getData('letterText');

        // Get the world position of the square container
        const matrix = squareContainer.getWorldTransformMatrix();
        const worldPos = matrix.transformPoint(0, 0);

        // Shake animation: move up and down quickly
        this.tweens.add({
            targets: squareContainer,
            y: squareContainer.y - 8, // Move up
            duration: 80,
            ease: 'Quad.easeOut',
            yoyo: true,
            repeat: 2, // Shake 3 times total (up-down-up-down-up-down)
            onComplete: () => {
                // Reset to original position
                squareContainer.y = squareIdx * 0; // Should be 0 for all squares in horizontal slots
            }
        });

        // Flash the square red briefly
        square.setTint(0xff6b6b);

        this.time.delayedCall(500, () => {
            square.clearTint();
        });

        // Make the hint text pulse/scale up briefly
        const originalScale = letterText.scale;
        this.tweens.add({
            targets: letterText,
            scale: 1.5,
            duration: 100,
            ease: 'Quad.easeOut',
            yoyo: true,
            repeat: 1
        });
    }

    // Update connection highlights for connected cells
    updateConnectionHighlights() {
        // First, clear all connection highlights (but preserve hint backgrounds)
        this.slotSprites.forEach(slotContainer => {
            slotContainer.list.forEach(squareContainer => {
                const square = squareContainer.getData('square');
                const letterText = squareContainer.getData('letterText');
                const hasHint = letterText && letterText.text && letterText.text.trim() !== '';

                if (square && !squareContainer.getData('filled')) {
                    // If cell has a hint, keep it green, otherwise reset to white
                    if (hasHint) {
                        square.setTint(this.connectionHighlightColor);
                    } else {
                        square.clearTint();
                    }
                }
            });
        });

        // Clear highlights from word containers (but preserve fill colors)
        this.bankSprites.forEach(wordContainer => {
            if (wordContainer.getData('placed')) {
                const word = wordContainer.getData('word');
                const wordCells = wordContainer.getData('wordCells');
                if (wordCells) {
                    wordCells.forEach(cell => {
                        // Reset fill (square) to white, keep stroke as is
                        if (cell.square) {
                            cell.square.setTint(this.cellFillColor); // Reset fill to white
                        }
                        // Stroke doesn't need to be reset here - it keeps its group color
                    });
                }
            }
        });

        // Apply highlights for active connections
        const rules = this.level.rules || this.level.connections || [];
        if (!rules || rules.length === 0) return;

        rules.forEach(rule => {
            const ruleInfo = this.parseRule(rule);
            if (!ruleInfo || ruleInfo.type === undefined) return; // Skip word-level or invalid rules

            const fromSlot = this.slotSprites[ruleInfo.slotIdx];
            const toSlot = this.slotSprites[ruleInfo.toSlotIdx];

            // Only highlight if at least one slot is filled
            if (fromSlot.getData('filled') || toSlot.getData('filled')) {
                // Highlight from slot cell (but only if it's already filled, otherwise wait for animation)
                const fromSquare = fromSlot.list[ruleInfo.squareIdx];
                const fromRect = fromSquare.getData('square');
                if (fromRect && fromSlot.getData('filled')) {
                    fromRect.setTint(this.connectionHighlightColor);
                }

                // Highlight to slot cell (but only if it's already filled, otherwise wait for animation)
                const toSquare = toSlot.list[ruleInfo.toSquareIdx];
                const toRect = toSquare.getData('square');
                if (toRect && toSlot.getData('filled')) {
                    toRect.setTint(this.connectionHighlightColor);
                }

                // Highlight word cell if placed on fromSlot
                if (fromSlot.getData('filled')) {
                    const wordContainer = this.bankSprites.find(wc =>
                        wc.getData('placed') && wc.getData('slotIdx') === ruleInfo.slotIdx
                    );
                    if (wordContainer) {
                        const wordCells = wordContainer.getData('wordCells');
                        if (wordCells && wordCells[ruleInfo.squareIdx]) {
                            const square = wordCells[ruleInfo.squareIdx].square;
                            if (square) {
                                square.setTint(this.connectionHighlightColor);
                            }
                        }
                    }
                }

                // Highlight word cell if placed on toSlot
                if (toSlot.getData('filled')) {
                    const wordContainer = this.bankSprites.find(wc =>
                        wc.getData('placed') && wc.getData('slotIdx') === ruleInfo.toSlotIdx
                    );
                    if (wordContainer) {
                        const wordCells = wordContainer.getData('wordCells');
                        if (wordCells && wordCells[ruleInfo.toSquareIdx]) {
                            const square = wordCells[ruleInfo.toSquareIdx].square;
                            if (square) {
                                square.setTint(this.connectionHighlightColor);
                            }
                        }
                    }
                }
            }
        });
    }

    // Highlight word cells that are placed over hint cells with green background
    highlightWordCellsOverHints() {
        this.bankSprites.forEach(wordContainer => {
            // Only check placed words
            if (!wordContainer.getData('placed')) return;
            
            const slotIdx = wordContainer.getData('slotIdx');
            if (slotIdx === undefined) return;
            
            const slotContainer = this.slotSprites[slotIdx];
            if (!slotContainer) return;
            
            const slotCells = slotContainer.getData('slotCells');
            const wordCells = wordContainer.getData('wordCells');
            
            if (!slotCells || !wordCells) return;
            
            // Check each word cell position against corresponding slot cell
            wordCells.forEach((wordCell, index) => {
                if (index >= slotCells.length) return;
                
                const slotCell = slotCells[index];
                const letterText = slotCell.squareContainer.getData('letterText');
                
                // Check if this slot position had a hint BEFORE the word was placed
                // (letterText exists and is not empty, but cell was not filled when hint was shown)
                const hadHint = letterText && letterText.text && letterText.text.trim() !== '';
                
                if (hadHint && wordCell.square) {
                    // Apply green tint to word cell's fill (square) because it sits over a hint cell
                    wordCell.square.setTint(this.connectionHighlightColor);
                }
            });
        });
    }

    // Update constraint hints for all slots based on connections
    updateAllConstraintHints(animate = true) {
        // Store current hints before clearing
        const previousHints = new Map();
        this.slotSprites.forEach((slotContainer, slotIdx) => {
            const slotSquares = slotContainer.list;
            slotSquares.forEach((squareContainer, squareIdx) => {
                const letterText = squareContainer.getData('letterText');
                if (letterText && letterText.text) {
                    previousHints.set(`${slotIdx}-${squareIdx}`, letterText.text);
                }
            });
        });

        // Clear all hint texts (but not filled cells)
        this.slotSprites.forEach(slotContainer => {
            const slotSquares = slotContainer.list;
            slotSquares.forEach(squareContainer => {
                const letterText = squareContainer.getData('letterText');
                const isFilled = squareContainer.getData('filled');
                if (letterText && !isFilled) {
                    letterText.setText('');
                    letterText.setScale(1); // Reset scale
                }
            });
        });

        // Now update hints based on rules with animation
        const rules = this.level.rules || this.level.connections || [];
        if (!rules || rules.length === 0) return;

        rules.forEach(rule => {
            const ruleInfo = this.parseRule(rule);
            if (!ruleInfo) return; // Skip invalid rules

            const fromSlot = this.slotSprites[ruleInfo.slotIdx];
            const toSlot = this.slotSprites[ruleInfo.toSlotIdx];

            // Check if fromSlot has a word placed
            if (fromSlot.getData('filled') && !toSlot.getData('filled')) {
                const fromSquares = fromSlot.list;
                const fromSquareContainer = fromSquares[ruleInfo.squareIdx];
                const sourceLetter = fromSquareContainer.getData('letter');

                // Calculate the hint letter based on connection type
                const hintLetter = this.calculateHintLetter(sourceLetter, ruleInfo.increment);

                // Get positions for animation
                const toSquares = toSlot.list;
                const toSquareContainer = toSquares[ruleInfo.toSquareIdx];
                const toLetterText = toSquareContainer.getData('letterText');

                if (toLetterText && hintLetter) {
                    // Check if this hint already existed
                    const hintKey = `${ruleInfo.toSlotIdx}-${ruleInfo.toSquareIdx}`;
                    const wasAlreadyVisible = previousHints.get(hintKey) === hintLetter;

                    if (wasAlreadyVisible) {
                        // Hint already existed, just set it without animation
                        toLetterText.setText(hintLetter);
                        toLetterText.setAlpha(0.5); // Half transparent for hints
                        // Reapply green background color
                        const hintRect = toSquareContainer.getData('square');
                        if (hintRect && !toSquareContainer.getData('filled')) {
                            hintRect.setTint(this.connectionHighlightColor);
                        }
                    } else {
                        // New hint - animate it only if animate is true
                        if (animate) {
                            this.animateHintCreation(fromSquareContainer, toSquareContainer, hintLetter, ruleInfo.sideIdx, ruleInfo.toSideIdx, toSquares[ruleInfo.toSquareIdx]);
                        } else {
                            // Just show instantly without animation
                            toLetterText.setText(hintLetter);
                            toLetterText.setAlpha(0.5); // Half transparent for hints
                            // Apply green background color
                            const hintRect = toSquareContainer.getData('square');
                            if (hintRect && !toSquareContainer.getData('filled')) {
                                hintRect.setTint(this.connectionHighlightColor);
                            }
                        }
                    }
                }
            }

            // Check if toSlot has a word placed - apply reverse hints
            // Arrow shows direction of increment, reverse direction always decrements
            if (toSlot.getData('filled') && !fromSlot.getData('filled')) {
                const toSquares = toSlot.list;
                const toSquareContainer = toSquares[ruleInfo.toSquareIdx];
                const sourceLetter = toSquareContainer.getData('letter');

                // Calculate hint for reverse direction
                let hintLetter;
                if (ruleInfo.direction === 'bi' && ruleInfo.type === 1) {
                    // Bidirectional incremental: both directions use same increment
                    hintLetter = this.calculateHintLetter(sourceLetter, ruleInfo.increment);
                } else {
                    // Unidirectional or same-letter: reverse direction uses negated increment
                    // If arrow shows +1 from A to B, then B to A uses -1
                    hintLetter = this.calculateHintLetter(sourceLetter, -ruleInfo.increment);
                }

                // Get positions for animation
                const fromSquares = fromSlot.list;
                const fromSquareContainer = fromSquares[ruleInfo.squareIdx];
                const fromLetterText = fromSquareContainer.getData('letterText');

                if (fromLetterText && hintLetter) {
                    // Check if this hint already existed
                    const hintKey = `${ruleInfo.slotIdx}-${ruleInfo.squareIdx}`;
                    const wasAlreadyVisible = previousHints.get(hintKey) === hintLetter;

                    if (wasAlreadyVisible) {
                        // Hint already existed, just set it without animation
                        fromLetterText.setText(hintLetter);
                        fromLetterText.setAlpha(0.5); // Half transparent for hints
                        // Reapply green background color
                        const hintRect = fromSquareContainer.getData('square');
                        if (hintRect && !fromSquareContainer.getData('filled')) {
                            hintRect.setTint(this.connectionHighlightColor);
                        }
                    } else {
                        // New hint - animate it only if animate is true
                        if (animate) {
                            // Get line color for this rule's group
                            const lineColor = this.getLineColorFromGroup(ruleInfo.group);
                            this.animateHintCreation(toSquareContainer, fromSquareContainer, hintLetter, ruleInfo.toSideIdx, ruleInfo.sideIdx, fromSquares[ruleInfo.squareIdx], lineColor);
                        } else {
                            // Just show instantly without animation
                            fromLetterText.setText(hintLetter);
                            fromLetterText.setAlpha(0.5); // Half transparent for hints
                            // Apply green background color
                            const hintRect = fromSquareContainer.getData('square');
                            if (hintRect && !fromSquareContainer.getData('filled')) {
                                hintRect.setTint(this.connectionHighlightColor);
                            }
                        }
                    }
                }
            }
        });
    }

    // Animate hint creation: particle travels along connection, then hint bounces in
    animateHintCreation(sourceSquareContainer, targetSquareContainer, letter, sourceSideIdx, targetSideIdx, hintSquareContainer = null, lineColor = 0x000000) {
        // Get world positions
        const sourcePos = this.getSquareSideMidpoint(sourceSquareContainer, sourceSideIdx);
        const targetPos = this.getSquareSideMidpoint(targetSquareContainer, targetSideIdx);

        // Calculate angle for arrow direction
        const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x);

        // Create an arrow (triangle) that travels along the connection
        const arrow = this.add.graphics();
        arrow.fillStyle(lineColor, 1);
        arrow.setDepth(1000); // Above everything

        // Draw triangle pointing in the direction of travel
        const arrowSize = 12;
        arrow.beginPath();
        arrow.moveTo(arrowSize, 0); // Point
        arrow.lineTo(-arrowSize / 2, -arrowSize / 2); // Top corner
        arrow.lineTo(-arrowSize / 2, arrowSize / 2); // Bottom corner
        arrow.closePath();
        arrow.fillPath();

        // Add white stroke
        arrow.lineStyle(2, 0xffffff, 1);
        arrow.strokePath();

        // Position and rotate arrow
        arrow.setPosition(sourcePos.x, sourcePos.y);
        arrow.setRotation(angle);

        // Store reference to source slot for cancellation tracking
        const sourceSlotIdx = sourceSquareContainer.parentContainer?.getData ?
            this.slotSprites.indexOf(sourceSquareContainer.parentContainer) : -1;

        if (sourceSlotIdx !== -1) {
            arrow.setData('sourceSlotIdx', sourceSlotIdx);
        }

        // Calculate travel duration based on distance
        const distance = Phaser.Math.Distance.Between(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);
        const duration = Math.max(300, Math.min(600, distance * 0.5)); // Between 300-600ms

        // Track this animation
        let cancelled = false;
        const arrowTween = this.tweens.add({
            targets: arrow,
            x: targetPos.x,
            y: targetPos.y,
            duration: duration,
            ease: 'Cubic.easeInOut',
            onUpdate: () => {
                // Pulse the arrow while traveling
                const progress = this.tweens.getTweensOf(arrow)[0]?.progress || 0;
                const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.2; // Subtle pulse
                arrow.setScale(scale);
            },
            onComplete: () => {
                // Check if animation was cancelled
                if (cancelled) {
                    arrow.destroy();
                    return;
                }

                // Remove from active animations tracking
                if (sourceSlotIdx !== -1) {
                    const slotAnimations = this.activeArrowAnimations.get(sourceSlotIdx);
                    if (slotAnimations) {
                        const index = slotAnimations.findIndex(a => a.arrow === arrow);
                        if (index !== -1) slotAnimations.splice(index, 1);
                    }
                }

                // Arrow reached destination - create burst effect at center of target cell
                const targetCellBounds = targetSquareContainer.getBounds();
                const targetCellCenter = {
                    x: targetCellBounds.centerX,
                    y: targetCellBounds.centerY
                };
                this.createBurstEffect(targetCellCenter.x, targetCellCenter.y);

                // Remove arrow
                arrow.destroy();

                // Apply green color to hint cell NOW (after arrow animation)
                if (hintSquareContainer) {
                    const hintRect = hintSquareContainer.getData('square');
                    if (hintRect && !hintSquareContainer.getData('filled')) {
                        hintRect.setTint(this.connectionHighlightColor);
                    }
                }

                // Now show the hint with bounce animation
                const targetLetterText = targetSquareContainer.getData('letterText');
                if (targetLetterText) {
                    targetLetterText.setText(letter);
                    targetLetterText.setAlpha(0.5); // Half transparent for hints
                    targetLetterText.setScale(0); // Start invisible

                    // Store reference for potential cancellation
                    targetLetterText.setData('hintBouncing', true);

                    // Bounce in animation
                    this.tweens.add({
                        targets: targetLetterText,
                        scale: 1.5,
                        duration: 200,
                        ease: 'Back.easeOut',
                        onComplete: () => {
                            // Settle to normal size
                            this.tweens.add({
                                targets: targetLetterText,
                                scale: 1,
                                duration: 150,
                                ease: 'Quad.easeInOut',
                                onComplete: () => {
                                    targetLetterText.setData('hintBouncing', false);
                                }
                            });
                        }
                    });
                }
            }
        });

        // Track this arrow animation for potential cancellation
        if (sourceSlotIdx !== -1) {
            if (!this.activeArrowAnimations.has(sourceSlotIdx)) {
                this.activeArrowAnimations.set(sourceSlotIdx, []);
            }
            this.activeArrowAnimations.get(sourceSlotIdx).push({
                arrow,
                tween: arrowTween,
                cancel: () => {
                    cancelled = true;
                    arrowTween.stop();
                    arrow.destroy();
                }
            });
        }
    }

    // Create a burst effect when particle reaches destination
    createBurstEffect(x, y) {
        // Play burst sound
        this.sound.play('burstSound', { volume: 0.5 });

        const particleCount = 8;
        const burstRadius = 40; // Doubled from 20

        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const burstParticle = this.add.circle(x, y, 6, 0x000000, 1); // Doubled from 3
            burstParticle.setDepth(1000); // Above everything

            const targetX = x + Math.cos(angle) * burstRadius;
            const targetY = y + Math.sin(angle) * burstRadius;

            this.tweens.add({
                targets: burstParticle,
                x: targetX,
                y: targetY,
                alpha: 0,
                scale: 0.5,
                duration: 300,
                ease: 'Quad.easeOut',
                onComplete: () => burstParticle.destroy()
            });
        }
    }

    // Remove a word from a slot
    removeWordFromSlot(slotIdx) {
        const slotContainer = this.slotSprites[slotIdx];
        if (!slotContainer) return;

        // Cancel any active arrow animations originating from this slot
        this.cancelArrowAnimationsFromSlot(slotIdx);

        // Also cancel arrow animations from correlated slots (if this is part of a words rule)
        const wordsRule = this.getWordsRule(slotIdx);
        if (wordsRule) {
            const correlatedSlots = this.getCorrelatedSlots(slotIdx);
            correlatedSlots.forEach(correlatedSlotIdx => {
                this.cancelArrowAnimationsFromSlot(correlatedSlotIdx);
            });
        }

        // Cancel any bouncing hint animations in all target slots
        this.cancelBouncingHintAnimations();

        // Remove correlated induced words if this slot is part of a words rule
        this.removeCorrelatedInducedWords(slotIdx);

        // Mark slot as empty
        slotContainer.setData('filled', false);
        slotContainer.setData('word', null);
        slotContainer.setData('originalWord', null);

        const slotCells = slotContainer.getData('slotCells');
        slotCells.forEach(cell => {
            cell.squareContainer.setData('filled', false);
            cell.squareContainer.setData('letter', null);
        });

        // Recalculate all constraint hints without animation
        this.updateAllConstraintHints(false);

        // Update connection highlights
        this.updateConnectionHighlights();
    }

    // Remove correlated words (works bidirectionally - removes twins)
    removeCorrelatedInducedWords(sourceSlotIdx) {
        const wordsRule = this.getWordsRule(sourceSlotIdx);
        if (!wordsRule) return;

        const sourceSlotContainer = this.slotSprites[sourceSlotIdx];
        const correlatedSlots = this.getCorrelatedSlots(sourceSlotIdx);

        correlatedSlots.forEach(targetSlotIdx => {
            const targetSlotContainer = this.slotSprites[targetSlotIdx];

            // Find the word in the target slot (could be induced or original)
            const wordContainer = this.bankSprites.find(wc =>
                wc.getData('placed') &&
                wc.getData('slotIdx') === targetSlotIdx
            );

            if (wordContainer) {
                // Remove from bankSprites array
                const index = this.bankSprites.indexOf(wordContainer);
                if (index > -1) {
                    this.bankSprites.splice(index, 1);
                }

                // Destroy the word container immediately (delete the twin)
                wordContainer.destroy();

                // Clear slot data
                targetSlotContainer.setData('filled', false);
                targetSlotContainer.setData('word', null);
                targetSlotContainer.setData('originalWord', null);
                targetSlotContainer.setData('filling', false);
                targetSlotContainer.setData('inducedWordContainer', null);

                const targetSlotCells = targetSlotContainer.getData('slotCells');
                targetSlotCells.forEach(cell => {
                    cell.squareContainer.setData('filled', false);
                    cell.squareContainer.setData('letter', null);
                });
            }
        });
    }

    // Cancel all arrow animations originating from a specific slot
    cancelArrowAnimationsFromSlot(slotIdx) {
        const animations = this.activeArrowAnimations.get(slotIdx);
        if (animations) {
            // Cancel all arrow animations for this slot
            animations.forEach(anim => {
                if (anim.cancel) anim.cancel();
            });
            // Clear the array
            this.activeArrowAnimations.set(slotIdx, []);
        }
    }

    // Cancel any hint letters that are currently bouncing
    cancelBouncingHintAnimations() {
        this.slotSprites.forEach(slotContainer => {
            const slotSquares = slotContainer.list;
            slotSquares.forEach(squareContainer => {
                const letterText = squareContainer.getData('letterText');
                if (letterText && letterText.getData('hintBouncing')) {
                    // Stop all tweens on this letter
                    this.tweens.killTweensOf(letterText);
                    // Clear the hint
                    letterText.setText('');
                    letterText.setScale(1);
                    letterText.setData('hintBouncing', false);
                    // Remove green tint
                    const square = squareContainer.getData('square');
                    if (square) {
                        square.clearTint();
                    }
                }
            });
        });
    }

    // Show feedback when hints are satisfied by placing a word
    showHintSatisfactionFeedback(slotIdx, word) {
        return;
        const slotContainer = this.slotSprites[slotIdx];
        const slotSquares = slotContainer.list;

        // Check which squares had hints before this word was placed
        // We need to find hints that match the placed word letters
        const rules = this.level.rules || this.level.connections || [];
        if (!rules || rules.length === 0) return;
        console.log('passed');
        // Track which squares in this slot had hints
        const squaresWithSatisfiedHints = [];

        rules.forEach(rule => {
            const ruleInfo = this.parseRule(rule);
            if (!ruleInfo) return;
            console.log('ppassed');

            // Check if this connection involves the slot we just filled
            if (ruleInfo.toSlotIdx === slotIdx) {
                // Check if the "from" slot is filled (meaning it created a hint in our slot)
                const fromSlot = this.slotSprites[ruleInfo.slotIdx];
                if (fromSlot.getData('filled')) {
                    // This square had a hint that is now satisfied
                    squaresWithSatisfiedHints.push(ruleInfo.toSquareIdx);
                }
            } else if (ruleInfo.slotIdx === slotIdx) {
                // Check if the "to" slot is filled
                const toSlot = this.slotSprites[ruleInfo.toSlotIdx];
                if (toSlot.getData('filled')) {
                    squaresWithSatisfiedHints.push(ruleInfo.squareIdx);
                }
            }
        });

        // Show satisfaction animation for each square with satisfied hints
        squaresWithSatisfiedHints.forEach((squareIdx, index) => {
            const squareContainer = slotSquares[squareIdx];
            const square = squareContainer.getData('square');

            // Delay each animation slightly for staggered effect
            this.time.delayedCall(index * 80, () => {
                // Get world position
                const matrix = squareContainer.getWorldTransformMatrix();
                const worldPos = matrix.transformPoint(0, 0);

                // Green flash on the square
                square.setTint(0xC8E6C9);

                this.time.delayedCall(400, () => {
                    square.clearTint();
                });

                // Checkmark particle animation
                const checkmark = this.add.text(worldPos.x, worldPos.y, '✓', {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '24px',
                    color: '#4CAF50',
                    fontStyle: 'bold',
                    resolution: window.devicePixelRatio || 2
                }).setOrigin(0.5);
                checkmark.setDepth(2000);
                checkmark.setAlpha(0);

                // Animate checkmark: fade in, scale up, float up, fade out
                this.tweens.add({
                    targets: checkmark,
                    alpha: 1,
                    scale: { from: 0.5, to: 1.2 },
                    y: worldPos.y - 30,
                    duration: 600,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        this.tweens.add({
                            targets: checkmark,
                            alpha: 0,
                            duration: 200,
                            onComplete: () => {
                                checkmark.destroy();
                            }
                        });
                    }
                });

                // Ring pulse effect
                const ring = this.add.circle(worldPos.x, worldPos.y, this.squareWidth / 2, 0x4CAF50, 0);
                ring.setStrokeStyle(3, 0x4CAF50, 0.8);
                ring.setDepth(1999);

                this.tweens.add({
                    targets: ring,
                    scale: { from: 0.8, to: 1.5 },
                    alpha: { from: 0.8, to: 0 },
                    duration: 500,
                    ease: 'Quad.easeOut',
                    onComplete: () => {
                        ring.destroy();
                    }
                });
            });
        });
    }

    // Show feedback on connection lines when both connected slots are filled
    showConnectionValidationFeedback(slotIdx) {
        return;
        const rules = this.level.rules || this.level.connections || [];
        if (!rules || rules.length === 0) return;

        rules.forEach((rule, ruleIndex) => {
            const ruleInfo = this.parseRule(rule);
            if (!ruleInfo) return;

            // Check if this connection involves the slot we just filled
            if (ruleInfo.slotIdx === slotIdx || ruleInfo.toSlotIdx === slotIdx) {
                const fromSlot = this.slotSprites[ruleInfo.slotIdx];
                const toSlot = this.slotSprites[ruleInfo.toSlotIdx];

                // Only show feedback if BOTH slots are now filled
                if (fromSlot.getData('filled') && toSlot.getData('filled')) {
                    // Verify the letters match according to connection type
                    const fromSquare = fromSlot.list[ruleInfo.squareIdx];
                    const toSquare = toSlot.list[ruleInfo.toSquareIdx];
                    const fromLetter = fromSquare.getData('letter');
                    const toLetter = toSquare.getData('letter');

                    // Calculate expected letter based on connection type
                    const expectedToLetter = this.calculateHintLetter(fromLetter, ruleInfo.increment);

                    if (fromLetter && toLetter && toLetter === expectedToLetter) {
                        // Connection is valid! Show feedback on the line
                        const connectionLine = this.connectionLines[ruleIndex];
                        if (connectionLine) {
                            // Add a slight delay for better timing
                            this.time.delayedCall(300, () => {
                                this.animateConnectionValidation(connectionLine, ruleInfo);
                            });
                        }
                    }
                }
            }
        });
    }

    // Animate a connection line to show it's validated
    animateConnectionValidation(connectionLine, connInfo) {
        // Get the original line properties
        const fromSquare = this.slotSprites[connInfo.slotIdx].list[connInfo.squareIdx];
        const toSquare = this.slotSprites[connInfo.toSlotIdx].list[connInfo.toSquareIdx];
        const fromPos = this.getSquareSideMidpoint(fromSquare, connInfo.sideIdx);
        const toPos = this.getSquareSideMidpoint(toSquare, connInfo.toSideIdx);

        // Create a green overlay line that pulses
        const validationLine = this.add.line(0, 0, fromPos.x, fromPos.y, toPos.x, toPos.y, 0x4CAF50)
            .setOrigin(0, 0)
            .setLineWidth(5)
            .setDepth(900)
            .setAlpha(0);

        // Pulse animation on the line
        this.tweens.add({
            targets: validationLine,
            alpha: 0.8,
            lineWidth: 6,
            duration: 300,
            ease: 'Quad.easeOut',
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                validationLine.destroy();
            }
        });

        // Create particles that travel along the line
        const particleCount = 3;
        for (let i = 0; i < particleCount; i++) {
            this.time.delayedCall(i * 150, () => {
                const particle = this.add.circle(fromPos.x, fromPos.y, 6, 0x4CAF50, 1);
                particle.setStrokeStyle(2, 0xffffff);
                particle.setDepth(1000);

                // Animate particle along the line
                this.tweens.add({
                    targets: particle,
                    x: toPos.x,
                    y: toPos.y,
                    duration: 400,
                    ease: 'Cubic.easeInOut',
                    onUpdate: () => {
                        // Pulse the particle
                        const progress = this.tweens.getTweensOf(particle)[0]?.progress || 0;
                        const scale = 1 + Math.sin(progress * Math.PI * 3) * 0.4;
                        particle.setScale(scale);
                    },
                    onComplete: () => {
                        // Small burst at the end
                        for (let j = 0; j < 4; j++) {
                            const angle = (Math.PI * 2 * j) / 4;
                            const sparkle = this.add.circle(toPos.x, toPos.y, 3, 0x4CAF50, 1);
                            sparkle.setDepth(1000);

                            this.tweens.add({
                                targets: sparkle,
                                x: toPos.x + Math.cos(angle) * 15,
                                y: toPos.y + Math.sin(angle) * 15,
                                alpha: 0,
                                scale: 0.3,
                                duration: 300,
                                ease: 'Quad.easeOut',
                                onComplete: () => sparkle.destroy()
                            });
                        }
                        particle.destroy();
                    }
                });
            });
        }

        // Add a satisfying "ding" effect with text
        const midX = (fromPos.x + toPos.x) / 2;
        const midY = (fromPos.y + toPos.y) / 2;

        const validText = this.add.text(midX, midY, '✓', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#4CAF50',
            fontStyle: 'bold',
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5);
        validText.setDepth(2000);
        validText.setAlpha(0);
        validText.setScale(0.5);

        this.tweens.add({
            targets: validText,
            alpha: 1,
            scale: 1.3,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: validText,
                    alpha: 0,
                    y: midY - 20,
                    duration: 400,
                    ease: 'Quad.easeIn',
                    onComplete: () => validText.destroy()
                });
            }
        });
    }

    // Autopilot: Try to automatically place an obvious word
    tryAutopilotPlacement() {
        if (this.autopilotInProgress) return;

        // Find a slot with hints that has only one matching unplaced word
        const obviousPlacement = this.findObviousPlacement();

        if (obviousPlacement) {
            this.autopilotInProgress = true;
            this.performAutopilotPlacement(obviousPlacement.slotIdx, obviousPlacement.word, obviousPlacement.wordContainer);
        }
    }

    // Find a slot with hints where only one unplaced word matches
    findObviousPlacement() {
        // Get all unplaced words
        const unplacedWords = this.bankSprites.filter(wc => !wc.getData('placed'));
        if (unplacedWords.length === 0) return null;

        // Check each empty slot
        for (let slotIdx = 0; slotIdx < this.slotSprites.length; slotIdx++) {
            const slotContainer = this.slotSprites[slotIdx];
            if (slotContainer.getData('filled')) continue; // Skip filled slots

            const slotSquares = slotContainer.list;

            // Check if this slot has any hints
            let hasHints = false;
            for (let sq of slotSquares) {
                const letterText = sq.getData('letterText');
                if (letterText && letterText.text.trim()) {
                    hasHints = true;
                    break;
                }
            }

            if (!hasHints) continue; // Skip slots without hints

            // Find matching words for this slot
            const matchingWords = [];
            for (let wordContainer of unplacedWords) {
                const word = wordContainer.getData('word');
                if (word.length !== slotSquares.length) continue; // Length mismatch

                // Check if word matches hints (considering antonym transformation)
                const transformedWord = this.getTransformedWord(word, slotIdx);
                const violation = this.checkConstraintViolation(slotIdx, transformedWord);

                if (!violation.violated) {
                    matchingWords.push({ word, wordContainer });
                }
            }

            // If exactly one word matches, this is an obvious placement
            if (matchingWords.length === 1) {
                return {
                    slotIdx,
                    word: matchingWords[0].word,
                    wordContainer: matchingWords[0].wordContainer
                };
            }
        }

        return null; // No obvious placement found
    }

    // Perform autopilot placement with animation
    performAutopilotPlacement(slotIdx, word, wordContainer) {
        const slotContainer = this.slotSprites[slotIdx];
        const dropZone = slotContainer;

        // Disable user input
        this.input.enabled = false;

        // Animate word to slot
        const snapDuration = 400; // Slightly slower for autopilot visibility
        this.tweens.add({
            targets: wordContainer,
            x: dropZone.x,
            y: dropZone.y,
            duration: snapDuration,
            ease: 'Power2',
            onComplete: () => {
                // Mark word as placed
                wordContainer.setData('placed', true);
                wordContainer.setData('slotIdx', slotIdx);

                // Get transformed word if needed
                const transformedWord = this.getTransformedWord(word, slotIdx);

                // Mark slot as filled
                const slotSquares = slotContainer.list;
                slotContainer.setData('filled', true);
                slotContainer.setData('word', transformedWord);
                slotContainer.setData('originalWord', word);
                slotSquares.forEach((squareContainer, i) => {
                    squareContainer.setData('filled', true);
                    squareContainer.setData('letter', transformedWord[i]);
                    const letterText = squareContainer.getData('letterText');
                    if (letterText) {
                        letterText.setAlpha(1.0);
                    }
                });

                // Play fill sound
                this.sound.play('fillSound');

                // Play sequential letter bounce animation
                this.playPlacementAnimation(wordContainer, () => {
                    // Check if we need transformation
                    const slotRule = this.getSlotRule(slotIdx);
                    const willTransform = slotRule && (slotRule.op === 'opposite' || slotRule.op === 'reverse' || slotRule.op === 'swap') && transformedWord !== word;

                    if (willTransform) {
                        // Apply transformation
                        this.applyWordTransformation(wordContainer, word, transformedWord, slotIdx, slotRule, () => {
                            this.completeAutopilotPlacement();
                        });
                    } else {
                        // Update hints and continue
                        this.updateAllConstraintHints(true);
                        this.updateConnectionHighlights();
                        this.completeAutopilotPlacement();
                    }
                });
            }
        });
    }

    // Complete autopilot placement and check for next obvious word
    completeAutopilotPlacement() {
        // Re-enable input
        this.input.enabled = true;
        this.autopilotInProgress = false;

        // Check win condition immediately after autopilot placement
        this.checkWinCondition();

        // Try to place another obvious word if available
        if (this.autopilotEnabled && !this.checkAllSlotsFilled()) {
            this.time.delayedCall(600, () => {
                this.tryAutopilotPlacement();
            });
        }
    }

    // Helper to check if all slots are filled without triggering win
    checkAllSlotsFilled() {
        return this.slotSprites.every(slotContainer => slotContainer.getData('filled') === true);
    }

    // Check if all slots are filled (win condition)
    checkWinCondition() {
        const allSlotsFilled = this.slotSprites.every(slotContainer => {
            return slotContainer.getData('filled') === true;
        });

        if (allSlotsFilled) {
            
            // Check if there are more sublevels
            if (this.currentSublevelIndex < this.totalSublevels - 1) {
                // More sublevels remaining - advance to next sublevel
                console.log(`Sublevel ${this.currentSublevelIndex + 1} complete! Moving to next sublevel...`);
                
                // Show simple feedback for sublevel completion
                this.showSublevelCompleteFeedback(() => {
                    // Move to next sublevel
                    this.currentSublevelIndex++;
                    this.updateStepProgressBar();
                    this.loadNextSublevel();
                });
            } else {
                // All sublevels complete - show win scene
                // Play success sound
                this.sound.play('successSound', { volume: 0.8 });
                
                this.scene.launch('WinScene', {
                    currentLevelIndex: this.currentLevelIndex,
                    totalLevels: this.totalLevels,
                    undoCount: this.undoCount,
                    mistakeCount: this.mistakeCount
                });
                // Pause the game scene
                this.scene.pause();
            }
        }
    }

    showSublevelCompleteFeedback(callback) {
        // Disable input during feedback
        this.input.enabled = false;
        
        // Create a simple "Great!" text feedback
        const { width, height } = this.sys.game.canvas;
        const feedbackText = this.add.text(width / 2, height / 2, 'Great!', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#4CAF50',
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5).setDepth(10002).setAlpha(0);
        
        // Fade in, hold, fade out
        this.tweens.add({
            targets: feedbackText,
            alpha: 1,
            duration: 200,
            ease: 'Power2',
            yoyo: true,
            hold: 400,
            onComplete: () => {
                feedbackText.destroy();
                if (callback) callback();
            }
        });
    }

    loadNextSublevel() {
        // Clear all slots
        this.clearAllSlots();
        
        // Get next sublevel words
        const nextSublevelWords = this.allSublevels[this.currentSublevelIndex];
        
        // Clear word antonym map
        this.wordAntonymMap.clear();
        
        // Process new words (same as in create)
        this.level.words = nextSublevelWords.map(wordData => {
            // Handle both string and object formats
            if (typeof wordData === 'object' && wordData.opposite) {
                const word = wordData.word;
                const opposite = wordData.opposite;
                this.wordAntonymMap.set(word, opposite);
                this.wordAntonymMap.set(opposite, word);
                const result = { word: word };
                if (wordData.group !== undefined) {
                    result.group = wordData.group;
                }
                return result;
            } else if (typeof wordData === 'string' && wordData.includes('-')) {
                const [original, antonym] = wordData.split('-');
                this.wordAntonymMap.set(original, antonym);
                this.wordAntonymMap.set(antonym, original);
                return original;
            } else if (typeof wordData === 'object' && wordData.word && wordData.word.includes('-')) {
                const [original, antonym] = wordData.word.split('-');
                this.wordAntonymMap.set(original, antonym);
                this.wordAntonymMap.set(antonym, original);
                if (wordData.group !== undefined) {
                    return { word: original, group: wordData.group };
                }
                return original;
            }
            return wordData;
        });
        
        // Clear existing word bank sprites
        this.bankSprites.forEach(sprite => sprite.destroy());
        this.bankSprites = [];
        
        // Render new word bank
        this.renderBank();
        
        // Re-enable input
        this.time.delayedCall(300, () => {
            this.input.enabled = true;
        });
    }

    clearAllSlots() {
        // Clear all slots and reset their state
        this.slotSprites.forEach(slotContainer => {
            const wordContainer = slotContainer.getData('wordContainer');
            if (wordContainer) {
                // Kill any active tweens on the word container
                this.tweens.killTweensOf(wordContainer);
                // Return word to bank (we'll destroy it anyway)
                wordContainer.destroy();
                slotContainer.setData('wordContainer', null);
            }
            slotContainer.setData('filled', false);
            
            // Clear slot letters and reset visual state
            slotContainer.list.forEach(squareContainer => {
                // squareContainer is the container for each cell
                const letterText = squareContainer.getData('letterText');
                if (letterText) {
                    letterText.setText('');
                }
                
                // Get the square image from the squareContainer's data
                const square = squareContainer.getData('square');
                if (square) {
                    // Kill any active tweens on the square
                    this.tweens.killTweensOf(square);
                    // Clear tint
                    if (square.clearTint) {
                        square.clearTint();
                    }
                    // Reset data
                    square.setData('highlighted', false);
                }
                
                // Kill any tweens on the squareContainer itself
                this.tweens.killTweensOf(squareContainer);
                
                // Reset all data flags that might affect rendering
                squareContainer.setData('highlighted', false);
                squareContainer.setData('filled', false);
                squareContainer.setData('letter', null);
            });
        });
        
        // Clear any active highlights
        this.activeHighlightLine = null;
        
        // Update connection highlights (this will clear all hint visuals)
        this.updateConnectionHighlights();
    }

    // Play entrance animations for level start
    playEntranceAnimations() {
        // Check if entrance animations are enabled
        if (!CONFIG.LEVEL_START_ANIMATIONS) {
            this.input.enabled = true;
            return;
        }

        // Set connection lines to 0.3 alpha initially
        this.connectionLines.forEach(line => {
            line.setAlpha(0.3);
        });

        // Set all slot cells to 0.3 alpha initially
        this.slotSprites.forEach(slotContainer => {
            slotContainer.list.forEach(squareContainer => {
                squareContainer.setAlpha(0.3);
            });
        });

        // Start slot cells animations
        this.animateSlotCells();
    }

    // Animate slot cells all at once (fade-in animation)
    animateSlotCells() {
        const animDuration = 200;

        // All slots and all cells animate simultaneously
        this.slotSprites.forEach((slotContainer, slotIdx) => {
            slotContainer.list.forEach((squareContainer, cellIdx) => {
                this.tweens.add({
                    targets: squareContainer,
                    alpha: 1,
                    duration: animDuration,
                    ease: 'Linear'
                });
            });
        });

        // After all slot cells are animated, show connection lines
        this.time.delayedCall(animDuration + 100, () => {
            this.animateConnectionLines();
        });
    }

    // Handle connection line click - highlight matching word bank cells
    handleConnectionLineClick(ruleInfo, lineGraphics) {
        console.log('=== LINE CLICK HANDLER ===');
        console.log('Rule info:', ruleInfo);
        console.log('Line graphics:', lineGraphics);

        // Check if this line is already highlighted (toggle behavior)
        if (this.activeHighlightLine === lineGraphics && lineGraphics) {
            console.log('Toggling OFF - same line clicked');
            // Clear highlights and remove line emphasis
            this.clearWordBankHighlights();
            this.clearLineHighlight();
            this.activeHighlightLine = null;
            return;
        }


        // Clear any previous highlights
        this.clearWordBankHighlights();
        this.clearLineHighlight();

        // Store the active line and highlight it
        if (lineGraphics) {
            this.activeHighlightLine = lineGraphics;
            this.highlightLine(lineGraphics);
            console.log('Line highlighted successfully');
        } else {
            console.warn('lineGraphics is null/undefined - cannot highlight line visually');
        }

        // Decode the line rule to determine positions
        const pos1 = ruleInfo.squareIdx;  // Position in first slot
        const pos2 = ruleInfo.toSquareIdx; // Position in second slot

        console.log('Checking positions:', pos1, pos2);

        // Get all words in the bank (not placed)
        const bankWords = this.bankSprites.filter(wordContainer =>
            !wordContainer.getData('placed')
        );

        console.log('Bank words count:', bankWords.length);
        if (bankWords.length === 0) {
            console.log('No words in bank to highlight');
            return; // No words to highlight
        }

        // Group words by matching letters at the specified positions
        const groups = this.groupWordsByMatchingLetters(bankWords, pos1, pos2);

        console.log('Groups found:', groups.length);
        groups.forEach((group, idx) => {
            console.log(`Group ${idx}:`, group.map(w => `${w.wordContainer.getData('word')}[${w.position}]=${w.letter}`));
        });

        // Highlight each group with a different color from the palette
        groups.forEach((group, groupIndex) => {
            if (group.length < 2) {
                console.log(`Skipping group ${groupIndex} - only ${group.length} items`);
                return; // Only highlight groups with 2+ words
            }

            const colorIndex = groupIndex % CONFIG.SASHA_PALETTE.length;
            const tintColor = CONFIG.SASHA_PALETTE[colorIndex].tint;
            const tintColorHex = parseInt(tintColor.replace('#', ''), 16);

            console.log(`Applying color ${tintColor} (${tintColorHex}) to group ${groupIndex}`);

            // Highlight cells for each word in the group
            group.forEach(wordInfo => {
                this.highlightWordCell(wordInfo.wordContainer, wordInfo.position, tintColorHex);
            });
        });
    }

    // Group words by matching letters at specified positions
    // pos1 = position in first slot (x), pos2 = position in second slot (y)
    // Logic: For a line connecting position x to position y,
    // find all words where letter at position x matches letter at position y in another word
    groupWordsByMatchingLetters(bankWords, pos1, pos2) {
        console.log(`Grouping words for positions x=${pos1}, y=${pos2}`);

        // Step 1: Collect all letters at both positions
        const lettersAtPos1 = new Map(); // letter -> array of {wordContainer, wordIdx}
        const lettersAtPos2 = new Map(); // letter -> array of {wordContainer, wordIdx}

        bankWords.forEach((wordContainer, wordIdx) => {
            const word = wordContainer.getData('word');

            // Collect letter at pos1 (x position)
            if (pos1 < word.length) {
                const letter = word[pos1];
                if (!lettersAtPos1.has(letter)) {
                    lettersAtPos1.set(letter, []);
                }
                lettersAtPos1.get(letter).push({ wordContainer, wordIdx, position: pos1 });
            }

            // Collect letter at pos2 (y position)
            if (pos2 < word.length) {
                const letter = word[pos2];
                if (!lettersAtPos2.has(letter)) {
                    lettersAtPos2.set(letter, []);
                }
                lettersAtPos2.get(letter).push({ wordContainer, wordIdx, position: pos2 });
            }
        });

        console.log('Letters at pos1:', Array.from(lettersAtPos1.keys()));
        console.log('Letters at pos2:', Array.from(lettersAtPos2.keys()));

        // Step 2: For each letter, find groups where:
        // - One or more words have this letter at pos1
        // - One or more words have this letter at pos2
        // - These form a valid matching group
        const groups = [];
        const allLetters = new Set([...lettersAtPos1.keys(), ...lettersAtPos2.keys()]);

        allLetters.forEach(letter => {
            const wordsWithLetterAtPos1 = lettersAtPos1.get(letter) || [];
            const wordsWithLetterAtPos2 = lettersAtPos2.get(letter) || [];

            // Only include groups where:
            // 1. At least one word has this letter at pos1 
            // 2. At least one DIFFERENT word has this letter at pos2
            // This ensures we only highlight letters that can actually match across the connection

            if (wordsWithLetterAtPos1.length === 0 || wordsWithLetterAtPos2.length === 0) {
                // No match possible - need words at both positions
                return;
            }

            // Check if we have at least 2 different words involved
            const uniqueWordIndices = new Set();
            wordsWithLetterAtPos1.forEach(item => uniqueWordIndices.add(item.wordIdx));
            wordsWithLetterAtPos2.forEach(item => uniqueWordIndices.add(item.wordIdx));

            if (uniqueWordIndices.size < 2) {
                // Only one word has this letter at either position - not worth highlighting
                console.log(`Skipping letter '${letter}' - only appears in ${uniqueWordIndices.size} word(s)`);
                return;
            }

            // Create a group containing all cells with this letter at either position
            const group = [];

            // Add all words with this letter at pos1
            wordsWithLetterAtPos1.forEach(item => {
                group.push({
                    wordContainer: item.wordContainer,
                    position: item.position,
                    letter: letter,
                    wordIdx: item.wordIdx
                });
            });

            // Add all words with this letter at pos2
            wordsWithLetterAtPos2.forEach(item => {
                group.push({
                    wordContainer: item.wordContainer,
                    position: item.position,
                    letter: letter,
                    wordIdx: item.wordIdx
                });
            });

            console.log(`Group for letter '${letter}': ${wordsWithLetterAtPos1.length} at pos1, ${wordsWithLetterAtPos2.length} at pos2, ${uniqueWordIndices.size} unique words`);
            groups.push(group);
        });

        return groups;
    }

    // Highlight a specific cell in a word container
    highlightWordCell(wordContainer, letterIdx, tintColor) {
        console.log(`Highlighting word ${wordContainer.getData('word')} cell ${letterIdx} with color ${tintColor.toString(16)}`);
        const wordCells = wordContainer.getData('wordCells');
        if (!wordCells || letterIdx >= wordCells.length) {
            console.log('No wordCells or invalid letterIdx');
            return;
        }

        const cell = wordCells[letterIdx];
        if (cell && cell.square) {
            console.log('Applying tint to cell square');
            cell.square.setTint(tintColor);
            // Store that this cell is highlighted for later clearing
            cell.square.setData('highlighted', true);
        } else {
            console.log('Cell or cell.square not found');
        }
    }

    // Highlight the clicked line visually
    highlightLine(lineGraphics) {
        if (!lineGraphics) {
            console.warn('highlightLine called with null/undefined lineGraphics');
            return;
        }

        console.log('Highlighting line - current width:', lineGraphics.lineWidth);
        // Make the line thicker and change color to show it's active
        lineGraphics.setLineWidth(6);
        lineGraphics.setStrokeStyle(6, 0x4a90e2); // Blue color for active line
        console.log('Line set to width 6, color blue');
    }

    // Clear line highlight
    clearLineHighlight() {
        if (this.activeHighlightLine) {
            // Reset to original width and color
            const originalColor = this.activeHighlightLine.getData('originalColor');
            this.activeHighlightLine.setLineWidth(3);
            if (originalColor !== undefined) {
                this.activeHighlightLine.setStrokeStyle(3, originalColor);
            }
        }
    }

    // Enable slot drop zones (called when dragging starts)
    enableSlotDropZones() {
        if (this.slotSprites) {
            this.slotSprites.forEach(slotContainer => {
                slotContainer.setInteractive();
            });
        }
    }

    // Disable slot drop zones (called when dragging ends)
    disableSlotDropZones() {
        if (this.slotSprites) {
            this.slotSprites.forEach(slotContainer => {
                slotContainer.disableInteractive();
            });
        }
    }

    // Clear all word bank cell highlights
    clearWordBankHighlights() {
        this.bankSprites.forEach(wordContainer => {
            const wordCells = wordContainer.getData('wordCells');
            if (!wordCells) return;

            wordCells.forEach(cell => {
                if (cell.square && cell.square.getData('highlighted')) {
                    cell.square.clearTint();
                    cell.square.setData('highlighted', false);
                }
            });
        });
    }

    // Animate connection lines appearing
    animateConnectionLines() {
        let maxLineDelay = 0;

        this.connectionLines.forEach((line, idx) => {
            const delay = idx * 30;
            maxLineDelay = Math.max(maxLineDelay, delay);

            this.time.delayedCall(delay, () => {
                this.tweens.add({
                    targets: line,
                    alpha: 1,
                    duration: 200,
                    ease: 'Linear'
                });
            });
        });

        // After lines are complete, enable input
        this.time.delayedCall(maxLineDelay + 200 + 50, () => {
            this.input.enabled = true;
        });
    }
}

// Export for use in other scenes (like level viewer)
export default WordWebGame;

const config = {
    type: Phaser.WEBGL, // Use WebGL for better rendering quality
    parent: 'game-container',
    transparent: true,
// backgroundColor: null,
    // backgroundColor: 'transparent', // Using gradient backgrounds instead
    scene: [WordWebGame, WinScene],

    // Crisp rendering settings
    roundPixels: true, // Round positions to whole pixels for crisp rendering
    antialias: true, // Enable anti-aliasing for smooth edges

    scale: {
        mode: Phaser.Scale.FIT, // FIT mode works better in iframes
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 720, // Portrait mode - mobile first (9:16 aspect ratio)
        height: 1280,
        resolution: window.devicePixelRatio || 1, // Handle high DPI screens (Retina, 4K)
    },

    render: {
        antialiasGL: true, // WebGL anti-aliasing
        pixelArt: false, // Set to true only for retro pixel art games
    },
};

// Only create game instance if this is the main script (not imported)
if (typeof window !== 'undefined' && !window.__LEVEL_VIEWER__) {
    const game = new Phaser.Game(config);
}
