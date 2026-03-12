// This file contains logic to suggest the most suitable color space for blending based on the input colors.

function suggestColorSpace(baseColor, targetColor) {
    const colorDistance = calculateColorDistance(baseColor, targetColor);
    
    if (colorDistance < 50) {
        return 'RGB: Suitable for colors that are close together.';
    } else if (colorDistance < 100) {
        return 'HSL: Good for perceptual blending and adjusting lightness.';
    } else {
        return 'CMYK: Recommended for print and when colors are far apart.';
    }
}

function calculateColorDistance(color1, color2) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    return Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );
}

function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;

    // 3 digits
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    }
    // 6 digits
    else if (hex.length === 7) {
        r = parseInt(hex[1] + hex[2], 16);
        g = parseInt(hex[3] + hex[4], 16);
        b = parseInt(hex[5] + hex[6], 16);
    }

    return { r, g, b };
}

// Export the suggestColorSpace function for use in other modules
export { suggestColorSpace };