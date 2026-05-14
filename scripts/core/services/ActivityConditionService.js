import { Constants } from "../Constants.js";

const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;

export class ActivityConditionService {
  static #compiledConditionCache = new Map();
  static #CONDITION_CACHE_LIMIT = 100;

  static getCondition(activity) {
    return String(
      activity?.getFlag?.(Constants.MODULE_ID, Constants.FLAG_CONDITION)
      ?? foundry.utils.getProperty(activity ?? {}, Constants.CONDITION_FLAG_PATH)
      ?? ""
    );
  }

  static getWarningMessage(activity) {
    return String(
      activity?.getFlag?.(Constants.MODULE_ID, Constants.FLAG_WARNING_MESSAGE)
      ?? foundry.utils.getProperty(activity ?? {}, Constants.WARNING_MESSAGE_FLAG_PATH)
      ?? ""
    );
  }

  static getBadgeLabel(activity) {
    return String(
      activity?.getFlag?.(Constants.MODULE_ID, Constants.FLAG_BADGE_LABEL)
      ?? foundry.utils.getProperty(activity ?? {}, Constants.BADGE_LABEL_FLAG_PATH)
      ?? ""
    );
  }

  static hasCondition(activity) {
    return ActivityConditionService.getCondition(activity).trim().length > 0;
  }

  static getConditionFailedBadgeLabel(activity) {
    return ActivityConditionService.resolveConditionFailedBadgeLabel(
      ActivityConditionService.getBadgeLabel(activity)
    );
  }

  static resolveConditionFailedBadgeLabel(badgeLabel) {
    return ActivityConditionService.#normalizeBadgeLabel(badgeLabel)
      ?? Constants.localize("SCConditionalActivities.Badge.NotAvailable", "Not available");
  }

  static getConditionFailedWarningMessage(activity) {
    return ActivityConditionService.resolveConditionFailedWarningMessage(
      ActivityConditionService.getWarningMessage(activity)
    );
  }

  static resolveConditionFailedWarningMessage(warningMessage) {
    return ActivityConditionService.#normalizeWarningMessage(warningMessage)
      ?? Constants.localize(
        "SCConditionalActivities.Notifications.ConditionFailed",
        "Not available. Conditions not matched."
      );
  }

  static getConditionErrorBadgeLabel() {
    return Constants.localize("SCConditionalActivities.Badge.ConditionError", "Condition error");
  }

  static getConditionErrorWarningMessage() {
    return Constants.localize(
      "SCConditionalActivities.Notifications.ConditionError",
      "This activity's condition could not be evaluated."
    );
  }

  static sanitizeFlagSubmitData(submitData) {
    const condition = foundry.utils.getProperty(submitData, Constants.CONDITION_FLAG_PATH);
    if (typeof condition === "string" && !condition.trim().length) {
      foundry.utils.setProperty(submitData, Constants.CONDITION_FLAG_PATH, null);
    }

    foundry.utils.setProperty(
      submitData,
      Constants.WARNING_MESSAGE_FLAG_PATH,
      ActivityConditionService.#normalizeWarningMessageForStorage(
        foundry.utils.getProperty(submitData, Constants.WARNING_MESSAGE_FLAG_PATH)
      )
    );
    foundry.utils.setProperty(
      submitData,
      Constants.BADGE_LABEL_FLAG_PATH,
      ActivityConditionService.#normalizeBadgeLabel(
        foundry.utils.getProperty(submitData, Constants.BADGE_LABEL_FLAG_PATH)
      )
    );
  }

  static validateCondition(code) {
    const source = String(code ?? "");
    if (!source.trim().length) {
      return { valid: true, error: null };
    }

    try {
      ActivityConditionService.#compileCondition(source);
      return { valid: true, error: null };
    } catch (error) {
      return { valid: false, error };
    }
  }

  static async evaluate(activity, { usage = null, dialog = null, message = null, source = null } = {}) {
    const rawCode = ActivityConditionService.getCondition(activity);
    if (!rawCode.trim().length) {
      return { available: true, error: null };
    }

    try {
      const runner = ActivityConditionService.#compileCondition(rawCode);
      const result = await runner(ActivityConditionService.#buildContext(activity, {
        usage,
        dialog,
        message,
        source
      }));
      return { available: Boolean(result), error: null };
    } catch (error) {
      console.warn(`[${Constants.MODULE_ID}] activity condition evaluation failed`, error);
      return { available: false, error };
    }
  }

  static #compileCondition(code) {
    const source = String(code ?? "");
    const cached = ActivityConditionService.#compiledConditionCache.get(source);
    if (cached) {
      return cached;
    }

    const trimmed = source.trim();
    const body = /\breturn\b/.test(trimmed)
      ? trimmed
      : `return (${trimmed});`;

    const compiled = new AsyncFunction(
      "context",
      `"use strict";
const {
  actor,
  activity,
  activityType,
  deepClone,
  dialog,
  game,
  getProperty,
  hasProperty,
  item,
  message,
  moduleId,
  rollData,
  source,
  usage,
  user
} = context;
${body}`
    );

    if (ActivityConditionService.#compiledConditionCache.size >= ActivityConditionService.#CONDITION_CACHE_LIMIT) {
      ActivityConditionService.#compiledConditionCache.delete(
        ActivityConditionService.#compiledConditionCache.keys().next().value
      );
    }

    ActivityConditionService.#compiledConditionCache.set(source, compiled);
    return compiled;
  }

  static #buildContext(activity, { usage, dialog, message, source }) {
    const item = activity?.item ?? null;
    return {
      actor: item?.actor ?? null,
      activity: activity ?? null,
      activityType: activity?.type ?? null,
      deepClone: foundry.utils.deepClone.bind(foundry.utils),
      dialog: foundry.utils.deepClone(dialog ?? null),
      game,
      getProperty: foundry.utils.getProperty.bind(foundry.utils),
      hasProperty: foundry.utils.hasProperty.bind(foundry.utils),
      item,
      message: foundry.utils.deepClone(message ?? null),
      moduleId: Constants.MODULE_ID,
      rollData: item?.getRollData?.() ?? null,
      source: foundry.utils.deepClone(source ?? null),
      usage: foundry.utils.deepClone(usage ?? null),
      user: game.user ?? null
    };
  }

  static #normalizeWarningMessage(value) {
    const normalized = ActivityConditionService.#normalizeWarningMessageForStorage(value);
    return normalized ?? null;
  }

  static #normalizeWarningMessageForStorage(value) {
    const source = String(value ?? "").replace(/\r\n/g, "\n").trim();
    return source.length ? source : null;
  }

  static #normalizeBadgeLabel(value) {
    const source = String(value ?? "")
      .replace(/\r\n/g, " ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!source.length) {
      return null;
    }
    return source.slice(0, Constants.BADGE_LABEL_MAX_LENGTH);
  }
}
