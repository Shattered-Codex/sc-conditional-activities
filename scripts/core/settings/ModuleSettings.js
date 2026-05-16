import { Constants } from "../Constants.js";

export class ModuleSettings {
  static SETTING_SUPPORT_MENU = "supportMenu";
  static SETTING_DOCUMENTATION_MENU = "docsMenu";
  static SETTING_HIDE_UNAVAILABLE_ACTIVITY_CHOICES = "hideUnavailableActivityChoices";

  static hideUnavailableActivityChoices() {
    return Boolean(game.settings.get(Constants.MODULE_ID, ModuleSettings.SETTING_HIDE_UNAVAILABLE_ACTIVITY_CHOICES));
  }
}
