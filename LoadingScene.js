// LoadingScene.js - Minimal loading screen with progress bar
class LoadingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadingScene' });
    }

    preload() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const centerX = width / 2;
        const centerY = height / 2;

        // Create "Loading..." text
        const loadingText = this.add.text(centerX, centerY - 50, 'Loading...', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '32px',
            color: '#333333'
        });
        loadingText.setOrigin(0.5, 0.5);

        // Create progress bar background (simple rectangle)
        const progressBarWidth = 300;
        const progressBarHeight = 20;
        const progressBarX = centerX - progressBarWidth / 2;
        const progressBarY = centerY + 20;

        const progressBg = this.add.graphics();
        progressBg.fillStyle(0xcccccc, 1);
        progressBg.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);

        // Create progress bar fill
        const progressBar = this.add.graphics();

        // Update progress bar as assets load
        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0x4CAF50, 1); // Green progress bar
            progressBar.fillRect(progressBarX, progressBarY, progressBarWidth * value, progressBarHeight);
        });

        // Load all game assets here
        this.load.json('levels', 'levels.json');
        
        // Load all audio files
        this.load.audio('fillSound', 'sounds/fill_sound4.wav');
        this.load.audio('burstSound', 'sounds/burst.wav');
        this.load.audio('invalidSound', 'sounds/invalid.ogg');
        this.load.audio('successSound', 'sounds/success1.wav');
        
        // Load all images
        this.load.image('handPointer', 'graphics/hand_pointer.webp');
        this.load.image('hintButton', 'graphics/hint.webp');
        this.load.image('skipButton', 'graphics/skip.webp');
        this.load.image('retryButton', 'graphics/retry.webp');
        this.load.image('greenCheck', 'graphics/green_check.webp');
        this.load.image('hintIcon', 'graphics/hint.webp');
        this.load.image('square', 'graphics/square.webp');
        this.load.image('square-stroke', 'graphics/square-stroke.webp');
    }

    create() {
        // Get saved progress from localStorage
        const savedLevel = this.getSavedLevel();
        
        // Start the main game scene with the next level to play
        this.scene.start('WordWebGame', { levelIndex: savedLevel });
    }

    getSavedLevel() {
        try {
            const saved = localStorage.getItem('wordWebProgress');
            if (saved) {
                const progress = JSON.parse(saved);
                // Return the next level after the last completed one
                // If level 3 is completed, return 4
                return (progress.lastCompletedLevel || 0) + 1;
            }
        } catch (e) {
            console.warn('Could not load saved progress:', e);
        }
        return 0; // Start from level 0 if no save exists
    }
}

export default LoadingScene;
