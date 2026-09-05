export const I18N = "SHINOBI";

const key = value => String(value).startsWith(`${I18N}.`) ? String(value) : `${I18N}.${value}`;

export const t = value => globalThis.game?.i18n?.localize?.(key(value)) ?? key(value);
export const tf = (value, data = {}) => globalThis.game?.i18n?.format?.(key(value), data) ?? key(value);
export const localizedValue = value => typeof value === "string" && value.startsWith(`${I18N}.`) ? t(value) : value;
