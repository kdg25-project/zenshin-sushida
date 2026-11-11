#!/usr/bin/env node

/**
 * Makes the small, lossless Canvas sprites from the supplied pixel-art SVGs.
 *
 * The supplied files contain only 10×10px painted cells. Several exported SVGs
 * place their grid at e.g. y=9.88 and add a .25px black stroke to black cells;
 * rasterizing those SVGs at runtime leaves anti-aliased seams between cells.
 * This generator intentionally reads only the filled cell color and painter
 * order, rounds each cell to the source's 10px grid, and writes an opaque-or-
 * transparent PNG. It never writes to the supplied SVG source directory.
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
  ["akagai", "AKAGAI.svg"],
  ["binchoumaguro", "BINCHOUMAGURO.svg"],
  ["ebi", "EBI.svg"],
  ["hotate", "HOTATE.svg"],
  ["ikura", "IKURA.svg"],
  ["negitoro", "NEGITORO.svg"],
  ["saba", "SABA.svg"],
  ["tako", "TAKO.svg"],
  ["uni", "UNI.svg"],
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

function rasterize(sourceName, svg) {
  const viewBox = /viewBox="([^"\n]+)"/.exec(svg)?.[1].trim().split(/\s+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0 || !Number.isInteger(viewBox[2] / CELL) || !Number.isInteger(viewBox[3] / CELL)) throw new Error(`${sourceName}: unsupported viewBox`);
  const width = viewBox[2] / CELL, height = viewBox[3] / CELL;
  const fills = new Map();
  for (const match of svg.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const fill = /fill:\s*([^;\s}]+)/.exec(match[2])?.[1];
    if (fill) for (const selector of match[1].matchAll(/\.([\w-]+)/g)) fills.set(selector[1], fill);
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (const match of svg.matchAll(/<rect\b[^>]*\/>/g)) {
    const rect = attributes(match[0]);
    if (!rect.x || !rect.y || !rect.width || !rect.height) throw new Error(`${sourceName}: rect attributes are incomplete`);
    const fill = rect.class ? fills.get(rect.class) : "#000000";
    if (!fill) throw new Error(`${sourceName}: no fill for ${rect.class}`);
    const color = hexColor(fill, sourceName);
    if (!color) continue;
    const left = gridCoordinate(rect.x, sourceName, "x"), top = gridCoordinate(rect.y, sourceName, "y");
    const right = gridCoordinate(String(Number(rect.x) + Number(rect.width)), sourceName, "right");
    const bottom = gridCoordinate(String(Number(rect.y) + Number(rect.height)), sourceName, "bottom");
    if (left < 0 || top < 0 || right > width || bottom > height || right <= left || bottom <= top) throw new Error(`${sourceName}: rect is outside its viewBox`);
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) Buffer.from(color).copy(rgba, (y * width + x) * 4);
  }
  return { width, height, image: png(width, height, rgba) };
}

const check = process.argv.includes("--check");
const manifest = {};
let invalid = false;
for (const [id, sourceName] of DISHES) {
  const source = readFileSync(join(SOURCE_DIR, sourceName));
  const { width, height, image } = rasterize(sourceName, source.toString("utf8"));
  const output = join(OUTPUT_DIR, `${id}.png`);
  manifest[id] = { source: sourceName, sourceSha256: createHash("sha256").update(source).digest("hex"), width, height, alpha: "opaque-or-transparent" };
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
