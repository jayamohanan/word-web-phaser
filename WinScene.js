// Win Scene for Word Web
// Displays when all slots are filled with valid words

class WinScene extends Phaser.Scene {
    constructor() {
        super('WinScene');
    }

    init(data) {
        this.currentLevelIndex = data.currentLevelIndex || 0;
        this.totalLevels = data.totalLevels || 1;
    }

    create() {
        const { width, height } = this.sys.game.canvas;

        // Semi-transparent overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.5);
        overlay.setOrigin(0, 0);

        // Main container for win UI
        const winContainer = this.add.container(width / 2, height / 2);

        // Background panel for win message
        const panelWidth = 400;
        const panelHeight = 300;
        const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0xffffff);
        panel.setStrokeStyle(4, 0x333333);

        // Win title text
        const titleText = this.add.text(0, -80, '🎉 Level Complete! 🎉', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '36px',
            color: '#222',
            fontStyle: 'bold',
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5);

        // Congratulations message
        const messageText = this.add.text(0, -20, 'All slots filled successfully!\nGreat job!', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '20px',
            color: '#555',
            align: 'center',
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5);

        // Next button
        const buttonWidth = 200;
        const buttonHeight = 60;
        const nextButton = this.add.rectangle(0, 60, buttonWidth, buttonHeight, 0x4CAF50);
        nextButton.setStrokeStyle(3, 0x2E7D32);
        nextButton.setInteractive({ useHandCursor: true });

        const nextButtonText = this.add.text(0, 60, 'Next Level', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold',
            resolution: window.devicePixelRatio || 2
        }).setOrigin(0.5);

        // Button hover effects
        nextButton.on('pointerover', () => {
            nextButton.setFillStyle(0x66BB6A);
            nextButton.setScale(1.05);
            nextButtonText.setScale(1.05);
        });

        nextButton.on('pointerout', () => {
            nextButton.setFillStyle(0x4CAF50);
            nextButton.setScale(1);
            nextButtonText.setScale(1);
        });

        nextButton.on('pointerdown', () => {
            nextButton.setScale(0.95);
            nextButtonText.setScale(0.95);
        });

        nextButton.on('pointerup', () => {
            nextButton.setScale(1.05);
            nextButtonText.setScale(1.05);
            
            // Go to next level (loop back to first level if at the end)
            const nextLevelIndex = (this.currentLevelIndex + 1) % this.totalLevels;
            
            // Restart the game scene with the next level
            this.scene.start('WordWebGame', { levelIndex: nextLevelIndex });
        });

        // Add all elements to the container
        winContainer.add([panel, titleText, messageText, nextButton, nextButtonText]);

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
