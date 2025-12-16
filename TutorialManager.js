// TutorialManager - Handles tutorial elements for levels
// Each level can define tutorial elements in its level data under the "tutorial" property
// This manager interprets tutorial data and creates/animates the elements

export default class TutorialManager {
    constructor(scene) {
        this.scene = scene;
        this.tutorialObjects = [];
    }

    /**
     * Create tutorial elements for a level based on its tutorial data
     * @param {Object} level - The level object containing tutorial property
     * @param {Array} slotSprites - Array of slot containers
     * @param {Array} bankSprites - Array of word containers
     */
    createTutorial(level, slotSprites, bankSprites) {
        // Clean up any existing tutorial elements
        this.cleanup();

        // Check if level has tutorial data
        if (!level.tutorial || !level.tutorial.elements) {
            return;
        }

        // Create each tutorial element
        level.tutorial.elements.forEach(element => {
            switch (element.type) {
                case 'text':
                    this.createTextElement(element, slotSprites, bankSprites);
                    break;
                case 'handAnimation':
                    this.createHandAnimation(element, slotSprites, bankSprites);
                    break;
                default:
                    console.warn(`Unknown tutorial element type: ${element.type}`);
            }
        });
    }

    /**
     * Create a text element positioned relative to a slot or word
     */
    createTextElement(element, slotSprites, bankSprites) {
        const position = this.getTargetPosition(element, slotSprites, bankSprites);
        if (!position) return;

        const style = element.style || {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#333',
            fontStyle: 'normal'
        };

        const text = this.scene.add.text(
            position.x,
            position.y + (element.offsetY || 0),
            element.text,
            style
        ).setOrigin(0.5).setDepth(1500);

        // Add a subtle pulse animation to draw attention
        this.scene.tweens.add({
            targets: text,
            alpha: 0.6,
            duration: 800,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        this.tutorialObjects.push(text);
    }

    /**
     * Create an animated hand icon that moves from word to slot
     */
    createHandAnimation(element, slotSprites, bankSprites) {
        const fromPos = this.getTargetPosition(
            { target: 'word', wordIndex: element.wordIndex },
            slotSprites,
            bankSprites
        );
        const toPos = this.getTargetPosition(
            { target: 'slot', slotIndex: element.slotIndex },
            slotSprites,
            bankSprites
        );

        if (!fromPos || !toPos) {
            console.error('Could not find positions for hand animation');
            return;
        }

        // Create hand sprite, visible from first frame
        const hand = this.scene.add.image(fromPos.x, fromPos.y, 'handPointer')
            .setScale(1)
            .setDepth(1500)
            .setAlpha(1);

        this.tutorialObjects.push(hand);

        // Animation parameters
        const duration = element.duration || 2000;
        // Remove initial delay for first cycle
        const repeat = element.repeat !== undefined ? element.repeat : -1;

        // Function to play the complete animation sequence
        const playAnimationSequence = () => {
            // Move to slot
            this.scene.tweens.add({
                targets: hand,
                x: toPos.x,
                y: toPos.y,
                duration: duration * 0.8,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    // Brief pause then instantly reset to bottom and repeat
                    this.scene.time.delayedCall(300, () => {
                        hand.setAlpha(1);
                        hand.setPosition(fromPos.x, fromPos.y);
                        if (repeat === -1) {
                            playAnimationSequence();
                        }
                    });
                }
            });
        };

        // Start the animation immediately
        playAnimationSequence();
    }

    /**
     * Get the screen position of a target (slot or word)
     */
    getTargetPosition(element, slotSprites, bankSprites) {
        if (element.target === 'slot' && element.slotIndex !== undefined) {
            const slotContainer = slotSprites[element.slotIndex];
            if (!slotContainer) return null;
            
            // Get the geometric center of the slot
            const bounds = slotContainer.getBounds();
            return {
                x: bounds.centerX,
                y: bounds.centerY
            };
        }

        if (element.target === 'word' && element.wordIndex !== undefined) {
            const wordContainer = bankSprites[element.wordIndex];
            if (!wordContainer) return null;
            
            // Get the geometric center of the word using getBounds
            const bounds = wordContainer.getBounds();
            return {
                x: bounds.centerX,
                y: bounds.centerY
            };
        }

        return null;
    }

    /**
     * Clean up all tutorial elements when level changes or tutorial is complete
     */
    cleanup() {
        this.tutorialObjects.forEach(obj => {
            if (obj && obj.destroy) {
                obj.destroy();
            } else if (obj && obj.stop) {
                // For timelines
                obj.stop();
            }
        });
        this.tutorialObjects = [];
    }

    /**
     * Hide tutorial elements temporarily (e.g., when user starts interacting)
     */
    hide() {
        this.tutorialObjects.forEach(obj => {
            if (obj.setVisible) {
                obj.setVisible(false);
            }
        });
    }

    /**
     * Show tutorial elements again
     */
    show() {
        this.tutorialObjects.forEach(obj => {
            if (obj.setVisible) {
                obj.setVisible(true);
            }
        });
    }
}
