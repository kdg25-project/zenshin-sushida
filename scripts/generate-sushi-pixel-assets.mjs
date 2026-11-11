#!/usr/bin/env node

/**
 * Makes the small, lossless Canvas sprites from the supplied pixel-art SVGs.
 *
 * Most supplied files contain only 10×10px painted cells. Several exported SVGs
 * place their grid at e.g. y=9.88 and add a .25px black stroke to black cells;
 * rasterizing those SVGs at runtime leaves anti-aliased seams between cells.
 * This generator intentionally reads only the filled cell color and painter
 * order, rounds each cell to the source's 10px grid, and writes an opaque-or-
 * transparent PNG. TEKKAMAKI is a separately supplied illustration with an
 * 8.43×8.09px foreground grid plus an Illustrator export background layer; it
 * is rendered at its native 320×240 source pixels after proving the complete
 * 32×24 grid and omitting only its gray cls-3 background cells. It never writes
 * to the SVG sources.
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
  { id: "akagai", sourceName: "AKAGAI.svg", mode: "grid" },
  { id: "binchoumaguro", sourceName: "BINCHOUMAGURO.svg", mode: "grid" },
  { id: "ebi", sourceName: "EBI.svg", mode: "grid" },
  { id: "hotate", sourceName: "HOTATE.svg", mode: "grid" },
  { id: "ikura", sourceName: "IKURA.svg", mode: "grid" },
  { id: "maguro", sourceName: "MAGURO.svg", mode: "grid" },
  { id: "negitoro", sourceName: "NEGITORO.svg", mode: "grid" },
  { id: "saba", sourceName: "SABA.svg", mode: "grid" },
  { id: "tako", sourceName: "TAKO.svg", mode: "grid" },
  { id: "tekka", sourceName: "TEKKAMAKI.svg", mode: "native-no-export-grid" },
  { id: "uni", sourceName: "UNI.svg", mode: "grid" },
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
  if (!viewBox || viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0 || !Number.isInteger(viewBox[2]) || !Number.isInteger(viewBox[3]) || (grid && (!Number.isInteger(viewBox[2] / CELL) || !Number.isInteger(viewBox[3] / CELL)))) throw new Error(`${sourceName}: unsupported viewBox`);
  return { width: grid ? viewBox[2] / CELL : viewBox[2], height: grid ? viewBox[3] / CELL : viewBox[3] };
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

function exportGridBoundary(entries, width, height) {
  const expected = width / CELL * (height / CELL);
  const firstForeground = entries.findIndex(({ attributes: rect }) => rect.width !== "10" || rect.height !== "10");
  const background = entries.slice(0, firstForeground === -1 ? entries.length : firstForeground);
  if (!Number.isInteger(expected) || background.length < expected || background.length > expected + 1) return undefined;
  const cells = new Set();
  for (const { attributes: rect } of background) {
    const x = Number(rect.x ?? 0), y = Number(rect.y ?? 0);
    const column = Math.round(x / CELL), row = Math.round(y / CELL);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x - column * CELL) > .25 || Math.abs(y - row * CELL) > .25 || column < 0 || column >= width / CELL || row < 0 || row >= height / CELL) return undefined;
    cells.add(`${column},${row}`);
  }
  return cells.size === expected ? background.length : undefined;
}

function nativeCoordinate(value, sourceName, attribute) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${sourceName}: invalid ${attribute}`);
  return number;
}

function rasterizeNativeWithoutExportGrid(sourceName, svg) {
  const { width, height } = viewBox(sourceName, svg);
  const sourceRects = rects(svg);
  const gridBoundary = exportGridBoundary(sourceRects, width, height);
  if (gridBoundary === undefined) throw new Error(`${sourceName}: expected a complete 10px export-grid background`);
  if (sourceRects.slice(gridBoundary).some(({ attributes: rect }) => rect.class === "cls-3")) throw new Error(`${sourceName}: cls-3 is not confined to the verified export grid`);
  const fills = cssFills(svg), rgba = Buffer.alloc(width * height * 4);
  // The first 32×24 cells (plus one exporter duplicate within .25px) enumerate
  // every viewport cell. Only their cls-3 gray cells are the Illustrator canvas
  // grid; the black outlines and blue plate in that same layer are foreground.
  for (const [index, entry] of sourceRects.entries()) {
    const rect = entry.attributes;
    if (index < gridBoundary && rect.class === "cls-3") continue;
    if (!rect.width || !rect.height) throw new Error(`${sourceName}: rect attributes are incomplete`);
    const color = hexColor(fillFor(rect, fills), sourceName);
    if (!color) continue;
    const x = nativeCoordinate(rect.x ?? "0", sourceName, "x"), y = nativeCoordinate(rect.y ?? "0", sourceName, "y");
    const rectWidth = nativeCoordinate(rect.width, sourceName, "width"), rectHeight = nativeCoordinate(rect.height, sourceName, "height");
    const left = Math.max(0, Math.round(x)), top = Math.max(0, Math.round(y));
    const right = Math.min(width, Math.round(x + rectWidth)), bottom = Math.min(height, Math.round(y + rectHeight));
    if (right <= left || bottom <= top) continue;
    paintRect(rgba, width, left, top, right, bottom, color);
  }
  return { width, height, image: png(width, height, rgba) };
}

function rasterize(sourceName, svg, mode) {
  if (mode === "grid") return rasterizeGrid(sourceName, svg);
  if (mode === "native-no-export-grid") return rasterizeNativeWithoutExportGrid(sourceName, svg);
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
