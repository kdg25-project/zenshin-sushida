#!/usr/bin/env node

/**
 * Makes the small, lossless Canvas sprites from the supplied pixel-art SVGs.
 *
 * Most supplied files contain only 10×10px painted cells. Several exported SVGs
 * place their grid at e.g. y=9.88 and add a .25px black stroke to black cells;
 * rasterizing those SVGs at runtime leaves anti-aliased seams between cells.
 * This generator intentionally reads only the filled cell color and painter
 * order, rounds each cell to the source's 10px grid, and writes an opaque-or-
 * transparent PNG. NAMAEBI and TEKKAMAKI have finer source grids, so they are
 * rasterized at their native 320×240 source resolution. It never writes to
 * the SVG sources.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SOURCE_DIR = join(ROOT, "public/assets/sushi-svg");
const OUTPUT_DIR = join(ROOT, "public/assets/sushi-pixel");
const CELL = 10;
const DISHES = [
  { id: "aigamo", sourceName: "AIGAMO.svg", mode: "native" },
  { id: "akagai", sourceName: "AKAGAI.svg", mode: "grid" },
  { id: "amaebi", sourceName: "AMAEBI.svg", mode: "native" },
  { id: "anago", sourceName: "ANAGO.svg", mode: "native" },
  { id: "binchoumaguro", sourceName: "BINCHOUMAGURO.svg", mode: "grid" },
  { id: "ebi", sourceName: "EBI.svg", mode: "grid" },
  { id: "ebiabokado", sourceName: "EBIABOKADO.svg", mode: "native" },
  { id: "ebitenn", sourceName: "EBITENN.svg", mode: "native" },
  { id: "hamachi", sourceName: "HAMACHI.svg", mode: "native" },
  { id: "hotate", sourceName: "HOTATE.svg", mode: "grid" },
  { id: "ika", sourceName: "IKA.svg", mode: "native" },
  { id: "ikatenn", sourceName: "IKATENN.svg", mode: "native" },
  { id: "ikura", sourceName: "IKURA.svg", mode: "grid" },
  { id: "inarizushi", sourceName: "INARIZUSHI.svg", mode: "native" },
  { id: "kappamaki", sourceName: "KAPPAMAKI.svg", mode: "native" },
  { id: "katsuo", sourceName: "KATSUO.svg", mode: "native" },
  { id: "koonn", sourceName: "KOONN.svg", mode: "native" },
  { id: "koontuna", sourceName: "KOONTUNA.svg", mode: "native" },
  { id: "madai", sourceName: "MADAI.svg", mode: "native" },
  { id: "maguro", sourceName: "MAGURO.svg", mode: "grid" },
  { id: "magutaku", sourceName: "MAGUTAKU.svg", mode: "native" },
  { id: "misosiru", sourceName: "MISOSIRU.svg", mode: "native" },
  { id: "namaebi", sourceName: "NAMAEBI.svg", mode: "native" },
  { id: "nattoumaki", sourceName: "NATTOUMAKI.svg", mode: "native" },
  { id: "negitoro", sourceName: "NEGITORO.svg", mode: "grid" },
  { id: "nianago", sourceName: "NIANAGO.svg", mode: "native" },
  { id: "pafe", sourceName: "PAFE.svg", mode: "native" },
  { id: "purin", sourceName: "PURIN.svg", mode: "native" },
  { id: "saamon", sourceName: "SAAMON.svg", mode: "native" },
  { id: "saba", sourceName: "SABA.svg", mode: "grid" },
  { id: "tako", sourceName: "TAKO.svg", mode: "grid" },
  { id: "takuann", sourceName: "TAKUANN.svg", mode: "native" },
  { id: "tamago", sourceName: "TAMAGO.svg", mode: "native" },
  { id: "tekka", sourceName: "TEKKAMAKI.svg", mode: "native" },
  { id: "torosaamonn", sourceName: "TOROSAAMONN.svg", mode: "native" },
  { id: "tyawanmusi", sourceName: "TYAWANMUSI.svg", mode: "native" },
  { id: "unagi", sourceName: "UNAGI.svg", mode: "native" },
  { id: "uni", sourceName: "UNI.svg", mode: "grid" },
  { id: "wasabinasu", sourceName: "WASABINASU.svg", mode: "native" },
];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const kind = Buffer.from(type, "ascii");
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([kind, data])));
  return Buffer.concat([length, kind, data, checksum]);
}

function png(width, height, rgba) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let row = 0; row < height; row++) {
    const output = row * (width * 4 + 1);
    scanlines[output] = 0;
    rgba.copy(scanlines, output + 1, row * width * 4, (row + 1) * width * 4);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0))]);
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
}

function rects(svg) {
  return [...svg.matchAll(/<rect\b[^>]*\/>/g)].map(match => ({ tag: match[0], attributes: attributes(match[0]) }));
}

function hexColor(value, source) {
  if (value === "none") return undefined;
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value);
  if (!match) throw new Error(`${source}: unsupported fill ${value}`);
  const raw = match[1].length === 3 ? [...match[1]].map(char => char + char).join("") : match[1];
  return [Number.parseInt(raw.slice(0, 2), 16), Number.parseInt(raw.slice(2, 4), 16), Number.parseInt(raw.slice(4, 6), 16), 255];
}

function gridCoordinate(value, source, attribute) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${source}: invalid ${attribute}`);
  const grid = Math.round(number / CELL);
  if (Math.abs(number - grid * CELL) > .25) throw new Error(`${source}: ${attribute}=${value} is not on the 10px grid`);
  return grid;
}

function viewBox(sourceName, svg, grid = false) {
  const viewBox = /viewBox="([^"\n]+)"/.exec(svg)?.[1].trim().split(/\s+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0 || !Number.isFinite(viewBox[2]) || !Number.isFinite(viewBox[3]) || viewBox[2] <= 0 || viewBox[3] <= 0 || (grid && (!Number.isInteger(viewBox[2] / CELL) || !Number.isInteger(viewBox[3] / CELL)))) throw new Error(`${sourceName}: unsupported viewBox`);
  return { width: grid ? viewBox[2] / CELL : Math.ceil(viewBox[2]), height: grid ? viewBox[3] / CELL : Math.ceil(viewBox[3]) };
}

function cssFills(svg) {
  const fills = new Map();
  for (const style of svg.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const match of style[1].matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const fill = /fill:\s*([^;\s}]+)/.exec(match[2])?.[1];
      if (fill) for (const selector of match[1].matchAll(/\.([\w-]+)/g)) fills.set(selector[1], fill);
    }
  }
  return fills;
}

function fillFor(rect, fills) {
  const classNames = rect.class?.trim().split(/\s+/) ?? [];
  for (const className of classNames) if (fills.has(className)) return fills.get(className);
  // SVG's initial fill is black. A stroke-only CSS class still paints black.
  return rect.fill ?? "#000000";
}

function paintRect(rgba, width, left, top, right, bottom, [red, green, blue, alpha]) {
  for (let y = top; y < bottom; y++) {
    let offset = (y * width + left) * 4;
    for (let x = left; x < right; x++) {
      rgba[offset++] = red;
      rgba[offset++] = green;
      rgba[offset++] = blue;
      rgba[offset++] = alpha;
    }
  }
}

function transformMatrix(value, sourceName) {
  const matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  if (!value) return matrix;
  const operations = [...value.matchAll(/(translate|rotate)\(([^)]+)\)/g)];
  if (!operations.length || operations.map(match => match[0]).join(" ") !== value.trim().replace(/\s+/g, " ")) throw new Error(`${sourceName}: unsupported transform ${value}`);
  for (const [, kind, raw] of operations) {
    const values = raw.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (values.some(value => !Number.isFinite(value))) throw new Error(`${sourceName}: invalid transform ${value}`);
    let next;
    if (kind === "translate" && (values.length === 1 || values.length === 2)) next = { a: 1, b: 0, c: 0, d: 1, e: values[0], f: values[1] ?? 0 };
    else if (kind === "rotate" && values.length === 1) { const radians = values[0] * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians); next = { a: cosine, b: sine, c: -sine, d: cosine, e: 0, f: 0 }; }
    else throw new Error(`${sourceName}: unsupported transform ${value}`);
    const current = { ...matrix };
    matrix.a = current.a * next.a + current.c * next.b;
    matrix.b = current.b * next.a + current.d * next.b;
    matrix.c = current.a * next.c + current.c * next.d;
    matrix.d = current.b * next.c + current.d * next.d;
    matrix.e = current.a * next.e + current.c * next.f + current.e;
    matrix.f = current.b * next.e + current.d * next.f + current.f;
  }
  return matrix;
}

function transformedPoint(matrix, x, y) { return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f }; }

function paintTransformedRect(rgba, width, height, rect, matrix, color) {
  const corners = [transformedPoint(matrix, rect.x, rect.y), transformedPoint(matrix, rect.x + rect.width, rect.y), transformedPoint(matrix, rect.x + rect.width, rect.y + rect.height), transformedPoint(matrix, rect.x, rect.y + rect.height)];
  const left = Math.max(0, Math.floor(Math.min(...corners.map(point => point.x))));
  const top = Math.max(0, Math.floor(Math.min(...corners.map(point => point.y))));
  const right = Math.min(width, Math.ceil(Math.max(...corners.map(point => point.x))));
  const bottom = Math.min(height, Math.ceil(Math.max(...corners.map(point => point.y))));
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Math.abs(determinant) < 1e-9) throw new Error("non-invertible SVG transform");
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const dx = x + .5 - matrix.e, dy = y + .5 - matrix.f;
    const sourceX = (matrix.d * dx - matrix.c * dy) / determinant;
    const sourceY = (-matrix.b * dx + matrix.a * dy) / determinant;
    if (sourceX >= rect.x && sourceX < rect.x + rect.width && sourceY >= rect.y && sourceY < rect.y + rect.height) paintRect(rgba, width, x, y, x + 1, y + 1, color);
  }
}

function rasterizeGrid(sourceName, svg) {
  const { width, height } = viewBox(sourceName, svg, true);
  const fills = cssFills(svg);
  const rgba = Buffer.alloc(width * height * 4);
  for (const entry of rects(svg)) {
    const rect = entry.attributes;
    if (!rect.x || !rect.y || !rect.width || !rect.height) throw new Error(`${sourceName}: rect attributes are incomplete`);
    const color = hexColor(fillFor(rect, fills), sourceName);
    if (!color) continue;
    const left = gridCoordinate(rect.x, sourceName, "x"), top = gridCoordinate(rect.y, sourceName, "y");
    const right = gridCoordinate(String(Number(rect.x) + Number(rect.width)), sourceName, "right");
    const bottom = gridCoordinate(String(Number(rect.y) + Number(rect.height)), sourceName, "bottom");
    if (left < 0 || top < 0 || right > width || bottom > height || right <= left || bottom <= top) throw new Error(`${sourceName}: rect is outside its viewBox`);
    paintRect(rgba, width, left, top, right, bottom, color);
  }
  return { width, height, image: png(width, height, rgba) };
}

function nativeCoordinate(value, sourceName, attribute) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${sourceName}: invalid ${attribute}`);
  return number;
}

function rasterizeNative(sourceName, svg) {
  const { width, height } = viewBox(sourceName, svg);
  const sourceRects = rects(svg);
  const fills = cssFills(svg), rgba = Buffer.alloc(width * height * 4);
  // Retain every painted source rect in painter order. Strokes are deliberately
  // ignored so the exported .25px grid lines cannot introduce anti-aliasing.
  for (const entry of sourceRects) {
    const rect = entry.attributes;
    if (!rect.width || !rect.height) throw new Error(`${sourceName}: rect attributes are incomplete`);
    const color = hexColor(fillFor(rect, fills), sourceName);
    if (!color) continue;
    const x = nativeCoordinate(rect.x ?? "0", sourceName, "x"), y = nativeCoordinate(rect.y ?? "0", sourceName, "y");
    const rectWidth = nativeCoordinate(rect.width, sourceName, "width"), rectHeight = nativeCoordinate(rect.height, sourceName, "height");
    const matrix = transformMatrix(rect.transform, sourceName);
    if (rect.transform) paintTransformedRect(rgba, width, height, { x, y, width: rectWidth, height: rectHeight }, matrix, color);
    else {
      const left = Math.max(0, Math.round(x)), top = Math.max(0, Math.round(y));
      const right = Math.min(width, Math.round(x + rectWidth)), bottom = Math.min(height, Math.round(y + rectHeight));
      if (right <= left || bottom <= top) continue;
      paintRect(rgba, width, left, top, right, bottom, color);
    }
  }
  return { width, height, image: png(width, height, rgba) };
}

function rasterize(sourceName, svg, mode) {
  if (mode === "grid") return rasterizeGrid(sourceName, svg);
  if (mode === "native") return rasterizeNative(sourceName, svg);
  throw new Error(`${sourceName}: unsupported raster mode ${mode}`);
}

const check = process.argv.includes("--check");
const manifest = {};
let invalid = false;
for (const { id, sourceName, mode } of DISHES) {
  const source = readFileSync(join(SOURCE_DIR, sourceName));
  const { width, height, image } = rasterize(sourceName, source.toString("utf8"), mode);
  const output = join(OUTPUT_DIR, `${id}.png`);
  manifest[id] = { source: sourceName, sourceSha256: createHash("sha256").update(source).digest("hex"), width, height, alpha: "opaque-or-transparent", mode };
  if (check) {
    try { if (!readFileSync(output).equals(image)) { console.error(`${id}: generated PNG differs`); invalid = true; } }
    catch { console.error(`${id}: generated PNG is missing`); invalid = true; }
  } else {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(output, image);
  }
}
const manifestOutput = `${JSON.stringify(manifest, null, 2)}\n`;
if (check) {
  try { if (readFileSync(join(OUTPUT_DIR, "manifest.json"), "utf8") !== manifestOutput) { console.error("manifest: generated data differs"); invalid = true; } }
  catch { console.error("manifest: missing"); invalid = true; }
} else writeFileSync(join(OUTPUT_DIR, "manifest.json"), manifestOutput);
if (invalid) process.exitCode = 1;
