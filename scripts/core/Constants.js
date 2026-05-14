export class Constants {
  static MODULE_ID = "sc-conditional-activities";
  static MODULE_WIKI_URL = "https://wiki.shattered-codex.com/modules/sc-conditional-activities";
  static PATREON_URL = "https://www.patreon.com/c/shatteredcodex?utm_source=sc-conditional-activities&utm_medium=foundry_module&utm_campaign=support_button";
  static FLAG_CONDITION = "condition";
  static FLAG_WARNING_MESSAGE = "warningMessage";
  static FLAG_BADGE_LABEL = "badgeLabel";
  static BADGE_LABEL_MAX_LENGTH = 36;
  static CONDITION_FLAG_PATH = `flags.${Constants.MODULE_ID}.${Constants.FLAG_CONDITION}`;
  static WARNING_MESSAGE_FLAG_PATH = `flags.${Constants.MODULE_ID}.${Constants.FLAG_WARNING_MESSAGE}`;
  static BADGE_LABEL_FLAG_PATH = `flags.${Constants.MODULE_ID}.${Constants.FLAG_BADGE_LABEL}`;

  static localize(key, fallback = key) {
    const i18n = game?.i18n;
    const localized = typeof i18n?.localize === "function" ? i18n.localize(key) : undefined;
    if (localized && localized !== key) {
      return localized;
    }
    return fallback ?? key;
  }

  static isDnd5eActive() {
    return game?.system?.id === "dnd5e" && Boolean(globalThis.dnd5e);
  }
}
