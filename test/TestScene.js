// TestScene.js - A simple Phaser scene for isolated testing
class TestScene extends Phaser.Scene {
    constructor() {
        super('TestScene');
    }

    create() {
        // Create a 200x200 square at (400, 400)
        this.largeSquare = this.add.rectangle(400, 400, 200, 200, 0x00aaee).setStrokeStyle(4, 0x222222);
        // Create a 4x4 red rectangle at (400, 400)
        this.redRect = this.add.rectangle(400, 400, 4, 4, 0xff0000);
    }
}

export default TestScene;
