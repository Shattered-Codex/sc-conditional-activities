import { Constants } from "../Constants.js";
import { ActivityConditionService } from "../services/ActivityConditionService.js";

const BADGE_CLASS = "sc-ca-locked-label";
const LOCKED_CLASS = "sc-ca-locked";

export class ActivityConditionBadges {
  static #handlers = new Map();

  static activate() {
    if (ActivityConditionBadges.#handlers.size) {
      return;
    }

    ActivityConditionBadges.#bind("renderActivityChoiceDialog", (app, html) => {
      void ActivityConditionBadges.#decorateActivityChoiceDialog(app, html);
    });
    ActivityConditionBadges.#bind("renderItemSheet5e", (app, html) => {
      void ActivityConditionBadges.#decorateItemSheet(app, html);
    });
    const actorHandler = (app, html) => {
      void ActivityConditionBadges.#decorateActorSheet(app, html);
    };
    ActivityConditionBadges.#bind("renderActorSheet5e", actorHandler);
    ActivityConditionBadges.#bind("renderActorSheet", actorHandler);
    ActivityConditionBadges.#bind("renderActorSheetV2", actorHandler);
    ActivityConditionBadges.#bind("tidy5e-sheet.renderActorSheet", actorHandler);
    ActivityConditionBadges.#bind("renderChatMessageHTML", (_message, html) => {
      void ActivityConditionBadges.#decorateChatMessage(html);
    });
  }

  static #bind(hook, handler) {
    Hooks.on(hook, handler);
    ActivityConditionBadges.#handlers.set(hook, handler);
  }

  static async #decorateActivityChoiceDialog(app, html) {
    const root = ActivityConditionBadges.#resolveRoot(html ?? app?.element);
    const item = app?.item ?? null;
    if (!root || !item) {
      return;
    }

    const buttons = root.querySelectorAll("[data-action='choose'][data-activity-id]");
    await Promise.all(Array.from(buttons).map(async (button) => {
      const activity = item.system?.activities?.get?.(button.dataset.activityId);
      await ActivityConditionBadges.#decorateElement(button, activity, {
        labelTarget: button.querySelector(".name") ?? button
      });
    }));
  }

  static async #decorateItemSheet(app, html) {
    const root = ActivityConditionBadges.#resolveRoot(html ?? app?.element);
    const item = app?.item ?? app?.document ?? null;
    if (!root || !item) {
      return;
    }

    const rows = root.querySelectorAll("[data-activity-id]");
    await Promise.all(Array.from(rows).map(async (row) => {
      const activity = item.system?.activities?.get?.(row.dataset.activityId);
      await ActivityConditionBadges.#decorateElement(row, activity);
    }));
  }

  static async #decorateActorSheet(app, html) {
    const root = ActivityConditionBadges.#resolveRoot(html ?? app?.element);
    const actor = app?.actor ?? app?.document ?? null;
    if (!root || !actor) {
      return;
    }

    const rows = root.querySelectorAll("[data-activity-id]");
    await Promise.all(Array.from(rows).map(async (row) => {
      const activity = ActivityConditionBadges.#resolveActivityFromActorRow(actor, row);
      await ActivityConditionBadges.#decorateElement(row, activity);
    }));
  }

  static async #decorateChatMessage(html) {
    const root = ActivityConditionBadges.#resolveRoot(html);
    if (!root) {
      return;
    }

    const rows = root.querySelectorAll("[data-activity-uuid], [data-activity-id]");
    await Promise.all(Array.from(rows).map(async (row) => {
      const activity = await ActivityConditionBadges.#resolveActivityFromElement(row);
      await ActivityConditionBadges.#decorateElement(row, activity);
    }));
  }

  static async #decorateElement(element, activity, { labelTarget = null } = {}) {
    ActivityConditionBadges.#clearElement(element);
    if (!activity || !ActivityConditionService.hasCondition(activity)) {
      return;
    }

    const result = await ActivityConditionService.evaluate(activity, { source: "ui" });
    if (result.available) {
      return;
    }

    const label = result.error
      ? Constants.localize("SCConditionalActivities.Badge.ConditionError", "Condition error")
      : Constants.localize("SCConditionalActivities.Badge.NotAvailable", "Not available");
    const tooltip = result.error
      ? Constants.localize("SCConditionalActivities.Notifications.ConditionError", "This activity's condition could not be evaluated.")
      : Constants.localize("SCConditionalActivities.Notifications.ConditionFailed", "Not available. Conditions not matched.");

    element.classList.add(LOCKED_CLASS);
    element.setAttribute("data-sc-ca-locked", "true");
    element.setAttribute("data-tooltip", tooltip);

    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.textContent = label;
    badge.title = tooltip;

    const target = labelTarget
      ?? element.querySelector(".name-stacked")
      ?? element.querySelector(".name")
      ?? element.querySelector(".activity-name")
      ?? element;
    target.appendChild(badge);
  }

  static #clearElement(element) {
    element.classList.remove(LOCKED_CLASS);
    element.removeAttribute("data-sc-ca-locked");
    for (const badge of element.querySelectorAll(`.${BADGE_CLASS}`)) {
      if (badge.closest("[data-activity-id]") === element || badge.closest("[data-action='choose'][data-activity-id]") === element) {
        badge.remove();
      }
    }
  }

  static #resolveActivityFromActorRow(actor, row) {
    const activityId = row.dataset.activityId;
    if (!activityId) {
      return null;
    }

    const itemElement = row.closest("[data-item-id], [data-item-uuid], [data-uuid]");
    const itemId = itemElement?.dataset?.itemId;
    if (itemId) {
      return actor.items?.get?.(itemId)?.system?.activities?.get?.(activityId) ?? null;
    }

    const uuid = itemElement?.dataset?.itemUuid ?? itemElement?.dataset?.uuid;
    const document = uuid ? fromUuidSync(uuid, { strict: false }) : null;
    return ActivityConditionBadges.#coerceActivity(document, activityId);
  }

  static async #resolveActivityFromElement(element) {
    const activityUuid = element.dataset.activityUuid
      ?? element.closest("[data-activity-uuid]")?.dataset?.activityUuid
      ?? element.dataset.uuid;
    if (activityUuid) {
      return ActivityConditionBadges.#coerceActivity(await fromUuid(activityUuid), element.dataset.activityId);
    }

    const activityId = element.dataset.activityId;
    const itemUuid = element.closest("[data-item-uuid], [data-uuid]")?.dataset?.itemUuid
      ?? element.closest("[data-item-uuid], [data-uuid]")?.dataset?.uuid;
    const document = itemUuid ? await fromUuid(itemUuid) : null;
    return ActivityConditionBadges.#coerceActivity(document, activityId);
  }

  static #coerceActivity(document, activityId) {
    if (!document) {
      return null;
    }

    if (document.item && typeof document.use === "function") {
      return document;
    }

    return document.system?.activities?.get?.(activityId) ?? null;
  }

  static #resolveRoot(html) {
    if (!html) {
      return null;
    }
    if (html.jquery || typeof html.get === "function") {
      return html[0] ?? html.get(0) ?? null;
    }
    if (html instanceof Element || html?.querySelector) {
      return html;
    }
    return null;
  }
}
