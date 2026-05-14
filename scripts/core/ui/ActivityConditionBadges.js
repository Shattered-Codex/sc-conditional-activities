import { Constants } from "../Constants.js";
import { ActivityConditionService } from "../services/ActivityConditionService.js";

const BADGE_CLASS = "sc-ca-locked-label";
const TIDY_BADGE_CELL_CLASS = "sc-ca-badge-cell";
const TIDY_BADGE_HEADER_CLASS = "sc-ca-badge-header";
const TIDY_ITEM_CARD_LOCKED_CLASS = "sc-ca-tidy-item-card-locked";
const TIDY_ITEM_INLINE_LOCKED_CLASS = "sc-ca-tidy-item-inline-locked";
const TIDY_LOCKED_ROW_CLASS = "sc-ca-tidy-locked-row";
const ACTIVITY_CHOICE_BADGE_ROW_CLASS = "sc-ca-choice-badge-row";
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
    ActivityConditionBadges.#bind("renderItemSheet", (app, html) => {
      void ActivityConditionBadges.#decorateItemSheet(app, html);
    });
    ActivityConditionBadges.#bind("renderItemSheetV2", (app, html) => {
      void ActivityConditionBadges.#decorateItemSheet(app, html);
    });
    const actorHandler = (app, html) => {
      void ActivityConditionBadges.#decorateActorSheet(app, html);
    };
    ActivityConditionBadges.#bind("renderActorSheet5e", actorHandler);
    ActivityConditionBadges.#bind("renderActorSheet", actorHandler);
    ActivityConditionBadges.#bind("renderActorSheetV2", actorHandler);
    ActivityConditionBadges.#bind("tidy5e-sheet.renderActorSheet", actorHandler);
    ActivityConditionBadges.#bind("tidy5e-sheet.selectTab", (app, html, newTabId) => {
      void ActivityConditionBadges.#decorateTidySheetTab(app, html, newTabId);
    });
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
        activityChoiceBadgeRow: true
      });
    }));
  }

  static async #decorateItemSheet(app, html) {
    const root = ActivityConditionBadges.#resolveRoot(html ?? app?.element);
    const item = app?.item ?? app?.document ?? null;
    if (!root || !item) {
      return;
    }

    ActivityConditionBadges.#prepareTidyActivityTables(root, (row) => item.system?.activities?.get?.(row.dataset.activityId) ?? null);
    const rows = root.querySelectorAll("[data-activity-id]");
    await Promise.all(Array.from(rows).map(async (row) => {
      const activity = item.system?.activities?.get?.(row.dataset.activityId);
      await ActivityConditionBadges.#decorateElement(row, activity, { sheetKind: "item" });
    }));
  }

  static async #decorateActorSheet(app, html) {
    const root = ActivityConditionBadges.#resolveRoot(html ?? app?.element);
    const actor = app?.actor ?? app?.document ?? null;
    if (!root || !actor) {
      return;
    }

    ActivityConditionBadges.#prepareTidyActivityTables(root, (row) => ActivityConditionBadges.#resolveActivityFromActorRow(actor, row));
    const rows = root.querySelectorAll("[data-activity-id]");
    await Promise.all(Array.from(rows).map(async (row) => {
      const activity = ActivityConditionBadges.#resolveActivityFromActorRow(actor, row);
      await ActivityConditionBadges.#decorateElement(row, activity, { sheetKind: "actor" });
    }));
  }

  static async #decorateTidySheetTab(app, html, newTabId) {
    if (newTabId !== "activities") {
      return;
    }

    const root = ActivityConditionBadges.#resolveRoot(html ?? app?.element);
    const document = app?.document ?? null;
    if (!root || !document) {
      return;
    }

    if (document.documentName === "Item" || app?.item) {
      await ActivityConditionBadges.#decorateItemSheet(app, root);
      return;
    }

    if (document.documentName === "Actor" || app?.actor) {
      await ActivityConditionBadges.#decorateActorSheet(app, root);
    }
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

  static async #decorateElement(element, activity, { labelTarget = null, sheetKind = null, activityChoiceBadgeRow = false } = {}) {
    ActivityConditionBadges.#clearElement(element);
    if (!activity || !ActivityConditionService.hasCondition(activity)) {
      return;
    }

    const result = await ActivityConditionService.evaluate(activity, { source: "ui" });
    if (result.available) {
      return;
    }

    const label = result.error
      ? ActivityConditionService.getConditionErrorBadgeLabel()
      : ActivityConditionService.getConditionFailedBadgeLabel(activity);
    const tooltip = result.error
      ? ActivityConditionService.getConditionErrorWarningMessage()
      : ActivityConditionService.getConditionFailedWarningMessage(activity);

    element.classList.add(LOCKED_CLASS);
    element.setAttribute("data-sc-ca-locked", "true");
    element.setAttribute("data-tooltip", tooltip);

    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.textContent = label;
    badge.title = tooltip;

    const tidyItemCardTarget = ActivityConditionBadges.#getTidyItemCardLabelTarget(element);
    if (tidyItemCardTarget) {
      element.classList.add(TIDY_ITEM_CARD_LOCKED_CLASS);
    }

    const tidyInlineVisualRow = ActivityConditionBadges.#getTidyInlineVisualRow(element, sheetKind);
    const tidyItemInlineTarget = ActivityConditionBadges.#getTidyItemInlineBadgeTarget(element, sheetKind, tidyInlineVisualRow);
    const tidyPrimaryCell = sheetKind === "actor" ? ActivityConditionBadges.#getTidyPrimaryCell(element) : null;
    const activityChoiceTarget = activityChoiceBadgeRow
      ? ActivityConditionBadges.#getActivityChoiceBadgeTarget(element)
      : null;
    if (tidyItemInlineTarget) {
      (tidyInlineVisualRow ?? element).classList.add(TIDY_ITEM_INLINE_LOCKED_CLASS);
    } else if (tidyPrimaryCell) {
      (tidyInlineVisualRow ?? element).classList.add(TIDY_LOCKED_ROW_CLASS);
    }

    const target = labelTarget
      ?? activityChoiceTarget
      ?? tidyItemCardTarget
      ?? tidyItemInlineTarget
      ?? tidyPrimaryCell
      ?? element.querySelector(`.${TIDY_BADGE_CELL_CLASS}`)
      ?? element.querySelector(".name-stacked")
      ?? element.querySelector(".name")
      ?? element.querySelector(".activity-name")
      ?? element;
    target.appendChild(badge);
  }

  static #clearElement(element) {
    const tidyInlineVisualRow = ActivityConditionBadges.#getTidyInlineVisualRow(element);
    element.classList.remove(LOCKED_CLASS);
    element.classList.remove(TIDY_ITEM_CARD_LOCKED_CLASS);
    element.classList.remove(TIDY_ITEM_INLINE_LOCKED_CLASS);
    element.classList.remove(TIDY_LOCKED_ROW_CLASS);
    tidyInlineVisualRow?.classList.remove(TIDY_ITEM_INLINE_LOCKED_CLASS, TIDY_LOCKED_ROW_CLASS);
    element.removeAttribute("data-sc-ca-locked");
    element.removeAttribute("data-tooltip");
    for (const badge of element.querySelectorAll(`.${BADGE_CLASS}`)) {
      if (badge.closest("[data-activity-id]") === element || badge.closest("[data-action='choose'][data-activity-id]") === element) {
        badge.remove();
      }
    }
    for (const row of element.querySelectorAll(`.${ACTIVITY_CHOICE_BADGE_ROW_CLASS}`)) {
      if (row.closest("[data-action='choose'][data-activity-id]") === element) {
        row.remove();
      }
    }
  }

  static #getActivityChoiceBadgeTarget(button) {
    if (!button?.matches?.("[data-action='choose'][data-activity-id]")) {
      return null;
    }

    let row = button.querySelector(`:scope > .${ACTIVITY_CHOICE_BADGE_ROW_CLASS}`);
    if (row) {
      return row;
    }

    row = document.createElement("span");
    row.className = ACTIVITY_CHOICE_BADGE_ROW_CLASS;

    const name = button.querySelector(":scope > .name");
    if (name) {
      name.after(row);
      return row;
    }

    button.appendChild(row);
    return row;
  }

  static #prepareTidyActivityTables(root, resolveActivity) {
    const tables = root.querySelectorAll(".inline-activities-table");
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll("[data-activity-id]"));
      ActivityConditionBadges.#syncTidyItemActivityTableHeader(table, false);
      for (const row of rows) {
        ActivityConditionBadges.#syncTidyItemActivityRow(row, false);
      }
    }

    const inlineTables = root.querySelectorAll(".inline-activities-container .tidy-table");
    for (const table of inlineTables) {
      const rows = Array.from(table.querySelectorAll("[data-activity-id]"));
      const hasConditionalActivities = rows.some((row) => {
        const activity = resolveActivity(row);
        return ActivityConditionService.hasCondition(activity);
      });

      ActivityConditionBadges.#syncTidyInlineActivityTable(table, hasConditionalActivities);
      for (const row of rows) {
        ActivityConditionBadges.#syncTidyInlineActivityRow(row, hasConditionalActivities);
      }
    }
  }

  static #syncTidyItemActivityTableHeader(table, enabled) {
    const headerRow = table.querySelector(".tidy-table-header-row");
    if (!headerRow) {
      return;
    }

    const existing = headerRow.querySelector(`.${TIDY_BADGE_HEADER_CLASS}`);
    if (!enabled) {
      existing?.remove();
      return;
    }

    if (existing) {
      return;
    }

    const headerCell = document.createElement("div");
    headerCell.className = `tidy-table-header-cell ${TIDY_BADGE_HEADER_CLASS}`;

    const label = document.createElement("div");
    label.className = "cell-name";
    label.textContent = Constants.localize("SCConditionalActivities.Badge.ColumnHeader", "Status");
    headerCell.appendChild(label);

    const usesHeader = Array.from(headerRow.querySelectorAll(".tidy-table-header-cell"))
      .find((cell) => cell.textContent?.trim() === game.i18n.localize("DND5E.Uses"));
    usesHeader?.before(headerCell);
  }

  static #syncTidyItemActivityRow(row, enabled) {
    const existing = row.querySelector(`.${TIDY_BADGE_CELL_CLASS}`);
    if (!enabled) {
      existing?.remove();
      return;
    }

    if (existing) {
      return;
    }

    const usesCell = row.querySelector(".inline-uses");
    if (!usesCell) {
      return;
    }

    const badgeCell = document.createElement("div");
    badgeCell.className = `tidy-table-cell ${TIDY_BADGE_CELL_CLASS}`;
    usesCell.before(badgeCell);
  }

  static #syncTidyInlineActivityTable(table, enabled) {
    const original = table.dataset.scCaOriginalGridTemplateColumns;
    if (!enabled) {
      if (original !== undefined) {
        table.style.setProperty("--grid-template-columns", original);
        delete table.dataset.scCaOriginalGridTemplateColumns;
      }
      return;
    }

    if (original === undefined) {
      table.dataset.scCaOriginalGridTemplateColumns = table.style.getPropertyValue("--grid-template-columns");
    }

    table.style.setProperty(
      "--grid-template-columns",
      "/* Name */ 1fr /* Status */ 9rem /* Uses */ 2.5rem /* Usage */ 5rem"
    );
  }

  static #syncTidyInlineActivityRow(row, enabled) {
    const existing = row.querySelector(`.${TIDY_BADGE_CELL_CLASS}`);
    if (!enabled) {
      existing?.remove();
      return;
    }

    if (existing) {
      return;
    }

    const cells = row.querySelectorAll(":scope > .tidy-table-cell");
    const primaryCell = cells[0];
    if (!primaryCell) {
      return;
    }

    const badgeCell = document.createElement("div");
    badgeCell.className = `tidy-table-cell ${TIDY_BADGE_CELL_CLASS}`;
    primaryCell.after(badgeCell);
  }

  static #getTidyPrimaryCell(element) {
    if (!element.matches?.(".activity[data-activity-id]")) {
      return null;
    }

    if (!element.closest(".inline-activities-table")) {
      return null;
    }

    const row = ActivityConditionBadges.#getTidyInlineVisualRow(element, "actor");
    if (!row) {
      return null;
    }

    return row.querySelector(":scope > .tidy-table-cell.item-label .cell-name")
      ?? row.querySelector(":scope > .tidy-table-cell.item-label");
  }

  static #getTidyItemInlineBadgeTarget(element, sheetKind, row = null) {
    if (sheetKind !== "item") {
      return null;
    }

    if (!element.matches?.(".activity[data-activity-id]")) {
      return null;
    }

    const visualRow = row ?? ActivityConditionBadges.#getTidyInlineVisualRow(element, sheetKind);
    if (!visualRow) {
      return null;
    }

    return visualRow.querySelector(":scope > .tidy-table-cell.inline-uses");
  }

  static #getTidyInlineVisualRow(element, sheetKind = null) {
    if (!element?.matches?.(".activity[data-activity-id]")) {
      return null;
    }

    if (element.matches(".tidy-table-row")) {
      return element;
    }

    if (element.closest(".inline-activities-table")) {
      return element.querySelector(":scope > .tidy-table-row");
    }

    if (ActivityConditionBadges.#isTidyItemActivitiesTableRow(element)) {
      return element.querySelector(":scope > .tidy-table-row");
    }

    return null;
  }

  static #isTidyItemActivitiesTableRow(element) {
    return element.matches?.(".activity[data-activity-id]")
      && Boolean(element.closest(".tidy5e-sheet.item.quadrone"))
      && Boolean(element.closest(".tidy-tab.activities"))
      && Boolean(element.closest("[data-tidy-section-key='activities']"));
  }

  static #getTidyItemCardLabelTarget(element) {
    if (!element.matches?.(".activity.card[data-activity-id]")) {
      return null;
    }

    if (!element.closest(".tidy5e-sheet")) {
      return null;
    }

    if (!element.closest(".scroll-container.activities")) {
      return null;
    }

    return element.querySelector(":scope > button.name");
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
