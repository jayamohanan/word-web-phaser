// Shared config for dimensions and layout
const CONFIG = {
    SQUARE_WIDTH: 50,
    SQUARE_GAP: 8,
    get GRID_SIZE() { return this.SQUARE_WIDTH + this.SQUARE_GAP; },
    SLOT_AREA_BG: 0xe3f2fd,
    BANK_AREA_BG: 0xfce4ec,
    GRID_COLOR: 0xcfd8dc,
    GRID_LINE_WIDTH: 1
};

export default CONFIG;
