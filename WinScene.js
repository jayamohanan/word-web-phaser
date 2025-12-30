// Win Scene for Word Web
// Displays when all slots are filled with valid words

class WinScene extends Phaser.Scene {
    constructor() {
        super('WinScene');
        
        // Random congratulatory messages
        this.winMessages = [
            'Boom!',
            'Clean Win!',
            'Perfect!',
            'So Smooth!',
            'Great Job!',
            'Well Done!',
            'Nailed It!',
            'Awesome!',
            'Brilliant!',
            'Success!',
            'Cool!',
            'Clever!',
            'Fantastic!',
            'Amazing!',
            'Bravo!'
        ];
    }

    init(data) {
        this.currentLevelIndex = data.currentLevelIndex || 0;
        this.totalLevels = data.totalLevels || 1;
        this.undoCount = data.undoCount || 0;
        this.mistakeCount = data.mistakeCount || 0;
    }

    create() {
        const { width, height } = this.sys.game.canvas;

        // Semi-transparent overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.5);
        overlay.setOrigin(0, 0);

        // Create confetti effect
        this.createConfetti(width, height);

        // Main container for win UI
        const winContainer = this.add.container(width / 2, height / 2);

        // Background panel for win message (larger)
        const panelWidth = 600;
        const panelHeight = 500;
        const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0xffffff);
        panel.setStrokeStyle(4, 0x333333);

        // Random win message
        const randomMessage = Phaser.Utils.Array.GetRandom(this.winMessages);
        
        // Create heading as plain text
        const headingText = this.add.text(0, -140, randomMessage, {
            fontFamily: CONFIG.LETTER_FONT_FAMILY || 'Arial',
            fontSize: '48px',
            color: '#333',
            fontStyle: 'bold',
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5);
        
        // Create mistake count text
        const mistakeText = this.add.text(0, -80, `Mistake${this.mistakeCount !== 1 ? 's' : ''}: ${this.mistakeCount}`, {
            fontFamily: CONFIG.LETTER_FONT_FAMILY || 'Arial',
            fontSize: '28px',
            color: '#666',
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5);
        
        // Create NEXT button with square cells (game style)
        const nextButtonContainer = this.createNextButton(0, 60);

        // Add all elements to the container
        winContainer.add([panel, headingText, mistakeText, nextButtonContainer]);

        // Animate the win container (scale up effect)
        winContainer.setScale(0);
        this.tweens.add({
            targets: winContainer,
            scale: 1,
            duration: 500,
            ease: 'Back.easeOut'
        });

        // Handle window resize
        this.scale.on('resize', this.resize, this);
    }

    createWordInCells(text, x, y, cellSize, gap) {
        const container = this.add.container(x, y);
        const letters = text.toUpperCase().split('');
        
        // Calculate total width to center the word
        const totalWidth = letters.length * cellSize + (letters.length - 1) * gap;
        const startX = -totalWidth / 2 + cellSize / 2;
        
        letters.forEach((letter, index) => {
            const cellX = startX + index * (cellSize + gap);
            
            // Create square cell (skip for spaces)
            if (letter !== ' ') {
                const square = this.add.rectangle(cellX, 0, cellSize, cellSize, 0xf7f7f7);
                square.setStrokeStyle(2, 0x333333);
                
                // Add letter text
                const letterText = this.add.text(cellX, 0, letter, {
                    fontFamily: CONFIG.LETTER_FONT_FAMILY || 'Arial',
                    fontSize: `${cellSize * 0.78}px`,
                    color: '#333',
                    fontStyle: 'bold',
                    resolution: window.devicePixelRatio || 2
                }).setOrigin(0.5);
                
                container.add([square, letterText]);
            }
        });
        
        return container;
    }

    createNextButton(x, y) {
        const container = this.add.container(x, y);
        const buttonLetters = ['N', 'E', 'X', 'T'];
        const cellSize = 60;
        const gap = 6;
        
        // Calculate total width to center the button
        const totalWidth = buttonLetters.length * cellSize + (buttonLetters.length - 1) * gap;
        const startX = -totalWidth / 2 + cellSize / 2;
        
        const buttonElements = [];
        
        buttonLetters.forEach((letter, index) => {
            const cellX = startX + index * (cellSize + gap);
            
            // Create square cell
            const square = this.add.rectangle(cellX, 0, cellSize, cellSize, 0xf7f7f7);
            square.setStrokeStyle(3, 0x333333);
            
            // Add letter text
            const letterText = this.add.text(cellX, 0, letter, {
                fontFamily: CONFIG.LETTER_FONT_FAMILY || 'Arial',
                fontSize: `${cellSize * 0.65}px`,
                color: '#333',
                fontStyle: 'bold',
                resolution: window.devicePixelRatio || 2
            }).setOrigin(0.5);
            
            buttonElements.push(square, letterText);
            container.add([square, letterText]);
        });
        
        // Make the entire container interactive
        const hitArea = new Phaser.Geom.Rectangle(-totalWidth / 2, -cellSize / 2, totalWidth, cellSize);
        container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        
        // Button hover effects - scale entire container to preserve gaps
        container.on('pointerover', () => {
            buttonElements.forEach(element => {
                if (element.type === 'Rectangle') {
                    element.setFillStyle(0xe0e0e0);
                }
            });
            container.setScale(1.05);
        });

        container.on('pointerout', () => {
            buttonElements.forEach(element => {
                if (element.type === 'Rectangle') {
                    element.setFillStyle(0xf7f7f7);
                }
            });
            container.setScale(1);
        });

        container.on('pointerdown', () => {
            container.setScale(0.95);
        });

        container.on('pointerup', () => {
            container.setScale(1.05);
            
            // Go to next level (loop back to first level if at the end)
            const nextLevelIndex = (this.currentLevelIndex + 1) % this.totalLevels;
            
            // Restart the game scene with the next level
            this.scene.start('WordWebGame', { levelIndex: nextLevelIndex });
        });
        
        return container;
    }

    createConfetti(width, height) {
        const confettiColors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3, 0xF38181, 0xAA96DA, 0xFCBAD3, 0xA8E6CF];
        const confettiCount = 100;
        
        // Create confetti pieces
        for (let i = 0; i < confettiCount; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(-height, 0);
            const size = Phaser.Math.Between(6, 12);
            const color = Phaser.Utils.Array.GetRandom(confettiColors);
            
            // Create confetti piece (small rectangle)
            const confetti = this.add.rectangle(x, y, size, size, color);
            confetti.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
            
            // Random fall animation
            const fallDuration = Phaser.Math.Between(2000, 4000);
            const fallDelay = Phaser.Math.Between(0, 1000);
            const endY = height + 50;
            const drift = Phaser.Math.Between(-100, 100);
            
            this.tweens.add({
                targets: confetti,
                y: endY,
                x: x + drift,
                rotation: confetti.rotation + Phaser.Math.FloatBetween(Math.PI * 2, Math.PI * 6),
                duration: fallDuration,
                delay: fallDelay,
                ease: 'Linear',
                onComplete: () => {
                    confetti.destroy();
                }
            });
        }
    }

    resize(gameSize) {
        const { width, height } = gameSize;
        
        // Update overlay size if needed
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
}

export default WinScene;
