import { Constants } from "../Constants.js";
import { ActivityConditionService } from "../services/ActivityConditionService.js";
import { ModuleSettings } from "../settings/ModuleSettings.js";

const ACTIVITY_SELECT_HOOK = "midi-qol.itemUseActivitySelect";

/**
 * Midi-QOL replaces the dnd5e activity choice flow with its own
 * MidiActivityChoiceDialog, whose _prepareContext overwrites the activities
 * array after our ActivityChoiceVisibility filter has run. Midi awaits the
 * midi-qol.itemUseActivitySelect hook and lets listeners mutate the activities
 * array, so pruning here is the supported way to hide unavailable activities.
 */
export class MidiQolActivityChoice {
  static #registered = false;

  static activate() {
    if (MidiQolActivityChoice.#registered || !Constants.isDnd5eActive()) {
      return;
    }

    MidiQolActivityChoice.#registered = true;
    Hooks.on(ACTIVITY_SELECT_HOOK, async (payload) => {
      try {
        await MidiQolActivityChoice.#pruneUnavailableActivities(payload);
      } catch (error) {
        console.warn(`[${Constants.MODULE_ID}] failed to filter Midi-QOL activity selection`, error);
      }
    });
  }

  static async #pruneUnavailableActivities({ activities, item } = {}) {
    if (!Array.isArray(activities) || !activities.length) {
      return;
    }

    if (!ModuleSettings.hideUnavailableActivityChoices()) {
      return;
    }

    const evaluations = await Promise.all(activities.map(async (entry) => {
      const activity = MidiQolActivityChoice.#resolveActivity(item, entry);
      if (!activity || !ActivityConditionService.hasCondition(activity)) {
        return { entry, activity, available: true, error: null };
      }

      const result = await ActivityConditionService.evaluate(activity, { source: "activity-choice" });
      return { entry, activity, available: result.available, error: result.error };
    }));

    const unavailable = evaluations.filter(({ available }) => !available);
    if (!unavailable.length) {
      return;
    }

    for (const { entry } of unavailable) {
      const index = activities.indexOf(entry);
      if (index >= 0) {
        activities.splice(index, 1);
      }
    }

    if (!activities.length) {
      MidiQolActivityChoice.#warnUnavailableActivity(unavailable[0]);
    }
  }

  static #resolveActivity(item, entry) {
    if (entry?.item && typeof entry.use === "function") {
      return entry;
    }

    const id = entry?.id ?? entry?._id;
    return id ? item?.system?.activities?.get?.(id) ?? null : null;
  }

  static #warnUnavailableActivity({ activity, error }) {
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
