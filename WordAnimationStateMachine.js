// Word Animation State Machine
// Manages all animation states and sequences for word objects

/**
 * Word States:
 * - IN_BANK: Word is in the word bank, not being interacted with
 * - DRAGGING: Word is being dragged by the user
 * - SNAPPING: Word is snapping into a slot after drop
 * - TRANSFORMING: Word rule animations (swap, reverse, opposite)
 * - VALIDATING: Checking constraints
 * - ACCEPTED_ANIMATION: Sequential letter bounce animation (word accepted)
 * - HINT_ANIMATION: Showing connection arrows and hints
 * - PLACED: Word is successfully placed and all animations complete
 * - SNAP_BACK: Word failed validation and returning to bank
 * 
 * Note: Cancellation is an action/event, not a state. When animations are cancelled,
 * the word transitions directly to DRAGGING (if being dragged) or IN_BANK (if returned).
 */

export const WordState = {
    IN_BANK: 'IN_BANK',
    DRAGGING: 'DRAGGING',
    SNAPPING: 'SNAPPING',
    TRANSFORMING: 'TRANSFORMING',
    VALIDATING: 'VALIDATING',
    ACCEPTED_ANIMATION: 'ACCEPTED_ANIMATION',
    HINT_ANIMATION: 'HINT_ANIMATION',
    PLACED: 'PLACED',
    SNAP_BACK: 'SNAP_BACK'
};

export class WordAnimationStateMachine {
    constructor(scene, wordContainer) {
        this.scene = scene;
        this.wordContainer = wordContainer;
        this.currentState = WordState.IN_BANK;
        this.animationSequence = [];
        this.currentSequenceIndex = 0;
        this.activeTweens = [];
        this.isExecuting = false;
        this.context = {}; // Store context data for animations
        this.snapTween = null; // Track the snap tween separately
    }

    /**
     * Get current state
     */
    getState() {
        return this.currentState;
    }

    /**
     * Check if word is currently being placed into a slot
     * Returns true during: SNAPPING, TRANSFORMING, ACCEPTED_ANIMATION, HINT_ANIMATION
     */
    isPlacing() {
        return this.currentState === WordState.SNAPPING ||
               this.currentState === WordState.TRANSFORMING ||
               this.currentState === WordState.ACCEPTED_ANIMATION ||
               this.currentState === WordState.HINT_ANIMATION;
    }

    /**
     * Check if state machine is currently executing an animation sequence OR snap tween
     */
    isAnimating() {
        return (this.isExecuting && this.currentSequenceIndex < this.animationSequence.length) || 
               this.snapTween !== null;
    }

    /**
     * Set the snap tween to track it for cancellation
     */
    setSnapTween(tween) {
        this.snapTween = tween;
    }

    /**
     * Clear the snap tween reference (called when snap completes naturally)
     */
    clearSnapTween() {
        this.snapTween = null;
    }

    /**
     * Set callback to be called when snap completes
     */
    setSnapCompleteCallback(callback) {
        this.snapCompleteCallback = callback;
    }

    /**
     * Notify that snap has completed
     */
    notifySnapComplete() {
        if (this.snapCompleteCallback) {
            const callback = this.snapCompleteCallback;
            this.snapCompleteCallback = null;
            callback();
        }
    }

    /**
     * Transition to a new state
     */
    setState(newState) {
        console.log(`Word state: ${this.currentState} -> ${newState}`);
        this.currentState = newState;
    }

    /**
     * Define an animation sequence and start execution
     * @param {Array} sequence - Array of animation step objects
     * @param {Object} context - Context data needed by animations
     */
    startSequence(sequence, context = {}) {
        // Cancel any existing sequence
        this.cancelSequence();

        this.animationSequence = sequence;
        this.currentSequenceIndex = 0;
        this.context = { ...context };
        this.isExecuting = true;

        // Start executing the sequence
        this.playNextSequence();
    }

    /**
     * Execute the next step in the animation sequence
     */
    playNextSequence() {
        // Check if we're done with the sequence
        if (this.currentSequenceIndex >= this.animationSequence.length) {
            this.isExecuting = false;
            this.animationSequence = [];
            this.context = {};
            return;
        }

        // Get the current step
        const step = this.animationSequence[this.currentSequenceIndex];
        this.currentSequenceIndex++;

        // Update state
        if (step.state) {
            this.setState(step.state);
        }

        // Execute the step's action
        if (step.action && typeof step.action === 'function') {
            // Pass a callback to continue to next step
            const onComplete = () => {
                // Check if sequence was cancelled
                if (!this.isExecuting) return;
                
                // Continue to next step
                this.playNextSequence();
            };

            // Execute the action with context and completion callback
            step.action(this.context, onComplete);
        } else {
            // No action, just move to next step
            this.playNextSequence();
        }
    }

    /**
     * Cancel the current animation sequence and clean up all effects
     */
    cancelSequence() {
        const hadActiveSequence = this.isExecuting;
        const hadSnapTween = this.snapTween !== null;
        
        if (!hadActiveSequence && !hadSnapTween) {
            console.log('Nothing to cancel - no active sequence or snap tween');
            return; // Nothing to cancel
        }
        
        console.log(`Cancelling animations - Sequence: ${hadActiveSequence}, Snap: ${hadSnapTween}, Step: ${this.currentSequenceIndex}, State: ${this.currentState}`);
        
        // Mark as not executing (don't change state here - caller will set appropriate state)
        this.isExecuting = false;

        // Kill the snap tween if it exists
        if (this.snapTween) {
            this.snapTween.stop();
            this.snapTween = null;
        }

        // Kill all active tweens
        this.activeTweens.forEach(tween => {
            if (tween && tween.isPlaying && tween.isPlaying()) {
                tween.stop();
            }
        });
        this.activeTweens = [];

        // Kill all tweens on the word container
        this.scene.tweens.killTweensOf(this.wordContainer);

        // Kill all tweens on word cells (letters and squares)
        const wordCells = this.wordContainer.getData('wordCells');
        if (wordCells) {
            wordCells.forEach(cell => {
                if (cell.letter) {
                    this.scene.tweens.killTweensOf(cell.letter);
                    cell.letter.setScale(1);
                    cell.letter.setDepth(0);
                }
                if (cell.square) {
                    this.scene.tweens.killTweensOf(cell.square);
                    cell.square.setScale(1);
                    // Restore original texture if it was changed (e.g., swap highlight)
                    const originalTexture = cell.square.getData('originalTexture');
                    if (originalTexture) {
                        cell.square.setTexture(originalTexture);
                    }
                }
            });
        }

        // Cancel any placement animation tweens stored on container
        const placementTweens = this.wordContainer.getData('placementAnimationTweens');
        if (placementTweens) {
            placementTweens.forEach(tween => {
                if (tween && tween.isPlaying && tween.isPlaying()) {
                    tween.stop();
                }
            });
            this.wordContainer.setData('placementAnimationTweens', null);
        }

        // Clean up any hint animation artifacts if in HINT_ANIMATION state
        if (this.currentState === WordState.HINT_ANIMATION && this.context.slotIdx !== undefined) {
            this.cancelHintAnimations(this.context.slotIdx);
        }

        // Reset the sequence
        this.animationSequence = [];
        this.currentSequenceIndex = 0;
        this.context = {};
    }

    /**
     * Cancel hint animations (arrows, bursts, etc.) for a specific slot
     */
    cancelHintAnimations(slotIdx) {
        // Cancel arrow animations for this slot
        if (this.scene.activeArrowAnimations && this.scene.activeArrowAnimations.has(slotIdx)) {
            const animations = this.scene.activeArrowAnimations.get(slotIdx);
            animations.forEach(anim => {
                if (anim.cancel) anim.cancel();
            });
            this.scene.activeArrowAnimations.set(slotIdx, []);
        }

        // Cancel bouncing hint letters
        if (this.scene.slotSprites && this.scene.slotSprites[slotIdx]) {
            const slotContainer = this.scene.slotSprites[slotIdx];
            const slotSquares = slotContainer.list;
            slotSquares.forEach(squareContainer => {
                const letterText = squareContainer.getData('letterText');
                if (letterText && letterText.getData('hintBouncing')) {
                    this.scene.tweens.killTweensOf(letterText);
                    letterText.setText('');
                    letterText.setScale(1);
                    letterText.setData('hintBouncing', false);
                    const square = squareContainer.getData('square');
                    if (square) {
                        square.clearTint();
                    }
                }
            });
        }
    }

    /**
     * Register a tween for tracking
     */
    addTween(tween) {
        this.activeTweens.push(tween);
    }

    /**
     * Clean up and destroy the state machine
     */
    destroy() {
        this.cancelSequence();
        this.wordContainer = null;
        this.scene = null;
    }

    /**
     * Check if word can be dragged (not in middle of critical animation)
     */
    canDrag() {
        return this.currentState === WordState.IN_BANK || 
               this.currentState === WordState.PLACED;
    }

    /**
     * Handle drag start - cancel animations if needed
     */
    onDragStart() {
        const wasCancelled = this.isAnimating();
        
        if (wasCancelled) {
            this.cancelSequence();
        }

        this.setState(WordState.DRAGGING);
        return wasCancelled; // Return true if animations were cancelled
    }

    /**
     * Handle drag end - return to bank if not dropped on slot
     */
    onDragEnd(dropped) {
        if (!dropped) {
            this.setState(WordState.IN_BANK);
        }
    }

    /**
     * Reset to initial bank state
     */
    resetToBank() {
        this.cancelSequence();
        this.setState(WordState.IN_BANK);
    }
}

/**
 * Create animation sequences for common patterns
 */
export class AnimationSequenceBuilder {
    /**
     * Build sequence for word placement with transformation
     */
    static buildTransformationSequence(scene, wordContainer, slotIdx, transformedWord, slotRule) {
        const sequence = [
            {
                state: WordState.SNAPPING,
                action: (context, onComplete) => {
                    // Wait for snap tween to complete
                    const stateMachine = wordContainer.getData('stateMachine');
                    if (stateMachine) {
                        stateMachine.setSnapCompleteCallback(onComplete);
                    } else {
                        // Fallback if no state machine
                        onComplete();
                    }
                }
            },
            {
                state: WordState.TRANSFORMING,
                action: (context, onComplete) => {
                    // Apply word transformation (swap, reverse, opposite)
                    scene.applyWordTransformation(wordContainer, context.originalWord, transformedWord, slotIdx, slotRule, onComplete);
                }
            },
            {
                state: WordState.VALIDATING,
                action: (context, onComplete) => {
                    // Check constraints
                    const violationResult = scene.checkConstraintViolation(slotIdx, transformedWord);
                    if (violationResult.violated) {
                        console.log(`Constraint violation: expected "${violationResult.expectedLetter}", got "${violationResult.actualLetter}"`);
                        
                        // Reset word to original
                        scene.resetWordToOriginal(wordContainer, context.originalWord);
                        
                        // Show violation feedback
                        scene.showConstraintViolationFeedback(slotIdx, violationResult.squareIdx);
                        
                        // Mark context for return to bank
                        context.validationFailed = true;
                        onComplete();
                    } else {
                        // Mark as placed
                        scene.markWordAsPlaced(wordContainer, slotIdx, context.slotContainer, context.slotCells, context.originalWord, transformedWord, true);
                        context.validationFailed = false;
                        onComplete();
                    }
                }
            },
            {
                state: WordState.SNAP_BACK,
                action: (context, onComplete) => {
                    if (context.validationFailed) {
                        // Play invalid sound for constraint mismatch
                        scene.sound.play('invalidSound', { volume: 0.6 });
                        
                        // Return to bank
                        scene.tweenBackToBottom(wordContainer);
                        // After tween starts, update state
                        scene.time.delayedCall(200, () => {
                            const stateMachine = wordContainer.getData('stateMachine');
                            if (stateMachine) {
                                stateMachine.setState(WordState.IN_BANK);
                            }
                            onComplete();
                        });
                    } else {
                        // Skip this step, validation passed
                        onComplete();
                    }
                }
            },
            {
                state: WordState.ACCEPTED_ANIMATION,
                action: (context, onComplete) => {
                    if (!context.validationFailed) {
                        // Play tap sound - word is confirmed fit
                        scene.sound.play('fillSound');
                        
                        // Play placement animation
                        scene.playPlacementAnimation(wordContainer, onComplete);
                    } else {
                        onComplete();
                    }
                }
            },
            {
                state: WordState.HINT_ANIMATION,
                action: (context, onComplete) => {
                    if (!context.validationFailed) {
                        // Update hints and show arrows
                        scene.updateAllConstraintHints(true);
                        scene.updateConnectionHighlights();
                        scene.showConnectionValidationFeedback(slotIdx);
                        
                        // Delay before next action
                        scene.time.delayedCall(300, onComplete);
                    } else {
                        onComplete();
                    }
                }
            },
            {
                state: WordState.PLACED,
                action: (context, onComplete) => {
                    if (!context.validationFailed) {
                        // Mark animations complete
                        wordContainer.setData('animationsComplete', true);
                        wordContainer.setData('originalWordBeforeTransform', null);
                        
                        // Check autopilot and win condition
                        if (scene.autopilotEnabled && !scene.autopilotInProgress) {
                            scene.time.delayedCall(800, () => {
                                scene.tryAutopilotPlacement();
                            });
                        }
                        
                        // Check win condition immediately after animations complete
                        scene.checkWinCondition();
                    }
                    onComplete();
                }
            }
        ];

        return sequence;
    }

    /**
     * Build sequence for word placement without transformation
     */
    static buildSimplePlacementSequence(scene, wordContainer, slotIdx, word) {
        const sequence = [
            {
                state: WordState.SNAPPING,
                action: (context, onComplete) => {
                    // Wait for snap tween to complete
                    const stateMachine = wordContainer.getData('stateMachine');
                    if (stateMachine) {
                        stateMachine.setSnapCompleteCallback(onComplete);
                    } else {
                        // Fallback if no state machine
                        onComplete();
                    }
                }
            },
            {
                state: WordState.VALIDATING,
                action: (context, onComplete) => {
                    // Check constraints
                    const violationResult = scene.checkConstraintViolation(slotIdx, word);
                    if (violationResult.violated) {
                        console.log(`Constraint violation: expected "${violationResult.expectedLetter}", got "${violationResult.actualLetter}"`);
                        scene.showConstraintViolationFeedback(slotIdx, violationResult.squareIdx);
                        context.validationFailed = true;
                        onComplete();
                    } else {
                        // Mark as placed
                        scene.markWordAsPlaced(wordContainer, slotIdx, context.slotContainer, context.slotCells, word, word, false);
                        context.validationFailed = false;
                        onComplete();
                    }
                }
            },
            {
                state: WordState.SNAP_BACK,
                action: (context, onComplete) => {
                    if (context.validationFailed) {
                        // Play invalid sound for constraint mismatch
                        scene.sound.play('invalidSound', { volume: 0.6 });
                        
                        // Return to bank
                        scene.tweenBackToBottom(wordContainer);
                        // After tween starts, update state
                        scene.time.delayedCall(200, () => {
                            const stateMachine = wordContainer.getData('stateMachine');
                            if (stateMachine) {
                                stateMachine.setState(WordState.IN_BANK);
                            }
                            onComplete();
                        });
                    } else {
                        onComplete();
                    }
                }
            },
            {
                state: WordState.ACCEPTED_ANIMATION,
                action: (context, onComplete) => {
                    if (!context.validationFailed) {
                        // Play tap sound - word is confirmed fit
                        scene.sound.play('fillSound');
                        
                        // Play placement animation
                        scene.playPlacementAnimation(wordContainer, onComplete);
                    } else {
                        onComplete();
                    }
                }
            },
            {
                state: WordState.HINT_ANIMATION,
                action: (context, onComplete) => {
                    if (!context.validationFailed) {
                        // Update hints and show arrows
                        scene.updateAllConstraintHints(true);
                        scene.updateConnectionHighlights();
                        scene.showConnectionValidationFeedback(slotIdx);
                        
                        // Delay before next action
                        scene.time.delayedCall(300, onComplete);
                    } else {
                        onComplete();
                    }
                }
            },
            {
                state: WordState.PLACED,
                action: (context, onComplete) => {
                    if (!context.validationFailed) {
                        // Mark animations complete
                        wordContainer.setData('animationsComplete', true);
                        
                        // Check autopilot and win condition
                        if (scene.autopilotEnabled && !scene.autopilotInProgress) {
                            scene.time.delayedCall(800, () => {
                                scene.tryAutopilotPlacement();
                            });
                        }
                        
                        // Check win condition immediately after animations complete
                        scene.checkWinCondition();
                    }
                    onComplete();
                }
            }
        ];

        return sequence;
    }

    /**
     * Build sequence for returning word to bank
     */
    static buildReturnToBankSequence(scene, wordContainer) {
        const sequence = [
            {
                state: WordState.SNAP_BACK,
                action: (context, onComplete) => {
                    scene.tweenBackToBottom(wordContainer);
                    scene.time.delayedCall(200, onComplete);
                }
            },
            {
                state: WordState.IN_BANK,
                action: (context, onComplete) => {
                    onComplete();
                }
            }
        ];

        return sequence;
    }
}
