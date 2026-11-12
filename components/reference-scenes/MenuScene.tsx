import React from "react";

/**
 * Decoration-only menu layer. The editable input and every click target remain
 * in GameCanvas so this component can never steal focus or a pointer event.
 */
export type MenuSceneProps = {
  portrait: boolean;
  nameError?: string;
  canStart?: boolean;
};

export function MenuScene({ portrait, nameError, canStart = true }: MenuSceneProps) {
  return <section className="source-scene source-scene--menu" data-portrait={portrait || undefined} data-can-start={canStart || undefined} aria-hidden="true">
    <div className="source-menu__art" />
    <h1 className="source-menu__logo">ゲームロゴ</h1>
    <img className="source-menu__title-source" src="/assets/illustrator-v3/menu-title-source.png" alt="" />
    <span className="source-menu__input-label">ニックネーム</span>
    {/* Source-font label, red inset and pencil with only its measured placeholder removed. */}
    <img className="source-menu__input-clean" src="/assets/illustrator-v3/menu-input-source-clean.png" alt="" />
    <img className="source-menu__start-source" src="/assets/illustrator-v3/menu-start-source-tight.png" alt="" />
    <img className="source-menu__tea" src="/assets/sf-ui/menu-tea.png" alt="" />
    <span className="source-menu__portrait-start">あそぶ</span>
    <img className="source-menu__navigation-source" src="/assets/illustrator-v3/menu-navigation-source.png" alt="" />
    {!canStart ? <span className="source-menu__start-disabled" /> : null}
    <span className="source-menu__nav-label source-menu__nav-label--ranking">ランキング</span>
    <span className="source-menu__nav-label source-menu__nav-label--poses">ポーズ一覧</span>
    {nameError ? <p className="source-menu__error">{nameError.replace("ランキング名", "ニックネーム")}</p> : null}
  </section>;
}
