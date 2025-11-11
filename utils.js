// Utility function to get key points of a grid cell at (i, j)
// Returns Phaser.Math.Vector2 objects for centre, corners
export function getCellPoints(i, j) {
  const x0 = i * CONFIG.SQUARE_WIDTH;     // top-left x
  const y0 = j * CONFIG.SQUARE_WIDTH;     // top-left y (Phaser Y+ is down)
  const x1 = x0 + CONFIG.SQUARE_WIDTH;
  const y1 = y0 + CONFIG.SQUARE_WIDTH;

  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  return {
    centre:      new Phaser.Math.Vector2(cx, cy),
    topLeft:     new Phaser.Math.Vector2(x0, y0),
    topRight:    new Phaser.Math.Vector2(x1, y0),
    bottomLeft:  new Phaser.Math.Vector2(x0, y1),
    bottomRight: new Phaser.Math.Vector2(x1, y1)
  };
  
}
export function getFrameWidth(length) {
    const width = CONFIG.SQUARE_WIDTH;
    const gap = CONFIG.SQUARE_GAP;
    const totalWidth = length * width + (length - 1) * gap;
    return totalWidth;
}