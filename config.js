// Shared config for dimensions and layout
var CONFIG = {
    SIZE: {
        LARGE: {
            SQUARE_WIDTH: 64,
            SQUARE_GAP: 1,
            SQUARE_RADIUS: 5,
            GRID_LINE_WIDTH: 1,
            SLOT_STROKE_WIDTH: 3,
            WORD_STROKE_WIDTH: 3,
            // Font sizes
            WORD_CELL_FONT_SIZE: '36px',   // Font size for letters in word cells
            SLOT_CELL_FONT_SIZE: '36px',    // Font size for hints in slot cells
            WORD_GAP: 12,
        },
        SMALL: {
            SQUARE_WIDTH: 40,
            SQUARE_GAP: 2,
            SQUARE_RADIUS: 3,
            GRID_LINE_WIDTH: 1,
            SLOT_STROKE_WIDTH: 2,
            WORD_STROKE_WIDTH: 2,
            // Font sizes
            WORD_CELL_FONT_SIZE: '30px',   // Font size for letters in word cells
            SLOT_CELL_FONT_SIZE: '30px',    // Font size for hints in slot cells
            WORD_GAP: 8,
        }
    },
    SQUARE_WIDTH: 60,
    SQUARE_GAP: 4,
    SQUARE_RADIUS: 5,
    GRID_LINE_WIDTH: 1,
    SLOT_STROKE_WIDTH: 2,
    WORD_STROKE_WIDTH: 2,
    // Font sizes
    WORD_CELL_FONT_SIZE: '40px',   // Font size for letters in word cells
    SLOT_CELL_FONT_SIZE: '40px',    // Font size for hints in slot cells
    WORD_GAP: 12,


    get GRID_SIZE() { return this.SQUARE_WIDTH + this.SQUARE_GAP; },
    SLOT_AREA_BG: 0xe3f2fd,
    BANK_AREA_BG: 0xfce4ec,
    GRID_COLOR: 0xcfd8dc,

    SLOT_AREA_HEIGHT_FACTOR: 0.7, // Fraction of canvas height for slot area (portrait mode)

    ORIGIN_X_FACTOR: 0.5,  // 50% of canvas width (horizontal center)
    ORIGIN_Y_FACTOR: 0.50,  // 50% of canvas height (closer to words in portrait mode)

    // Stroke styles for slots and words
    USE_GRAY_STROKES: true,  // Set to false to use black strokes for cells and lines

    get SLOT_STROKE_COLOR() { return this.USE_GRAY_STROKES ? 0x808080 : 0x000000; },  // Gray or Black

    get WORD_STROKE_COLOR() { return this.USE_GRAY_STROKES ? 0x808080 : 0x333333; },   // Gray or Dark gray

    get LINE_COLOR() { return this.USE_GRAY_STROKES ? 0x808080 : 0x000000; },  // Gray or Black for connection lines

    CELL_BG1_COLOR: 0xf7f7f7,  // White for normal cells
    CELL_BG2_COLOR: 0xededed,  // Light gray for special cells (e.g., starting letters)


    // Font family for letters in squares (both slots and words)
    // Use 'default' for Arial sans-serif, or 'Petita' for custom font
    LETTER_FONT_FAMILY: 'Poppins-Regular',
    LETTER_FONT_WEIGHT: '300', // Font weight for letters in squares (use '400', '500', or '700' as string)

    SLOT_MARKER_FONT_FAMILY: 'Poppins-LightItalic',
    SLOT_MARKER_FONT_WEIGHT: '300', // Font weight for slot markers (use '300', '400', '500', or '700' as string)

    // Feature toggles
    ENABLE_LINE_CLICK_HIGHLIGHTING: false, // Enable click on connection lines to highlight matching word bank cells

    // Background gradients (Poki gaming style)
    // Outer background gradient (full canvas)
    OUTER_BG_GRADIENT_TOP: '#ABE0F0',    // Deep purple (top)
    OUTER_BG_GRADIENT_BOTTOM: '#FFEE91', // Pink (bottom)

    // Portrait area gradient (720x1280 game area)
    // PORTRAIT_BG_GRADIENT_TOP: '#5390D9',    // Blue (top)
    // PORTRAIT_BG_GRADIENT_BOTTOM: '#48BFE3', // Cyan (bottom)

    PORTRAIT_BG_GRADIENT_TOP: '#d3e8eeff',    // Blue (top)
    PORTRAIT_BG_GRADIENT_BOTTOM: '#ABE0F0', // Cyan (bottom)


    // Connection highlight color
    CONNECTION_HIGHLIGHT_COLOR: 0xC8E6C9,  // Light green for connected cells

    // Autopilot mode - automatically places obvious words based on hints
    AUTOPILOT_ENABLED: false,  // Set to true to enable autopilot helper

    // Placement animation mode
    PLACEMENT_ANIMATION_MODE: 'cell',  // 'letter' = letters only, 'cell' = letters + squares

    // Level start animations - animate slots and lines on level load
    LEVEL_START_ANIMATIONS: false,  // Set to false to disable entrance animations

    // Debug mode - show portrait boundary (720x1280 area) on desktop
    SHOW_PORTRAIT_BOUNDARY: false,  // Set to false to hide portrait boundary in debug

    //Game Scores
    HINT_SCORE_1: '5',
    HINT_SCORE_2: '10',

    // Point System
    ENABLE_SCORE_SYSTEM: false,  // Set to false to disable score display and animations
    POINTS_PER_CELL_ON_HINT: 10,  // Points awarded for placing a word cell correctly over a hint

    // Hover Effects
    HOVER_SCALE_ENABLED: false,  // Set to false to disable scale highlight on hover
    HOVER_TINT_ENABLED: true,   // Set to false to disable tint highlight on hover
    HOVER_TINT_COLOR: 0xd3e4fd, // Tint color for hover effect (slightly darker blue for visibility)
    WORD_CLICK_FEEDBACK_COLOR: 0xb8d4f7, // Darker blue tint for click feedback on words

    //test, main, reserve
    // "LEVEL_TYPE": 'test',
    "LEVEL_TYPE": 'main',   
    // "LEVEL_TYPE": 'reserve',

    SHADOW_MID_OFFSET : 9,
    SHADOW_DARK_OFFSET : 2,

    DRAG_DISTANCE_THRESHOLD: 4, // Minimum distance in pixels for drag to be recognized
    
   SASHA_PALETTE: [
    { name: 'Red', hex: '#e6194b', tint: '#fad1da' },
    { name: 'Green', hex: '#3cb44b', tint: '#d8f0db' },
    { name: 'Blue', hex: '#4363d8', tint: '#d9e0f7' },
    { name: 'Orange', hex: '#f58231', tint: '#fde6d6' },
    { name: 'Purple', hex: '#911eb4', tint: '#e9d2f0' },
   { name: 'Teal', hex: '#469990', tint: '#daebe9' },
    { name: 'Olive', hex: '#808000', tint: '#e6e6cc' },
    { name: 'Magenta', hex: '#f032e6', tint: '#fcd6f6' },
    { name: 'Pink', hex: '#fabed4', tint: '#fef2f6' },
    
    { name: 'Lavender', hex: '#dcbeff', tint: '#f8f2ff' },
    { name: 'Beige', hex: '#fffac8', tint: '#fffef4' },
    { name: 'Maroon', hex: '#800000', tint: '#e6cccc' },
    { name: 'Mint', hex: '#aaffc3', tint: '#eefff3' },
   
    { name: 'Apricot', hex: '#ffd8b1', tint: '#fff7ef' },
    { name: 'Navy', hex: '#000075', tint: '#ccccdf' },
    { name: 'Grey', hex: '#a9a9a9', tint: '#eeeeee' },
     { name: 'Brown', hex: '#9a6324', tint: '#ebe0d3' },
    { name: 'Yellow', hex: '#ffe119', tint: '#fff9d1' },
    { name: 'Cyan', hex: '#42d4f4', tint: '#d9f6fd' },
     { name: 'Lime', hex: '#bfef45', tint: '#f2fccd' }
]
// SASHA_PALETTE: [
//     { name: 'Red', hex: '#76A68B', tint: '#76A68B' },
//     { name: 'Green', hex: '#F2D6B3', tint: '#F2D6B3' },
//     { name: 'Blue', hex: '#D9725B', tint: '#D9725B' },
//     { name: 'Orange', hex: '#D9665B', tint: '#D9665B' },
//     { name: 'Purple', hex: '#3F3E59', tint: '#3F3E59' }
// ]

};
