// This file contains unit tests for the functions in color-space-suggester.js, verifying that the suggested color spaces are appropriate.

import { suggestColorSpace } from '../src/js/color-space-suggester';

describe('Color Space Suggester', () => {
    test('suggests RGB for bright colors', () => {
        const baseColor = '#ff5733'; // bright orange
        const targetColor = '#33ff57'; // bright green
        const suggestedSpace = suggestColorSpace(baseColor, targetColor);
        expect(suggestedSpace).toBe('RGB');
    });

    test('suggests HSL for pastel colors', () => {
        const baseColor = '#ffcccb'; // pastel red
        const targetColor = '#ccffcc'; // pastel green
        const suggestedSpace = suggestColorSpace(baseColor, targetColor);
        expect(suggestedSpace).toBe('HSL');
    });

    test('suggests CMYK for print colors', () => {
        const baseColor = '#00bfff'; // cyan
        const targetColor = '#ff00ff'; // magenta
        const suggestedSpace = suggestColorSpace(baseColor, targetColor);
        expect(suggestedSpace).toBe('CMYK');
    });

    test('returns null for invalid colors', () => {
        const baseColor = '#xyz'; // invalid color
        const targetColor = '#123456'; // valid color
        const suggestedSpace = suggestColorSpace(baseColor, targetColor);
        expect(suggestedSpace).toBeNull();
    });

    test('handles edge cases with similar colors', () => {
        const baseColor = '#ff0000'; // red
        const targetColor = '#ff0011'; // similar red
        const suggestedSpace = suggestColorSpace(baseColor, targetColor);
        expect(suggestedSpace).toBe('RGB');
    });
});