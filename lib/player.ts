export const PLAYER_NAME_MAX_LENGTH = 20;

export function normalizePlayerName(value: string) {
  return value.trim();
}

/** Mirrors the Worker-side ranking name contract before a round is started. */
export function playerNameError(value: string) {
  const name = normalizePlayerName(value);
  if (!name) return "ランキング名を入力してください";
  if (name.length > PLAYER_NAME_MAX_LENGTH) return `ランキング名は${PLAYER_NAME_MAX_LENGTH}文字以内にしてください`;
  return undefined;
}
