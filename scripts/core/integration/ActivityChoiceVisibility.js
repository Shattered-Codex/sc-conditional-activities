import { Constants } from "../Constants.js";
import { ActivityConditionService } from "../services/ActivityConditionService.js";
import { ModuleSettings } from "../settings/ModuleSettings.js";

const ITEM_USE_PATCHED = Symbol.for(`${Constants.MODULE_ID}.ActivityChoiceVisibility.itemUsePatched`);
const DIALOG_CREATE_PATCHED = Symbol.for(`${Constants.MODULE_ID}.ActivityChoiceVisibility.dialogCreatePatched`);
const DIALOG_PREPARE_CONTEXT_PATCHED = Symbol.for(`${Constants.MODULE_ID}.ActivityChoiceVisibility.dialogPrepareContextPatched`);
const VISIBLE_ACTIVITY_IDS_OPTION = `${Constants.MODULE_ID}.visibleActivityIds`;
const ITEM_USE_TARGET = "dnd5e.documents.Item5e.prototype.use";
const DIALOG_CREATE_TARGET = "dnd5e.applications.activity.ActivityChoiceDialog.create";
const DIALOG_PREPARE_CONTEXT_TARGET = "dnd5e.applications.activity.ActivityChoiceDialog.prototype._prepareContext";

export class ActivityChoiceVisibility {
  static #libWrapperTargets = new Set();

  static activate() {
    if (!Constants.isDnd5eActive()) {
      return;
    }

    if (globalThis.libWrapper?.register) {
      ActivityChoiceVisibility.#installLibWrapperWrappers();
      return;
    }

    const dialogClass = dnd5e?.applications?.activity?.ActivityChoiceDialog;
    const itemClass = CONFIG?.Item?.documentClass;
    ActivityChoiceVisibility.#patchDialogClass(dialogClass);
    ActivityChoiceVisibility.#patchItemClass(itemClass);
  }

  static async #getActivityEntries(item) {
    const activities = item?.system?.activities?.filter?.((activity) => activity.canUse) ?? [];
    return Promise.all(activities.map(async (activity) => {
      if (!ActivityConditionService.hasCondition(activity)) {
        return {
          activity,
          result: { available: true, error: null }
        };
      }

      return {
        activity,
        result: await ActivityConditionService.evaluate(activity, { source: "activity-choice" })
      };
    }));
  }

  static #patchDialogClass(dialogClass) {
    ActivityChoiceVisibility.#wrapCreate(dialogClass);
    ActivityChoiceVisibility.#wrapPrepareContext(dialogClass);
  }

  static #wrapCreate(dialogClass) {
    if (!dialogClass || Object.prototype.hasOwnProperty.call(dialogClass, DIALOG_CREATE_PATCHED)) {
      return;
    }

    const original = dialogClass.create;
    if (typeof original !== "function") {
      return;
    }

    dialogClass[DIALOG_CREATE_PATCHED] = true;
    dialogClass.create = async function(item, options = {}) {
      return ActivityChoiceVisibility.#handleDialogCreate.call(this, original, item, options);
    };
  }

  static #wrapPrepareContext(dialogClass) {
    const prototype = dialogClass?.prototype;
    if (!prototype || Object.prototype.hasOwnProperty.call(prototype, DIALOG_PREPARE_CONTEXT_PATCHED)) {
      return;
    }

    const original = dialogClass.prototype._prepareContext;
    if (typeof original !== "function") {
      return;
    }

    prototype[DIALOG_PREPARE_CONTEXT_PATCHED] = true;
    dialogClass.prototype._prepareContext = async function(options) {
      return ActivityChoiceVisibility.#handlePrepareContext.call(this, original, options);
    };
  }

  static #patchItemClass(itemClass) {
    const prototype = itemClass?.prototype;
    if (!prototype || Object.prototype.hasOwnProperty.call(prototype, ITEM_USE_PATCHED) || typeof prototype.use !== "function") {
      return;
    }

    prototype[ITEM_USE_PATCHED] = true;
    const original = prototype.use;
    prototype.use = async function(config = {}, dialog = {}, message = {}) {
      return ActivityChoiceVisibility.#handleItemUse.call(this, original, config, dialog, message);
    };
  }

  static #installLibWrapperWrappers() {
    ActivityChoiceVisibility.#installLibWrapperWrapper(ITEM_USE_TARGET, function(wrapped, config = {}, dialog = {}, message = {}) {
      return ActivityChoiceVisibility.#handleItemUse.call(this, wrapped, config, dialog, message);
    }, () => ActivityChoiceVisibility.#patchItemClass(CONFIG?.Item?.documentClass));

    ActivityChoiceVisibility.#installLibWrapperWrapper(DIALOG_CREATE_TARGET, function(wrapped, item, options = {}) {
      return ActivityChoiceVisibility.#handleDialogCreate.call(this, wrapped, item, options);
    }, () => ActivityChoiceVisibility.#wrapCreate(dnd5e?.applications?.activity?.ActivityChoiceDialog));

    ActivityChoiceVisibility.#installLibWrapperWrapper(
      DIALOG_PREPARE_CONTEXT_TARGET,
      function(wrapped, options) {
        return ActivityChoiceVisibility.#handlePrepareContext.call(this, wrapped, options);
      },
      () => ActivityChoiceVisibility.#wrapPrepareContext(dnd5e?.applications?.activity?.ActivityChoiceDialog)
    );
  }

  static #installLibWrapperWrapper(target, wrapper, fallback) {
    if (ActivityChoiceVisibility.#libWrapperTargets.has(target)) {
      return;
    }

    try {
      globalThis.libWrapper.register(Constants.MODULE_ID, target, wrapper, "MIXED");
      ActivityChoiceVisibility.#libWrapperTargets.add(target);
    } catch (error) {
      console.warn(`[${Constants.MODULE_ID}] could not wrap ${target}`, error);
      fallback?.();
    }
  }

  static async #handleDialogCreate(wrapped, item, options = {}) {
    if (!ModuleSettings.hideUnavailableActivityChoices()) {
      return wrapped.call(this, item, options);
    }

    const visibleActivities = ActivityChoiceVisibility.#getVisibleActivitiesFromOptions(item, options);
    if (visibleActivities) {
      if (!visibleActivities.length) {
        return null;
      }

      if (visibleActivities.length === 1) {
        return visibleActivities[0];
      }

      return wrapped.call(this, item, options);
    }

    const entries = await ActivityChoiceVisibility.#getActivityEntries(item);
    const availableEntries = entries.filter(({ result }) => result.available);
    if (!availableEntries.length) {
      const unavailableEntry = entries.find(({ result }) => !result.available) ?? null;
      ActivityChoiceVisibility.#warnUnavailableActivity(unavailableEntry?.activity ?? null, unavailableEntry?.result?.error ?? null);
      return null;
    }

    const activities = availableEntries.map(({ activity }) => activity);
    if (activities.length === 1) {
      return activities[0];
    }

    return wrapped.call(this, item, {
      ...options,
      [VISIBLE_ACTIVITY_IDS_OPTION]: activities.map((activity) => activity.id)
    });
  }

  static async #handlePrepareContext(wrapped, options) {
    const context = await wrapped.call(this, options);
    if (!Array.isArray(context?.activities)) {
      return context;
    }

    const visibleIds = await ActivityChoiceVisibility.#resolveVisibleActivityIds(this.item, this.options);
    if (!visibleIds) {
      return context;
    }

    return {
      ...context,
      activities: context.activities.filter((activity) => visibleIds.has(activity.id))
    };
  }

  static async #resolveVisibleActivityIds(item, options) {
    const fromOptions = ActivityChoiceVisibility.#getVisibleActivitiesFromOptions(item, options);
    if (fromOptions) {
      return new Set(fromOptions.map((activity) => activity.id));
    }

    // The dialog was opened without our visibility hint (e.g. by another module such as
    // Midi-QOL wrapping Item5e#use). Evaluate the conditions here so unavailable activities
    // are still hidden regardless of who created the dialog.
    if (!ModuleSettings.hideUnavailableActivityChoices()) {
      return null;
    }

    const entries = await ActivityChoiceVisibility.#getActivityEntries(item);
    if (!entries.some(({ result }) => !result.available)) {
      return null;
    }

    return new Set(
      entries
        .filter(({ result }) => result.available)
        .map(({ activity }) => activity.id)
    );
  }

  static async #handleItemUse(wrapped, config = {}, dialog = {}, message = {}) {
    if (!ModuleSettings.hideUnavailableActivityChoices()) {
      return wrapped.call(this, config, dialog, message);
    }

    // Midi-QOL re-implements Item5e#use (doItemUse) with its own activity choice
    // dialog, usability filters and skip-keybind fast paths. Re-implementing the
    // flow here as well would fight over the dialog, so defer to Midi's flow;
    // filtering happens through the midi-qol.itemUseActivitySelect hook instead
    // (see MidiQolActivityChoice).
    if (globalThis.MidiQOL ?? game.modules.get("midi-qol")?.active) {
      return wrapped.call(this, config, dialog, message);
    }

    if (this.pack) {
      return;
    }

    const entries = await ActivityChoiceVisibility.#getActivityEntries(this);
    const rawActivities = entries.map(({ activity }) => activity);
    const visibleActivities = entries
      .filter(({ result }) => result.available)
      .map(({ activity }) => activity);

    if (visibleActivities.length) {
      const { chooseActivity, ...activityConfig } = config;
      let activity = visibleActivities[0];

      if (((visibleActivities.length > 1) || chooseActivity) && !config?.event?.shiftKey) {
        const dialogClass = dnd5e?.applications?.activity?.ActivityChoiceDialog;
        activity = await dialogClass?.create?.(this, {
          sheet: dialog?.options?.sheet,
          [VISIBLE_ACTIVITY_IDS_OPTION]: visibleActivities.map((entry) => entry.id)
        });
      }

      if (!activity) {
        return;
      }

      return activity.use(activityConfig, dialog, message);
    }

    if (rawActivities.length) {
      const unavailableEntry = entries.find(({ result }) => !result.available) ?? null;
      ActivityChoiceVisibility.#warnUnavailableActivity(unavailableEntry?.activity ?? rawActivities[0], unavailableEntry?.result?.error ?? null);
      return;
    }

    if (this.actor) {
      return this.displayCard(message);
    }
  }

  static #getVisibleActivitiesFromOptions(item, options) {
    const ids = options?.[VISIBLE_ACTIVITY_IDS_OPTION];
    if (!Array.isArray(ids)) {
      return null;
    }

    const activities = ids
      .map((id) => item?.system?.activities?.get?.(id) ?? null)
      .filter((activity) => activity);
    // If none of the ids resolve on this item (e.g. cloned/enchanted copies with
    // regenerated activity ids), treat the hint as absent so callers fall back to
    // evaluating conditions instead of silently showing nothing.
    return activities.length ? activities : null;
  }

  static #warnUnavailableActivity(activity, error) {
    if (!activity && !error) {
      return;
    }

    const warningMessage = error
      ? ActivityConditionService.getConditionErrorWarningMessage()
      : ActivityConditionService.shouldShowConditionFailedWarningMessage(activity)
        ? ActivityConditionService.getConditionFailedWarningMessage(activity)
        : null;
    if (warningMessage) {
      ui.notifications?.warn?.(warningMessage);
    }
  }
}
