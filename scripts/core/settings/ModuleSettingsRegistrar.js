import { Constants } from "../Constants.js";
import { ModuleSettings } from "./ModuleSettings.js";
import { SupportMenu } from "./SupportMenu.js";
import { DocumentationMenu } from "./DocumentationMenu.js";

export class ModuleSettingsRegistrar {
  #registered = false;

  register() {
    if (this.#registered) {
      return;
    }
    this.#registered = true;

    this.#registerHideUnavailableActivityChoicesSetting();
    this.#registerSupportMenu();
    this.#registerDocumentationMenu();

    Hooks.on("renderSettingsConfig", (_app, html) => {
      SupportMenu.bindSettingsButton(html);
      DocumentationMenu.bindSettingsButton(html);
    });
  }

  #registerHideUnavailableActivityChoicesSetting() {
    game.settings.register(Constants.MODULE_ID, ModuleSettings.SETTING_HIDE_UNAVAILABLE_ACTIVITY_CHOICES, {
      name: Constants.localize(
        "SCConditionalActivities.Settings.HideUnavailableActivityChoices.Name",
        "Hide unavailable activities in the choice dialog"
      ),
      hint: Constants.localize(
        "SCConditionalActivities.Settings.HideUnavailableActivityChoices.Hint",
        "When enabled, activities blocked by conditions are removed from the activity choice dialog."
      ),
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      restricted: true
    });
  }

  #registerSupportMenu() {
    game.settings.registerMenu(Constants.MODULE_ID, ModuleSettings.SETTING_SUPPORT_MENU, {
      name: Constants.localize("SCConditionalActivities.Settings.SupportMenu.Name", "Support the developer"),
      label: Constants.localize("SCConditionalActivities.Settings.SupportMenu.Label", "Patreon support"),
      hint: Constants.localize(
        "SCConditionalActivities.Settings.SupportMenu.Hint",
        "Support Shattered Codex development on Patreon."
      ),
      icon: "fas fa-heart",
      type: SupportMenu,
      restricted: true
    });
  }

  #registerDocumentationMenu() {
    game.settings.registerMenu(Constants.MODULE_ID, ModuleSettings.SETTING_DOCUMENTATION_MENU, {
      name: Constants.localize("SCConditionalActivities.Settings.DocumentationMenu.Name", "Documentation"),
      label: Constants.localize("SCConditionalActivities.Settings.DocumentationMenu.Label", "Open wiki"),
      hint: Constants.localize(
        "SCConditionalActivities.Settings.DocumentationMenu.Hint",
        "Open the SC - Conditional Activities documentation wiki."
      ),
      icon: "fas fa-hat-wizard",
      type: DocumentationMenu,
      restricted: true
    });
  }
}
