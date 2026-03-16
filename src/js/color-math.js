// ── Memoization caches (cleared per solver run via clearColorCaches) ──
const _hexRgbCache = new Map();
const _hexLabCache = new Map();
const _hexOklabCache = new Map();
const _colorMixCache = new Map();
const _deltaECache = new Map();
function clearColorCaches() {
    _hexRgbCache.clear(); _hexLabCache.clear(); _hexOklabCache.clear();
    _colorMixCache.clear(); _deltaECache.clear();
}

function hexToRgb(hex) {
    if (_hexRgbCache.has(hex)) return _hexRgbCache.get(hex);
    const clean = hex.replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const result = { r: parseInt(full.slice(0,2),16), g: parseInt(full.slice(2,4),16), b: parseInt(full.slice(4,6),16) };
    _hexRgbCache.set(hex, result);
    return result;
}
function rgbToHex({r, g, b}) {
    return '#' + [r,g,b].map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
}
function toLinear(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function fromLinear(v) {
    const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1/2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, c)) * 255);
}
function rgbToXyz({r, g, b}) {
    const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
    return {
        x: lr*0.4124564 + lg*0.3575761 + lb*0.1804375,
        y: lr*0.2126729 + lg*0.7151522 + lb*0.0721750,
        z: lr*0.0193339 + lg*0.1191920 + lb*0.9503041,
    };
}
function xyzToRgb({x, y, z}) {
    const lr = x*3.2404542 - y*1.5371385 - z*0.4985314;
    const lg = -x*0.9692660 + y*1.8760108 + z*0.0415560;
    const lb = x*0.0556434 - y*0.2040259 + z*1.0572252;
    return { r: fromLinear(lr), g: fromLinear(lg), b: fromLinear(lb) };
}
function xyzToLab({x, y, z}) {
    const D65 = {x:0.95047, y:1.00000, z:1.08883};
    const f = v => v > 0.008856 ? Math.cbrt(v) : (7.787*v)+(16/116);
    return {
        l: 116*f(y/D65.y) - 16,
        a: 500*(f(x/D65.x) - f(y/D65.y)),
        b: 200*(f(y/D65.y) - f(z/D65.z)),
    };
}
function labToXyz({l, a, b}) {
    const D65 = {x:0.95047, y:1.00000, z:1.08883};
    const fy = (l+16)/116, fx = a/500+fy, fz = fy-b/200;
    const f3 = v => v*v*v > 0.008856 ? v*v*v : (v-16/116)/7.787;
    return { x: f3(fx)*D65.x, y: f3(fy)*D65.y, z: f3(fz)*D65.z };
}
function rgbToOklab({r, g, b}) {
    const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
    const l = Math.cbrt(0.4122214708*lr + 0.5363325363*lg + 0.0514459929*lb);
    const m = Math.cbrt(0.2119034982*lr + 0.6806995451*lg + 0.1073969566*lb);
    const s = Math.cbrt(0.0883024619*lr + 0.2817188376*lg + 0.6299787005*lb);
    return {
        l: 0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
        a: 1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
        b: 0.0259040371*l + 0.7827717662*m - 0.8086757660*s,
    };
}
function oklabToRgb({l, a, b}) {
    const lc = l + 0.3963377774*a + 0.2158037573*b;
    const mc = l - 0.1055613458*a - 0.0638541728*b;
    const sc = l - 0.0894841775*a - 1.2914855480*b;
    const lr = lc*lc*lc, mg = mc*mc*mc, sb = sc*sc*sc;
    return {
        r: fromLinear( 4.0767416621*lr - 3.3077115913*mg + 0.2309699292*sb),
        g: fromLinear(-1.2684380046*lr + 2.6097574011*mg - 0.3413193965*sb),
        b: fromLinear(-0.0041960863*lr - 0.7034186147*mg + 1.7076147010*sb),
    };
}
function _hexToLab(hex) {
    if (_hexLabCache.has(hex)) return _hexLabCache.get(hex);
    const lab = xyzToLab(rgbToXyz(hexToRgb(hex)));
    _hexLabCache.set(hex, lab);
    return lab;
}
function _hexToOklab(hex) {
    if (_hexOklabCache.has(hex)) return _hexOklabCache.get(hex);
    const ok = rgbToOklab(hexToRgb(hex));
    _hexOklabCache.set(hex, ok);
    return ok;
}
function deltaE(hex1, hex2) {
    const key = hex1 + '|' + hex2;
    if (_deltaECache.has(key)) return _deltaECache.get(key);
    const lab1 = _hexToLab(hex1), lab2 = _hexToLab(hex2);
    const result = Math.sqrt(
        Math.pow(lab1.l-lab2.l,2) + Math.pow(lab1.a-lab2.a,2) + Math.pow(lab1.b-lab2.b,2)
    );
    _deltaECache.set(key, result);
    return result;
}
// Implements CSS color-mix(in space, hex1 100%, hex2 percent%)
// CSS normalises: effective blend fraction = percent / (100 + percent)
function colorMix(hex1, hex2, percent, space) {
    space = space || 'oklab';
    const key = hex1 + '|' + hex2 + '|' + percent + '|' + space;
    if (_colorMixCache.has(key)) return _colorMixCache.get(key);
    const t = percent / (100 + percent);
    let result;
    if (space === 'srgb') {
        const rgb1 = hexToRgb(hex1), rgb2 = hexToRgb(hex2);
        result = rgbToHex({ r: rgb1.r*(1-t)+rgb2.r*t, g: rgb1.g*(1-t)+rgb2.g*t, b: rgb1.b*(1-t)+rgb2.b*t });
    } else if (space === 'lab') {
        const lab1 = _hexToLab(hex1), lab2 = _hexToLab(hex2);
        result = rgbToHex(xyzToRgb(labToXyz({
            l: lab1.l*(1-t)+lab2.l*t,
            a: lab1.a*(1-t)+lab2.a*t,
            b: lab1.b*(1-t)+lab2.b*t
        })));
    } else if (space === 'oklab') {
        const ok1 = _hexToOklab(hex1), ok2 = _hexToOklab(hex2);
        result = rgbToHex(oklabToRgb({
            l: ok1.l*(1-t)+ok2.l*t,
            a: ok1.a*(1-t)+ok2.a*t,
            b: ok1.b*(1-t)+ok2.b*t
        }));
    } else {
        throw new Error('Unknown color space: ' + space);
    }
    _colorMixCache.set(key, result);
    return result;
}
function isValidHex(hex) {
    return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}
function normalizeHex(hex) {
    const clean = hex.trim().replace('#','');
    const full = clean.length === 3 ? clean.split('').map(c => c+c).join('') : clean;
    return '#' + full.toLowerCase();
}