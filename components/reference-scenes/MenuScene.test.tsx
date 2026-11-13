import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ILLUSTRATOR_V4_MENU_ART } from "../../lib/illustrator-v4-menu-art-manifest";
import { MenuScene, menuSceneErrorMessage } from "./MenuScene";

describe("MenuScene v4", () => {
  it("uses the declared v4 source assets without retaining v3 menu crops or a fake logo", () => {
    const markup = renderToStaticMarkup(<MenuScene portrait={false} />);
    for (const art of Object.values(ILLUSTRATOR_V4_MENU_ART)) expect(markup).toContain(art.src);
    expect(markup).not.toContain("illustrator-v3/menu");
    expect(markup).not.toContain("ゲームロゴ");
  });

  it("keeps the disabled start mask tied to the same visual model in both layouts", () => {
    expect(renderToStaticMarkup(<MenuScene portrait={false} canStart={false} />)).toContain("source-menu__start-disabled");
    expect(renderToStaticMarkup(<MenuScene portrait canStart />)).not.toContain("source-menu__start-disabled");
  });

  it("hides only the redundant blank-name prompt while retaining meaningful validation errors", () => {
    expect(menuSceneErrorMessage("ランキング名を入力してください")).toBeUndefined();
    const markup = renderToStaticMarkup(<MenuScene portrait={false} nameError="ランキング名は20文字以内にしてください" />);
    expect(markup).toContain("source-menu__error");
    expect(markup).toContain("ニックネームは20文字以内にしてください");
  });

});
