// Import the main game scene to extend it
import WordWebGame from './game.js';

// Mark as level viewer to prevent game instantiation in game.js
window.__LEVEL_VIEWER__ = true;

// Level Viewer Scene - extends WordWebGame to get exact same rendering and gameplay
class LevelViewerScene extends WordWebGame {
    constructor() {
        super();
        // Override the scene key
        this.sys.settings.key = 'LevelViewerScene';
    }

    preload() {
        // Load assets from same directory as game.js
        this.load.json('levels', 'levels.json');
        this.load.audio('fillSound', 'sounds/fill_sound4.wav');
        this.load.audio('burstSound', 'sounds/burst.wav');
        this.load.image('handPointer', 'graphics/hand_pointer.webp');
    }

    create() {
        // Call parent create method to get full game functionality
        super.create();
        
        // Update level info in navbar after level loads
        if (this.totalLevels) {
            this.updateLevelInfo();
        }
    }

    updateLevelInfo() {
        const levelInfo = document.getElementById('level-info');
        const actualLevel = (this.currentLevelIndex % this.totalLevels) + 1;
        const numWords = this.level.words ? this.level.words.length : 0;
        const numSlots = this.level.slots ? this.level.slots.length : 0;
        const numRules = (this.level.rules || this.level.connections || []).length;
        levelInfo.textContent = `(Level ${actualLevel}/${this.totalLevels} | Words: ${numWords} | Slots: ${numSlots} | Rules: ${numRules})`;
    }

    loadLevel(levelIndex) {
        // Restart scene with new level index
        this.scene.restart({ levelIndex });
    }
}

// Phaser game configuration for level viewer
const config = {
    type: Phaser.AUTO,
    width: 720, // Portrait mode to match game (9:16 aspect ratio)
    height: 1280,
    parent: 'viewer-game',
    backgroundColor: '#eaf6ff',
    scene: [LevelViewerScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    resolution: window.devicePixelRatio || 1,
    render: {
        antialiasGL: true,
        pixelArt: false,
    }
};

const game = new Phaser.Game(config);

// Navigation controls
const levelNumberInput = document.getElementById('level-number');
const goBtn = document.getElementById('go-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

let currentLevelNumber = 1;

function loadLevelByNumber(levelNum) {
    const scene = game.scene.getScene('LevelViewerScene');
    if (scene) {
        currentLevelNumber = levelNum;
        levelNumberInput.value = levelNum;
        // Convert 1-based to 0-based index
        scene.loadLevel(levelNum - 1);
    }
}

goBtn.addEventListener('click', () => {
    const levelNum = parseInt(levelNumberInput.value) || 1;
    loadLevelByNumber(levelNum);
});

levelNumberInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const levelNum = parseInt(levelNumberInput.value) || 1;
        loadLevelByNumber(levelNum);
    }
});

prevBtn.addEventListener('click', () => {
    loadLevelByNumber(currentLevelNumber - 1);
});

nextBtn.addEventListener('click', () => {
    loadLevelByNumber(currentLevelNumber + 1);
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Only handle arrows if not focused on input
    if (document.activeElement !== levelNumberInput) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            loadLevelByNumber(currentLevelNumber - 1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            loadLevelByNumber(currentLevelNumber + 1);
        }
    }
});
