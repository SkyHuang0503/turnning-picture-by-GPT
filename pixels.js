/* Shared pixel operations: usable directly in a browser or in Node tests. */
(function (root) {
  'use strict';
  function normalizeRegion(region, width, height) {
    const integer = (value, fallback) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
    const x = Math.max(0, Math.min(width - 1, integer(region.x, 0)));
    const y = Math.max(0, Math.min(height - 1, integer(region.y, 0)));
    return { x, y, width: Math.max(1, Math.min(width - x, integer(region.width, width))), height: Math.max(1, Math.min(height - y, integer(region.height, height))) };
  }
  function replaceColors(source, width, height, region, ranges, target) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || source.length !== width * height * 4) throw new Error('圖片資料不完整。');
    if (ranges.length !== 3 || ranges.some(range => range.length !== 2 || range.some(v => !Number.isInteger(v) || v < 0 || v > 255) || range[0] > range[1])) throw new Error('RGB 最小值不可大於最大值，數值必須是 0–255 的整數。');
    if (target.length !== 3 || target.some(v => !Number.isInteger(v) || v < 0 || v > 255)) throw new Error('請輸入有效的目標顏色。');
    const area = normalizeRegion(region, width, height);
    const data = new Uint8ClampedArray(source);
    let matched = 0, changed = 0;
    for (let y = area.y; y < area.y + area.height; y++) {
      for (let x = area.x; x < area.x + area.width; x++) {
        const i = (y * width + x) * 4;
        if (source[i + 3] === 0) continue;
        if (source[i] >= ranges[0][0] && source[i] <= ranges[0][1] && source[i + 1] >= ranges[1][0] && source[i + 1] <= ranges[1][1] && source[i + 2] >= ranges[2][0] && source[i + 2] <= ranges[2][1]) {
          matched++;
          if (source[i] !== target[0] || source[i + 1] !== target[1] || source[i + 2] !== target[2]) changed++;
          data[i] = target[0]; data[i + 1] = target[1]; data[i + 2] = target[2];
        }
      }
    }
    return { data, matched, changed };
  }
  const api = { normalizeRegion, replaceColors };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PixelTools = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
