function isValidHex(color) {
    const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    return hexPattern.test(color);
}

function isValidRgb(color) {
    const rgbPattern = /^rgb\(\s*(\d{1,3}\s*,\s*){2}\d{1,3}\s*\)$/;
    return rgbPattern.test(color);
}

function isValidHsl(color) {
    const hslPattern = /^hsl\(\s*(\d{1,3}\s*,\s*){2}(\d{1,3}\s*%?)\)$/;
    return hslPattern.test(color);
}

function validateColorInput(color) {
    if (!isValidHex(color) && !isValidRgb(color) && !isValidHsl(color)) {
        throw new Error('Invalid color format. Please use HEX, RGB, or HSL.');
    }
    return true;
}

export { validateColorInput };