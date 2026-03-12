// This file contains unit tests for the functions in color-spaces.js, verifying the correctness of color space definitions and conversions.

const { rgbToHsl, hslToRgb, rgbToCmyk, cmykToRgb } = require('../src/js/color-spaces');

describe('Color Space Conversions', () => {
    test('RGB to HSL conversion', () => {
        expect(rgbToHsl(255, 0, 0)).toEqual([0, 1, 0.5]); // Red
        expect(rgbToHsl(0, 255, 0)).toEqual([120, 1, 0.5]); // Green
        expect(rgbToHsl(0, 0, 255)).toEqual([240, 1, 0.5]); // Blue
    });

    test('HSL to RGB conversion', () => {
        expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0]); // Red
        expect(hslToRgb(120, 1, 0.5)).toEqual([0, 255, 0]); // Green
        expect(hslToRgb(240, 1, 0.5)).toEqual([0, 0, 255]); // Blue
    });

    test('RGB to CMYK conversion', () => {
        expect(rgbToCmyk(255, 0, 0)).toEqual([0, 1, 1, 0]); // Red
        expect(rgbToCmyk(0, 255, 0)).toEqual([1, 0, 1, 0]); // Green
        expect(rgbToCmyk(0, 0, 255)).toEqual([1, 1, 0, 0]); // Blue
    });

    test('CMYK to RGB conversion', () => {
        expect(cmykToRgb(0, 1, 1, 0)).toEqual([255, 0, 0]); // Red
        expect(cmykToRgb(1, 0, 1, 0)).toEqual([0, 255, 0]); // Green
        expect(cmykToRgb(1, 1, 0, 0)).toEqual([0, 0, 255]); // Blue
    });
});