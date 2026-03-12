// This file defines various color spaces (e.g., RGB, HSL, CMYK) and their properties, providing functions to convert between them.

const ColorSpaces = {
    RGB: {
        name: "RGB",
        description: "Red, Green, Blue color space",
        toHex: function(r, g, b) {
            return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
        },
        fromHex: function(hex) {
            const bigint = parseInt(hex.slice(1), 16);
            const r = (bigint >> 16) & 255;
            const g = (bigint >> 8) & 255;
            const b = bigint & 255;
            return { r, g, b };
        }
    },
    HSL: {
        name: "HSL",
        description: "Hue, Saturation, Lightness color space",
        toHex: function(h, s, l) {
            let r, g, b;
            if (s === 0) {
                r = g = b = l; // achromatic
            } else {
                const hue2rgb = (p, q, h) => {
                    if (h < 0) h += 1;
                    if (h > 1) h -= 1;
                    if (h < 1/6) return p + (q - p) * 6 * h;
                    if (h < 1/2) return q;
                    if (h < 2/3) return p + (q - p) * (2/3 - h) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            return this.RGB.toHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
        },
        fromHex: function(hex) {
            const { r, g, b } = this.RGB.fromHex(hex);
            r /= 255; g /= 255; b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;
            if (max === min) {
                h = s = 0; // achromatic
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }
            return { h, s, l };
        }
    },
    CMYK: {
        name: "CMYK",
        description: "Cyan, Magenta, Yellow, Black color space",
        toHex: function(c, m, y, k) {
            const r = 255 * (1 - c) * (1 - k);
            const g = 255 * (1 - m) * (1 - k);
            const b = 255 * (1 - y) * (1 - k);
            return this.RGB.toHex(Math.round(r), Math.round(g), Math.round(b));
        },
        fromHex: function(hex) {
            const { r, g, b } = this.RGB.fromHex(hex);
            const k = 1 - Math.max(r / 255, g / 255, b / 255);
            const c = (1 - r / 255 - k) / (1 - k) || 0;
            const m = (1 - g / 255 - k) / (1 - k) || 0;
            const y = (1 - b / 255 - k) / (1 - k) || 0;
            return { c, m, y, k };
        }
    }
};

export default ColorSpaces;