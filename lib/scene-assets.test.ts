import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sceneAssetPaths } from "./sf-ui-assets";
import { ILLUSTRATOR_V4_MENU_ART } from "./illustrator-v4-menu-art-manifest";

const publicRoot = resolve(process.cwd(), "public");

function publicFile(source: string) {
  return resolve(publicRoot, source.replace(/^\//, ""));
}

describe("reference scene assets", () => {
  it("keeps every declared runtime scene asset in public output", () => {
    for (const [name, source] of Object.entries(sceneAssetPaths)) {
      expect(source, name).toMatch(/^\/assets\//);
      expect(existsSync(publicFile(source)), `${name}: ${source}`).toBe(true);
    }
  });

  it("keeps SVG opening tags free of duplicate XML attributes", () => {
    for (const source of Object.values(sceneAssetPaths).filter(source => source.endsWith(".svg"))) {
      const openingTag = readFileSync(publicFile(source), "utf8").match(/<(?:[\w-]+:)?svg\b[^>]*>/)?.[0];
      expect(openingTag, source).toBeTruthy();
      const names = [...openingTag!.matchAll(/\s([\w:-]+)=/g)].map(match => match[1]!);
      expect(new Set(names).size, source).toBe(names.length);
    }
  });

  it("keeps every menu v4 manifest URL available to the scene presenter", () => {
    for (const [name, art] of Object.entries(ILLUSTRATOR_V4_MENU_ART)) {
      expect(art.src, name).toMatch(/^\/assets\/illustrator-v4-menu\//);
      expect(existsSync(publicFile(art.src)), `${name}: ${art.src}`).toBe(true);
    }
  });

  it("retains an alpha channel on the source start art used for the disabled silhouette", () => {
    const png = readFileSync(publicFile(ILLUSTRATOR_V4_MENU_ART.menuV4Start.src));
    expect(png.subarray(12, 16).toString("ascii")).toBe("IHDR");
    // PNG color type 6 is RGBA, preserving the source button's transparent corners.
    expect(png[25]).toBe(6);
  });
});
