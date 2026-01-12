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
        // Save level progress when level is completed
        this.saveLevelProgress(this.currentLevelIndex);

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
        const headingText = this.add.text(0, -100, randomMessage, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '48px',
            color: '#333',
            fontStyle: 'bold',
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5);
        
        // Create NEXT button with square cells (game style)
        const nextButtonContainer = this.createNextButton(0, 60);

        // Add all elements to the container
        winContainer.add([panel, headingText, nextButtonContainer]);

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
                    fontFamily: 'Arial, sans-serif',
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
        const padding = 15; // Padding around the cells
        const cornerRadius = 3; // Rounded corner radius
        
        // Calculate total width of cells
        const totalCellsWidth = buttonLetters.length * cellSize + (buttonLetters.length - 1) * gap;
        const startX = -totalCellsWidth / 2 + cellSize / 2;
        
        // Outer rectangle dimensions (with padding)
        const outerWidth = totalCellsWidth + (padding * 2);
        const outerHeight = cellSize + (padding * 2);
        
        // Create outer rounded rectangle background
        const outerRect = this.add.graphics();
        outerRect.fillStyle(0xf7f7f7, 1);
        outerRect.fillRoundedRect(-outerWidth / 2, -outerHeight / 2, outerWidth, outerHeight, cornerRadius);
        outerRect.lineStyle(3, 0x333333, 1);
        outerRect.strokeRoundedRect(-outerWidth / 2, -outerHeight / 2, outerWidth, outerHeight, cornerRadius);
        container.add(outerRect);
        
        // Create N E X T cells (visual only, no interaction)
        buttonLetters.forEach((letter, index) => {
            const cellX = startX + index * (cellSize + gap);
            
            // Create square cell
            const square = this.add.rectangle(cellX, 0, cellSize, cellSize, 0xf7f7f7);
            square.setStrokeStyle(3, 0x333333);
            
            // Add letter text
            const letterText = this.add.text(cellX, 0, letter, {
                fontFamily: 'Arial, sans-serif',
                fontSize: `${cellSize * 0.65}px`,
                color: '#333',
                fontStyle: 'bold',
                resolution: window.devicePixelRatio || 2
            }).setOrigin(0.5);
            
            container.add([square, letterText]);
        });
        
        // Make the entire container interactive (uses outer rectangle bounds)
        const hitArea = new Phaser.Geom.Rectangle(-outerWidth / 2, -outerHeight / 2, outerWidth, outerHeight);
        container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
        
        // Button hover effects - change outer rectangle color and scale
        container.on('pointerover', () => {
            // Redraw outer rectangle with hover color
            outerRect.clear();
            outerRect.fillStyle(0xe0e0e0, 1);
            outerRect.fillRoundedRect(-outerWidth / 2, -outerHeight / 2, outerWidth, outerHeight, cornerRadius);
            outerRect.lineStyle(3, 0x333333, 1);
            outerRect.strokeRoundedRect(-outerWidth / 2, -outerHeight / 2, outerWidth, outerHeight, cornerRadius);
            
            // Scale up the entire container
            this.tweens.add({
                targets: container,
                scale: 1.05,
                duration: 150,
                ease: 'Power2'
            });
        });

        container.on('pointerout', () => {
            // Redraw outer rectangle with normal color
            outerRect.clear();
            outerRect.fillStyle(0xf7f7f7, 1);
            outerRect.fillRoundedRect(-outerWidth / 2, -outerHeight / 2, outerWidth, outerHeight, cornerRadius);
            outerRect.lineStyle(3, 0x333333, 1);
            outerRect.strokeRoundedRect(-outerWidth / 2, -outerHeight / 2, outerWidth, outerHeight, cornerRadius);
            
            // Scale back to normal
            this.tweens.add({
                targets: container,
                scale: 1.0,
                duration: 150,
                ease: 'Power2'
            });
        });

        container.on('pointerdown', () => {
            // Scale down slightly on click
            this.tweens.add({
                targets: container,
                scale: 0.98,
                duration: 100,
                ease: 'Power2'
            });
        });

        container.on('pointerup', () => {
            // Scale back up
            this.tweens.add({
                targets: container,
                scale: 1.05,
                duration: 100,
                ease: 'Power2'
            });
            
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

    saveLevelProgress(completedLevelIndex) {
        try {
            // Get existing progress
            let progress = { lastCompletedLevel: -1 };
            const saved = localStorage.getItem('wordWebProgress');
            if (saved) {
                progress = JSON.parse(saved);
            }
            
            // Update if this level is higher than previously saved
            if (completedLevelIndex > progress.lastCompletedLevel) {
                progress.lastCompletedLevel = completedLevelIndex;
                localStorage.setItem('wordWebProgress', JSON.stringify(progress));
                console.log(`Progress saved: Level ${completedLevelIndex} completed`);
            }
        } catch (e) {
            console.warn('Could not save progress:', e);
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
