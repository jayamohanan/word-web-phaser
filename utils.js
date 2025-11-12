// Utility function to get key points of a grid cell at (i, j)
// Returns Phaser.Math.Vector2 objects for center, corners
export function getGridCellPoints(i, j, originX, originY, gridSize) {//based on origin (0,0)
  const x0 = originX + i * gridSize;     // top-left x
  const y0 = originY + j * gridSize;     // top-left y (Phaser Y+ is down)
  const x1 = x0 + gridSize;
  const y1 = y0 + gridSize;

  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;

  return {
    center:      new Phaser.Math.Vector2(cx, cy),
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
export function getCellIndex(x, y, xCenter, yCenter, cellSize) {
  const i = Math.floor((x - xCenter) / cellSize);
  const j = Math.floor((y - yCenter) / cellSize);
  return { i, j };
}
