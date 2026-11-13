import type { CSSProperties } from "react";
import React from "react";
import { ILLUSTRATOR_V4_MENU_ART, type IllustratorV4MenuArt } from "../../lib/illustrator-v4-menu-art-manifest";

/**
 * Decoration-only menu layer. The editable input and every click target remain
 * in GameCanvas so this component can never steal focus or a pointer event.
 */
export type MenuSceneProps = {
  portrait: boolean;
  nameError?: string;
  canStart?: boolean;
};

const ARTBOARD_SCALE = 1200 / 1920;

function menuArtStyle(art: IllustratorV4MenuArt): CSSProperties {
  const { x, y, width, height } = art.renderBounds;
  return {
    "--menu-art-x": `${x * ARTBOARD_SCALE}px`,
    "--menu-art-y": `${y * ARTBOARD_SCALE}px`,
    "--menu-art-width": `${width * ARTBOARD_SCALE}px`,
    "--menu-art-height": `${height * ARTBOARD_SCALE}px`,
  } as CSSProperties;
}

function MenuArt({ className, art }: { className: string; art: IllustratorV4MenuArt }) {
  return <img className={className} src={art.src} style={menuArtStyle(art)} alt="" />;
}

/** The empty-name prompt is redundant next to the disabled source CTA. */
export function menuSceneErrorMessage(nameError: string | undefined) {
  const message = nameError?.replace("ランキング名", "ニックネーム");
  return message === "ニックネームを入力してください" ? undefined : message;
}

export function MenuScene({ portrait, nameError, canStart = true }: MenuSceneProps) {
  const art = ILLUSTRATOR_V4_MENU_ART;
  const visibleError = menuSceneErrorMessage(nameError);
  return <section className="source-scene source-scene--menu" data-portrait={portrait || undefined} data-can-start={canStart || undefined} aria-hidden="true">
    {/* The runtime-safe composite has every desktop source primitive, including a clean input bed. */}
    <MenuArt className="source-menu__stage" art={art.menuV4Stage} />
    {/* The separate crop is used only by the intentional portrait composition. */}
    <MenuArt className="source-menu__input-clean" art={art.menuV4Input} />

    {/* Portrait intentionally recomposes the source primitives instead of shrinking a landscape screenshot. */}
    <MenuArt className="source-menu__portrait-art source-menu__portrait-art--title" art={art.menuV4Title} />
    <MenuArt className="source-menu__portrait-art source-menu__portrait-art--start" art={art.menuV4Start} />
    <MenuArt className="source-menu__portrait-art source-menu__portrait-art--ranking" art={art.menuV4RankingNav} />
    <MenuArt className="source-menu__portrait-art source-menu__portrait-art--poses" art={art.menuV4PoseNav} />
    <MenuArt className="source-menu__portrait-art source-menu__portrait-art--tea" art={art.menuV4Tea} />
    <MenuArt className="source-menu__portrait-art source-menu__portrait-art--plate" art={art.menuV4PlateStack} />

    {!canStart ? <span className="source-menu__start-disabled" aria-hidden="true" /> : null}
    {visibleError ? <p className="source-menu__error">{visibleError}</p> : null}
  </section>;
}
