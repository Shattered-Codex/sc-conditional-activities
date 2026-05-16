import { Constants } from "./core/Constants.js";
import { ModuleSettingsRegistrar } from "./core/settings/ModuleSettingsRegistrar.js";
import { ActivitySheetConditionTab } from "./core/integration/ActivitySheetConditionTab.js";
import { ActivityUseGuard } from "./core/integration/ActivityUseGuard.js";
import { ActivityChoiceVisibility } from "./core/integration/ActivityChoiceVisibility.js";
import { ActivityConditionBadges } from "./core/ui/ActivityConditionBadges.js";

Hooks.once("init", () => {
  const settings = new ModuleSettingsRegistrar();
  settings.register();
});

Hooks.once("setup", () => {
  if (!Constants.isDnd5eActive()) {
    const message = `${Constants.MODULE_ID} only supports the dnd5e system.`;
    console.warn(`[${Constants.MODULE_ID}] ${message}`);
    ui.notifications?.warn?.(message);
    return;
  }

  ActivitySheetConditionTab.activate();
  ActivityUseGuard.activate();
  ActivityChoiceVisibility.activate();
  ActivityConditionBadges.activate();
});

Hooks.once("ready", () => {
  ActivitySheetConditionTab.activate();
  ActivityUseGuard.activate();
  ActivityChoiceVisibility.activate();
});

Hooks.once("tidy5e-sheet.ready", () => {
  ActivitySheetConditionTab.activate();
  ActivityUseGuard.activate();
  ActivityChoiceVisibility.activate();
});
