import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sceneAssetPaths } from "./sf-ui-assets";

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
});
