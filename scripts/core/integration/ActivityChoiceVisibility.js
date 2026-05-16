import { Constants } from "../Constants.js";
import { ActivityConditionService } from "../services/ActivityConditionService.js";
import { ModuleSettings } from "../settings/ModuleSettings.js";

const PATCHED = Symbol.for(`${Constants.MODULE_ID}.ActivityChoiceVisibility.patched`);
const VISIBLE_ACTIVITY_IDS_OPTION = `${Constants.MODULE_ID}.visibleActivityIds`;

export class ActivityChoiceVisibility {
  static activate() {
    if (!Constants.isDnd5eActive()) {
      return;
    }

    const dialogClass = dnd5e?.applications?.activity?.ActivityChoiceDialog;
    if (typeof dialogClass === "function") {
      ActivityChoiceVisibility.#patchDialogClass(dialogClass);
    }

    const itemClass = CONFIG?.Item?.documentClass;
    if (typeof itemClass === "function") {
      ActivityChoiceVisibility.#patchItemClass(itemClass);
    }
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
    if (Object.prototype.hasOwnProperty.call(dialogClass, PATCHED)) {
      return;
    }

    dialogClass[PATCHED] = true;
    ActivityChoiceVisibility.#wrapCreate(dialogClass);
    ActivityChoiceVisibility.#wrapPrepareContext(dialogClass);
  }

  static #wrapCreate(dialogClass) {
    const original = dialogClass.create;
    if (typeof original !== "function") {
      return;
    }

    dialogClass.create = async function(item, options = {}) {
      if (!ModuleSettings.hideUnavailableActivityChoices()) {
        return original.call(this, item, options);
      }

      const visibleActivities = ActivityChoiceVisibility.#getVisibleActivitiesFromOptions(item, options);
      if (visibleActivities) {
        if (!visibleActivities.length) {
          return null;
        }

        if (visibleActivities.length === 1) {
          return visibleActivities[0];
        }

        return original.call(this, item, options);
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

      return original.call(this, item, {
        ...options,
        [VISIBLE_ACTIVITY_IDS_OPTION]: activities.map((activity) => activity.id)
      });
    };
  }

  static #wrapPrepareContext(dialogClass) {
    const original = dialogClass.prototype._prepareContext;
    if (typeof original !== "function") {
      return;
    }

    dialogClass.prototype._prepareContext = async function(options) {
      const context = await original.call(this, options);
      const visibleActivities = ActivityChoiceVisibility.#getVisibleActivitiesFromOptions(this.item, this.options);
      if (!visibleActivities || !Array.isArray(context?.activities)) {
        return context;
      }

      const visibleIds = new Set(visibleActivities.map((activity) => activity.id));
      return {
        ...context,
        activities: context.activities.filter((activity) => visibleIds.has(activity.id))
      };
    };
  }

  static #patchItemClass(itemClass) {
    const prototype = itemClass?.prototype;
    if (!prototype || Object.prototype.hasOwnProperty.call(prototype, PATCHED) || typeof prototype.use !== "function") {
      return;
    }

    prototype[PATCHED] = true;
    const original = prototype.use;
    prototype.use = async function(config = {}, dialog = {}, message = {}) {
      if (!ModuleSettings.hideUnavailableActivityChoices()) {
        return original.call(this, config, dialog, message);
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
    };
  }

  static #getVisibleActivitiesFromOptions(item, options) {
    const ids = options?.[VISIBLE_ACTIVITY_IDS_OPTION];
    if (!Array.isArray(ids)) {
      return null;
    }

    return ids
      .map((id) => item?.system?.activities?.get?.(id) ?? null)
      .filter((activity) => activity);
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
