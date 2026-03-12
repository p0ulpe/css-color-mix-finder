// This file contains unit tests for the functions in color-math.js, ensuring that the blending calculations are accurate.

import { blendColors } from '../src/js/color-math.js';

describe('Color Math Tests', () => {
    test('blendColors should correctly blend two HEX colors', () => {
        const baseColor = '#ff5733'; // Example base color
        const targetColor = '#ffffff'; // Example target color
        const expectedBlend = '#ffb3b3'; // Expected blend result

        const result = blendColors(baseColor, targetColor, 0.5);
        expect(result).toBe(expectedBlend);
    });

    test('blendColors should handle invalid color inputs', () => {
        const baseColor = '#ff5733';
        const targetColor = 'invalidColor'; // Invalid color input

        expect(() => blendColors(baseColor, targetColor, 0.5)).toThrow('Invalid color format');
    });

    test('blendColors should return the base color if blend percentage is 0', () => {
        const baseColor = '#ff5733';
        const targetColor = '#ffffff';
        const expectedBlend = baseColor;

        const result = blendColors(baseColor, targetColor, 0);
        expect(result).toBe(expectedBlend);
    });

    test('blendColors should return the target color if blend percentage is 1', () => {
        const baseColor = '#ff5733';
        const targetColor = '#ffffff';
        const expectedBlend = targetColor;

        const result = blendColors(baseColor, targetColor, 1);
        expect(result).toBe(expectedBlend);
    });

    // Add more tests as needed for additional functionality
});