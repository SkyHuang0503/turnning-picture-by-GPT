'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('image-canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const state = { current: null, original: null, width: 0, height: 0, region: null, sample: [220, 220, 220], history: [], mode: 'select', originalView: false, result: null, filename: 'image', loadVersion: 0, dragging: null };
  const channels = ['r', 'g', 'b'];
  let updateTimer;
  const numberFormat = new Intl.NumberFormat('zh-TW');
  function status(message, error = false) {
    $('status').textContent = message;
    $('status').classList.toggle('error', error);
  }
  function setMode(mode) {
    state.mode = mode;
    ['select', 'pick'].forEach(name => {
      $(`${name}-tool`).classList.toggle('active', name === mode);
      $(`${name}-tool`).setAttribute('aria-pressed', String(name === mode));
    });
    if (mode === 'pick') status('點一下圖片吸取顏色；取樣使用目前已套用的圖片，避免取到預覽替色。');
    else status('在圖片上拖曳框選區域，或在右側輸入座標。');
  }
  function syncRegion() {
    const r = state.region;
    ['x', 'y', 'width', 'height'].forEach(key => { $(`region-${key}`).value = r[key]; });
    $('region-x').max = state.width - 1;
    $('region-y').max = state.height - 1;
    $('region-width').max = state.width - r.x;
    $('region-height').max = state.height - r.y;
    const full = r.x === 0 && r.y === 0 && r.width === state.width && r.height === state.height;
    $('region-label').textContent = full ? '整張圖片' : `${r.width} × ${r.height} px`;
    const box = $('selection-box');
    box.hidden = full || state.originalView;
    box.style.left = `${r.x / state.width * 100}%`;
    box.style.top = `${r.y / state.height * 100}%`;
    box.style.width = `${r.width / state.width * 100}%`;
    box.style.height = `${r.height / state.height * 100}%`;
  }
  function fitCanvas() {
    if (!state.current) return;
    const stage = $('drop-zone');
    const styles = getComputedStyle(stage);
    const availableWidth = stage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
    const availableHeight = stage.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
    const scale = Math.min(1, availableWidth / state.width, availableHeight / state.height);
    canvas.style.width = `${state.width * scale}px`;
    canvas.style.height = `${state.height * scale}px`;
    $('canvas-wrap').style.width = `${state.width * scale}px`;
    $('canvas-wrap').style.height = `${state.height * scale}px`;
  }
  function draw() {
    if (!state.current) return;
    const pixels = state.originalView ? state.original : $('preview-toggle').checked && state.result ? state.result.data : state.current;
    context.putImageData(new ImageData(pixels, state.width, state.height), 0, 0);
    $('original-badge').hidden = !state.originalView;
    $('compare-button').textContent = state.originalView ? '返回編輯' : '查看原圖';
    $('compare-button').setAttribute('aria-pressed', String(state.originalView));
    syncRegion();
  }
  function refresh() {
    clearTimeout(updateTimer);
    if (!state.current) return;
    try {
      const ranges = channels.map(channel => [Number($(`${channel}-min`).value), Number($(`${channel}-max`).value)]);
      if (channels.some(channel => $(`${channel}-min`).value === '' || $(`${channel}-max`).value === '')) throw new Error('請填寫完整的 RGB 範圍。');
      const hex = $('target-hex').value;
      if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error('目標色碼需為 # 加上六位十六進位數字，例如 #FFFFFF。');
      const target = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
      state.result = PixelTools.replaceColors(state.current, state.width, state.height, state.region, ranges, target);
      $('match-count').textContent = numberFormat.format(state.result.matched);
      $('apply-button').disabled = state.result.changed === 0;
      if ($('status').classList.contains('error')) status('設定已更新，可預覽或套用純色。');
    } catch (error) {
      state.result = null;
      $('apply-button').disabled = true;
      $('match-count').textContent = '—';
      status(error.message, true);
    }
    draw();
  }
  function scheduleRefresh() {
    // Invalidate immediately so Apply cannot use a result from older settings.
    state.result = null;
    $('apply-button').disabled = true;
    clearTimeout(updateTimer);
    updateTimer = setTimeout(refresh, 90);
  }
  function updateSample() {
    const tolerance = Number($('tolerance').value);
    $('tolerance-value').textContent = `± ${tolerance}`;
    $('sample-swatch').style.background = `rgb(${state.sample.join(',')})`;
    $('sample-value').textContent = `RGB ${state.sample.join(', ')}`;
    channels.forEach((channel, i) => {
      $(`${channel}-min`).value = Math.max(0, state.sample[i] - tolerance);
      $(`${channel}-max`).value = Math.min(255, state.sample[i] + tolerance);
    });
    scheduleRefresh();
  }
  function syncHistory() {
    $('undo-button').disabled = state.history.length === 0;
    $('reset-button').disabled = state.current === state.original;
  }
  function loadPixels(pixels, width, height, filename) {
    clearTimeout(updateTimer);
    state.current = pixels;
    state.original = pixels;
    state.width = width;
    state.height = height;
    state.filename = filename.replace(/\.[^.]+$/, '') || 'image';
    state.history = [];
    state.originalView = false;
    state.dragging = null;
    state.region = { x: 0, y: 0, width, height };
    canvas.width = width;
    canvas.height = height;
    $('empty-state').hidden = true;
    $('canvas-wrap').hidden = false;
    $('controls').disabled = false;
    ['select-tool', 'pick-tool', 'select-all', 'compare-button', 'download-button'].forEach(id => { $(id).disabled = false; });
    $('image-info').textContent = `${filename} · ${width} × ${height} px`;
    $('image-info').title = $('image-info').textContent;
    fitCanvas();
    syncHistory();
    refresh();
    setMode('select');
    status('圖片已載入。可先吸取想整理的顏色，再調整容差與目標純色；下載只包含已套用的結果。');
  }
  async function loadFile(file) {
    if (!file) return;
    const version = ++state.loadVersion;
    if (file.size > 50 * 1024 * 1024) { status('檔案超過 50 MB，請先縮小檔案。', true); return; }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (version !== state.loadVersion) return;
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height || width * height > 16_000_000) throw new Error('圖片最多支援 1,600 萬像素，請先縮小尺寸。');
      const buffer = document.createElement('canvas');
      buffer.width = width; buffer.height = height;
      const ctx = buffer.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      loadPixels(ctx.getImageData(0, 0, width, height).data, width, height, file.name);
    } catch (error) {
      if (version === state.loadVersion) status(error.name === 'EncodingError' ? '無法讀取圖片，請選擇有效的 PNG、JPG 或 WebP 圖片。' : error.message, true);
    } finally { URL.revokeObjectURL(url); }
  }
  ['upload-button', 'change-image'].forEach(id => $(id).addEventListener('click', () => $('file-input').click()));
  $('file-input').addEventListener('change', event => { loadFile(event.target.files[0]); event.target.value = ''; });
  const dropZone = $('drop-zone');
  let dragDepth = 0;
  dropZone.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
  dropZone.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dropZone.classList.remove('drag-over'); } });
  dropZone.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; dropZone.classList.remove('drag-over'); loadFile(event.dataTransfer.files[0]); });
  // Prevent dropped files outside the workspace from navigating away.
  window.addEventListener('dragover', event => event.preventDefault());
  window.addEventListener('drop', event => event.preventDefault());
  $('select-tool').addEventListener('click', () => setMode('select'));
  ['pick-tool', 'sample-button'].forEach(id => $(id).addEventListener('click', () => setMode('pick')));
  $('select-all').addEventListener('click', () => {
    state.region = { x: 0, y: 0, width: state.width, height: state.height };
    state.originalView = false;
    refresh();
    status('已選取整張圖片。');
  });
  ['x', 'y', 'width', 'height'].forEach(key => $(`region-${key}`).addEventListener('change', () => {
    state.region = PixelTools.normalizeRegion(Object.fromEntries(['x', 'y', 'width', 'height'].map(name => [name, $(`region-${name}`).value])), state.width, state.height);
    state.originalView = false;
    refresh();
  }));
  function position(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.max(0, Math.min(state.width - 1, Math.floor((event.clientX - rect.left) / rect.width * state.width))), y: Math.max(0, Math.min(state.height - 1, Math.floor((event.clientY - rect.top) / rect.height * state.height))) };
  }
  canvas.addEventListener('pointerdown', event => {
    if (!state.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const point = position(event);
    if (state.mode === 'pick') {
      const source = state.originalView ? state.original : state.current;
      const i = (point.y * state.width + point.x) * 4;
      if (source[i + 3] === 0) { status('這個像素完全透明，請選擇可見的顏色。', true); return; }
      state.sample = Array.from(source.slice(i, i + 3));
      updateSample();
      status(`已取樣 RGB ${state.sample.join(', ')}。調整容差即可納入附近的顏色。`);
      return;
    }
    state.originalView = false;
    state.dragging = { ...point, pointerId: event.pointerId, previousRegion: state.region };
    canvas.setPointerCapture(event.pointerId);
    state.region = { ...point, width: 1, height: 1 };
    syncRegion();
  });
  canvas.addEventListener('pointermove', event => {
    if (!state.dragging || event.pointerId !== state.dragging.pointerId) return;
    const point = position(event), start = state.dragging;
    state.region = { x: Math.min(point.x, start.x), y: Math.min(point.y, start.y), width: Math.abs(point.x - start.x) + 1, height: Math.abs(point.y - start.y) + 1 };
    syncRegion();
  });
  canvas.addEventListener('pointerup', event => {
    if (!state.dragging || event.pointerId !== state.dragging.pointerId) return;
    state.dragging = null;
    canvas.releasePointerCapture(event.pointerId);
    refresh();
    status(`已框選 ${state.region.width} × ${state.region.height} 像素，只會處理這個區域。`);
  });
  canvas.addEventListener('pointercancel', () => {
    if (!state.dragging) return;
    state.region = state.dragging.previousRegion;
    state.dragging = null;
    refresh();
  });
  $('tolerance').addEventListener('input', updateSample);
  channels.forEach(channel => ['min', 'max'].forEach(bound => $(`${channel}-${bound}`).addEventListener('input', scheduleRefresh)));
  $('target-color').addEventListener('input', () => { $('target-hex').value = $('target-color').value.toUpperCase(); scheduleRefresh(); });
  $('target-hex').addEventListener('input', () => {
    if (/^#[\da-f]{6}$/i.test($('target-hex').value)) $('target-color').value = $('target-hex').value;
    scheduleRefresh();
  });
  $('preview-toggle').addEventListener('change', draw);
  $('compare-button').addEventListener('click', () => { state.originalView = !state.originalView; draw(); });
  $('apply-button').addEventListener('click', () => {
    refresh();
    if (!state.result || !state.result.changed) return;
    const changed = state.result.changed;
    state.history.push(state.current);
    const historyLimit = Math.max(1, Math.min(10, Math.floor(128 * 1024 * 1024 / state.current.byteLength)));
    if (state.history.length > historyLimit) state.history.shift();
    state.current = state.result.data;
    state.originalView = false;
    refresh();
    syncHistory();
    status(`已將 ${numberFormat.format(changed)} 個像素替換為 ${$('target-hex').value.toUpperCase()}。可繼續處理其他顏色，或下載 PNG。`);
  });
  $('undo-button').addEventListener('click', () => {
    if (!state.history.length) return;
    state.current = state.history.pop();
    state.originalView = false;
    $('preview-toggle').checked = false;
    refresh(); syncHistory();
    status('已復原上一步。即時預覽已關閉，現在顯示復原後的圖片。');
  });
  $('reset-button').addEventListener('click', () => {
    state.current = state.original;
    state.history = [];
    state.originalView = false;
    $('preview-toggle').checked = false;
    refresh(); syncHistory();
    status('已還原原始圖片並清除復原紀錄。即時預覽已關閉。');
  });
  $('download-button').addEventListener('click', () => {
    if (!state.current) return;
    const output = document.createElement('canvas');
    output.width = state.width; output.height = state.height;
    output.getContext('2d').putImageData(new ImageData(state.current, state.width, state.height), 0, 0);
    const filename = `${state.filename}-refined.png`;
    output.toBlob(blob => {
      if (!blob) { status('圖片匯出失敗，請再試一次。', true); return; }
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      status('已匯出 PNG，保留原始尺寸與透明度；未套用的預覽不會匯出。');
    }, 'image/png');
  });
  $('demo-button').addEventListener('click', () => {
    ++state.loadVersion;
    const width = 900, height = 700;
    const demo = document.createElement('canvas');
    demo.width = width; demo.height = height;
    const ctx = demo.getContext('2d', { willReadFrequently: true });
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#e8e8e8'); background.addColorStop(.5, '#d9d9da'); background.addColorStop(1, '#eeeeed');
    ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#8fa588'; ctx.beginPath(); ctx.ellipse(450, 560, 240, 32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#31594c'; ctx.beginPath(); ctx.roundRect(295, 290, 310, 255, [15, 15, 100, 100]); ctx.fill();
    ctx.lineWidth = 36; ctx.strokeStyle = '#31594c'; ctx.beginPath(); ctx.ellipse(628, 382, 67, 74, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#b7c5a0'; ctx.beginPath(); ctx.ellipse(450, 295, 155, 27, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a7b49a'; ctx.lineWidth = 8; ctx.lineCap = 'round';
    [395, 450, 505].forEach(x => { ctx.beginPath(); ctx.moveTo(x, 225); ctx.bezierCurveTo(x - 40, 180, x + 40, 160, x, 115); ctx.stroke(); });
    ctx.fillStyle = '#31594c'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('A QUIET MOMENT', 450, 640);
    $('preview-toggle').checked = true;
    state.sample = [220, 220, 220]; $('tolerance').value = 20;
    $('target-color').value = '#ffffff'; $('target-hex').value = '#FFFFFF';
    updateSample();
    loadPixels(ctx.getImageData(0, 0, width, height).data, width, height, '拾色範例.png');
    status('範例的灰色背景帶有漸層。預覽已將 RGB 200–240 的背景統一成白色，點「套用純色」保存效果。');
  });
  new ResizeObserver(fitCanvas).observe(dropZone);
})();
