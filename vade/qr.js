/* VADE QR — автономний генератор QR-кодів (ISO/IEC 18004, Byte UTF-8, ECC M, версії 1..14), CSP-сумісний */
(() => {
  "use strict";

  const VERSIONS = [
    { version: 1, ecPerBlock: 10, blocks: [[1, 16]], align: [] },
    { version: 2, ecPerBlock: 16, blocks: [[1, 28]], align: [6, 18] },
    { version: 3, ecPerBlock: 26, blocks: [[1, 44]], align: [6, 22] },
    { version: 4, ecPerBlock: 18, blocks: [[2, 32]], align: [6, 26] },
    { version: 5, ecPerBlock: 24, blocks: [[2, 43]], align: [6, 30] },
    { version: 6, ecPerBlock: 16, blocks: [[4, 27]], align: [6, 34] },
    { version: 7, ecPerBlock: 18, blocks: [[4, 31]], align: [6, 22, 38] },
    { version: 8, ecPerBlock: 22, blocks: [[2, 38], [2, 39]], align: [6, 24, 42] },
    { version: 9, ecPerBlock: 22, blocks: [[3, 36], [2, 37]], align: [6, 26, 46] },
    { version: 10, ecPerBlock: 26, blocks: [[4, 43], [1, 44]], align: [6, 28, 50] },
    { version: 11, ecPerBlock: 30, blocks: [[1, 50], [4, 51]], align: [6, 30, 54] },
    { version: 12, ecPerBlock: 22, blocks: [[6, 36], [2, 37]], align: [6, 32, 58] },
    { version: 13, ecPerBlock: 22, blocks: [[8, 37], [1, 38]], align: [6, 34, 62] },
    { version: 14, ecPerBlock: 24, blocks: [[4, 40], [5, 41]], align: [6, 26, 46, 66] },
  ];

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

  function rsGenerator(degree) {
    let poly = new Uint8Array([1]);
    for (let i = 0; i < degree; i++) {
      const next = new Uint8Array(poly.length + 1);
      const root = GF_EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], root);
      }
      poly = next;
    }
    return poly;
  }

  function rsRemainder(data, ecLen) {
    const gen = rsGenerator(ecLen);
    const res = new Uint8Array(ecLen);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ res[0];
      res.copyWithin(0, 1);
      res[ecLen - 1] = 0;
      for (let j = 0; j < ecLen; j++) res[j] ^= gfMul(gen[j + 1], factor);
    }
    return res;
  }

  const totalDataCodewords = (v) => v.blocks.reduce((sum, [cnt, len]) => sum + cnt * len, 0);

  function pickVersion(byteLen) {
    for (const v of VERSIONS) {
      const ccBits = v.version >= 10 ? 16 : 8;
      if (4 + ccBits + byteLen * 8 <= totalDataCodewords(v) * 8) return v;
    }
    throw new Error(`QR payload too long (${byteLen} bytes)`);
  }

  function encodeCodewords(bytes, v) {
    const totalData = totalDataCodewords(v);
    const ccBits = v.version >= 10 ? 16 : 8;
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };

    pushBits(0b0100, 4);
    pushBits(bytes.length, ccBits);
    for (const b of bytes) pushBits(b, 8);

    const capBits = totalData * 8;
    const term = Math.min(4, capBits - bits.length);
    for (let i = 0; i < term; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const data = new Uint8Array(totalData);
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      data[i >> 3] = byte;
    }
    const padBytes = [0xec, 0x11];
    for (let i = bits.length >> 3, p = 0; i < totalData; i++, p ^= 1) data[i] = padBytes[p];

    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;
    let maxDataLen = 0;
    for (const [count, len] of v.blocks) {
      maxDataLen = Math.max(maxDataLen, len);
      for (let i = 0; i < count; i++) {
        const blk = data.subarray(offset, offset + len);
        offset += len;
        dataBlocks.push(blk);
        ecBlocks.push(rsRemainder(blk, v.ecPerBlock));
      }
    }

    const out = [];
    for (let i = 0; i < maxDataLen; i++) {
      for (const blk of dataBlocks) if (i < blk.length) out.push(blk[i]);
    }
    for (let i = 0; i < v.ecPerBlock; i++) {
      for (const ec of ecBlocks) out.push(ec[i]);
    }
    return new Uint8Array(out);
  }

  function buildMatrixTemplate(v) {
    const size = v.version * 4 + 17;
    const modules = new Uint8Array(size * size);
    const reserved = new Uint8Array(size * size);
    const setRes = (r, c, dark) => {
      const idx = r * size + c;
      modules[idx] = dark ? 1 : 0;
      reserved[idx] = 1;
    };

    const drawFinder = (r0, c0) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const r = r0 + dr;
          const c = c0 + dc;
          if (r < 0 || r >= size || c < 0 || c >= size) continue;
          const inBox = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          const dark = inBox && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
          setRes(r, c, dark);
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i++) {
      const dark = i % 2 === 0;
      if (!reserved[6 * size + i]) setRes(6, i, dark);
      if (!reserved[i * size + 6]) setRes(i, 6, dark);
    }

    for (const cr of v.align) {
      for (const cc of v.align) {
        if ((cr === 6 && cc === 6) || (cr === 6 && cc === size - 7) || (cr === size - 7 && cc === 6)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            setRes(cr + dr, cc + dc, Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
          }
        }
      }
    }

    setRes(size - 8, 8, true);
    for (let i = 0; i <= 8; i++) {
      if (i !== 6) {
        reserved[8 * size + i] = 1;
        reserved[i * size + 8] = 1;
      }
    }
    for (let i = size - 8; i < size; i++) reserved[8 * size + i] = 1;
    for (let i = size - 7; i < size; i++) reserved[i * size + 8] = 1;

    if (v.version >= 7) {
      let rem = v.version << 12;
      for (let i = 17; i >= 12; i--) if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
      const verBits = (v.version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const dark = ((verBits >>> i) & 1) === 1;
        const a = Math.floor(i / 3);
        const b = size - 11 + (i % 3);
        setRes(a, b, dark);
        setRes(b, a, dark);
      }
    }
    return { size, modules, reserved };
  }

  function placeDataBits(size, modules, reserved, codewords) {
    const totalBits = codewords.length * 8;
    let bitIdx = 0;
    let up = true;
    for (let col = size - 1; col >= 1; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < size; step++) {
        const r = up ? size - 1 - step : step;
        for (let dc = 0; dc < 2; dc++) {
          const c = col - dc;
          const idx = r * size + c;
          if (reserved[idx]) continue;
          let bit = 0;
          if (bitIdx < totalBits) {
            bit = (codewords[bitIdx >> 3] >>> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          modules[idx] = bit;
        }
      }
      up = !up;
    }
  }

  function maskBit(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }

  function applyFormatInfo(size, modules, mask) {
    let rem = mask << 10;
    for (let i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
    const bits = ((mask << 10) | rem) ^ 0x5412;

    for (let i = 0; i < 15; i++) {
      const dark = ((bits >>> i) & 1) === 1 ? 1 : 0;
      if (i < 6) modules[i * size + 8] = dark;
      else if (i < 8) modules[(i + 1) * size + 8] = dark;
      else modules[8 * size + (14 - i)] = dark;

      if (i < 8) modules[8 * size + (size - 1 - i)] = dark;
      else modules[(size - 15 + i) * size + 8] = dark;
    }
    modules[(size - 8) * size + 8] = 1;
  }

  function penaltyScore(size, modules) {
    let score = 0;
    for (let r = 0; r < size; r++) {
      let runColor = modules[r * size], runLen = 1;
      for (let c = 1; c < size; c++) {
        const cur = modules[r * size + c];
        if (cur === runColor) runLen++;
        else { if (runLen >= 5) score += 3 + (runLen - 5); runColor = cur; runLen = 1; }
      }
      if (runLen >= 5) score += 3 + (runLen - 5);
    }
    for (let c = 0; c < size; c++) {
      let runColor = modules[c], runLen = 1;
      for (let r = 1; r < size; r++) {
        const cur = modules[r * size + c];
        if (cur === runColor) runLen++;
        else { if (runLen >= 5) score += 3 + (runLen - 5); runColor = cur; runLen = 1; }
      }
      if (runLen >= 5) score += 3 + (runLen - 5);
    }
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = modules[r * size + c];
        if (v === modules[r * size + c + 1] && v === modules[(r + 1) * size + c] && v === modules[(r + 1) * size + c + 1]) score += 3;
      }
    }
    const matchFinderLike = (step, start) => {
      let hits = 0;
      for (let i = 0; i <= size - 11; i++) {
        const g = (k) => modules[start + (i + k) * step];
        const p1 = g(0) === 1 && g(1) === 0 && g(2) === 1 && g(3) === 1 && g(4) === 1 && g(5) === 0 && g(6) === 1 && g(7) === 0 && g(8) === 0 && g(9) === 0 && g(10) === 0;
        const p2 = g(0) === 0 && g(1) === 0 && g(2) === 0 && g(3) === 0 && g(4) === 1 && g(5) === 0 && g(6) === 1 && g(7) === 1 && g(8) === 1 && g(9) === 0 && g(10) === 1;
        if (p1 || p2) hits++;
      }
      return hits * 40;
    };
    for (let r = 0; r < size; r++) score += matchFinderLike(1, r * size);
    for (let c = 0; c < size; c++) score += matchFinderLike(size, c);
    let dark = 0;
    for (let i = 0; i < modules.length; i++) if (modules[i]) dark++;
    const pct = (dark * 100) / modules.length;
    score += Math.min(Math.abs(Math.floor(pct / 5) * 5 - 50) / 5, Math.abs(Math.ceil(pct / 5) * 5 - 50) / 5) * 10;
    return score;
  }

  function encodeMatrix(text) {
    const bytes = new TextEncoder().encode(String(text ?? ""));
    const v = pickVersion(bytes.length);
    const codewords = encodeCodewords(bytes, v);
    const { size, modules: base, reserved } = buildMatrixTemplate(v);
    placeDataBits(size, base, reserved, codewords);

    let bestScore = Infinity;
    let bestModules = new Uint8Array(base.length);
    for (let m = 0; m < 8; m++) {
      const candidate = new Uint8Array(base);
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const idx = r * size + c;
          if (!reserved[idx] && maskBit(m, r, c)) candidate[idx] ^= 1;
        }
      }
      applyFormatInfo(size, candidate, m);
      const s = penaltyScore(size, candidate);
      if (s < bestScore) {
        bestScore = s;
        bestModules = candidate;
      }
    }
    return { size, modules: Array.from(bestModules, (b) => b === 1) };
  }

  function toSvg(text, opts = {}) {
    const fg = opts.fg || "#0b0e14";
    const bg = opts.bg || "#ffffff";
    const margin = Math.max(0, Math.min(8, Math.round(opts.margin ?? 2)));
    const { size, modules } = encodeMatrix(text);
    const full = size + margin * 2;
    const parts = [];
    for (let r = 0; r < size; r++) {
      let runStart = -1;
      for (let c = 0; c <= size; c++) {
        const dark = c < size && modules[r * size + c];
        if (dark && runStart === -1) runStart = c;
        else if (!dark && runStart !== -1) {
          parts.push(`M${runStart + margin} ${r + margin}h${c - runStart}v1h-${c - runStart}z`);
          runStart = -1;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges"><rect width="${full}" height="${full}" fill="${bg}"/><path d="${parts.join("")}" fill="${fg}"/></svg>`;
  }

  function toDataUrl(text, opts = {}) {
    const svg = toSvg(text, opts);
    const bytes = new TextEncoder().encode(svg);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return `data:image/svg+xml;base64,${btoa(bin)}`;
  }

  const api = { encodeMatrix, toSvg, toDataUrl };
  if (typeof window !== "undefined") window.VADE_QR = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
