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
const TIDY_INLINE_GRID_TEMPLATE = "/* Name */ 1fr /* Status */ 9rem /* Uses */ 2.5rem /* Usage */ 5rem";

export class ActivityConditionBadges {
  static #handlers = new Map();
  static #openSurfaces = new Map();
  static #evaluationRevision = 0;
  static #elementRequests = new WeakMap();
  static #nextElementRequestId = 0;

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
    const closeHandler = (app) => {
      ActivityConditionBadges.#openSurfaces.delete(app);
    };
    ActivityConditionBadges.#bind("closeApplication", closeHandler);
    ActivityConditionBadges.#bind("closeApplicationV2", closeHandler);
  }

  static deactivate() {
    for (const [hook, handler] of ActivityConditionBadges.#handlers) {
      Hooks.off(hook, handler);
    }
    ActivityConditionBadges.#handlers.clear();
    ActivityConditionBadges.#openSurfaces.clear();
    ActivityConditionBadges.invalidateEvaluations();
    ActivityConditionBadges.#elementRequests = new WeakMap();
    ActivityConditionBadges.#nextElementRequestId = 0;
  }

  static invalidateEvaluations() {
    ActivityConditionBadges.#evaluationRevision += 1;
    return ActivityConditionBadges.#evaluationRevision;
  }

  static async refreshOpenSurfaces(revision = ActivityConditionBadges.#evaluationRevision) {
    if (revision !== ActivityConditionBadges.#evaluationRevision) {
      return;
    }

    ActivityConditionBadges.#pruneOpenSurfaces();
    const evaluationCache = new Map();
    const refreshes = Array.from(ActivityConditionBadges.#openSurfaces.values(), (surface) =>
      ActivityConditionBadges.#decorateSurface(surface, { revision, evaluationCache })
    );
    await Promise.allSettled(refreshes);
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

    ActivityConditionBadges.#registerOpenSurface(app, root, "item");
    await ActivityConditionBadges.#decorateSurface(
      { app, root, kind: "item" },
      { revision: ActivityConditionBadges.#evaluationRevision }
    );
  }

  static async #decorateActorSheet(app, html) {
    const root = ActivityConditionBadges.#resolveRoot(html ?? app?.element);
    const actor = app?.actor ?? app?.document ?? null;
    if (!root || !actor) {
      return;
    }

    ActivityConditionBadges.#registerOpenSurface(app, root, "actor");
    await ActivityConditionBadges.#decorateSurface(
      { app, root, kind: "actor" },
      { revision: ActivityConditionBadges.#evaluationRevision }
    );
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

  static async #decorateSurface(surface, { revision, evaluationCache = new Map() }) {
    const { app, root, kind } = surface;
    if (!root?.isConnected || revision !== ActivityConditionBadges.#evaluationRevision) {
      return;
    }

    const document = kind === "actor"
      ? app?.actor ?? app?.document ?? null
      : app?.item ?? app?.document ?? null;
    if (!document) {
      return;
    }

    const resolveActivity = kind === "actor"
      ? (row) => ActivityConditionBadges.#resolveActivityFromActorRow(document, row)
      : (row) => document.system?.activities?.get?.(row.dataset.activityId) ?? null;
    ActivityConditionBadges.#prepareTidyActivityTables(root, resolveActivity);

    const rows = root.querySelectorAll("[data-activity-id]");
    await Promise.allSettled(Array.from(rows, async (row) => {
      const activity = resolveActivity(row);
      await ActivityConditionBadges.#decorateElement(
        row,
        activity,
        { sheetKind: kind },
        { revision, evaluationCache }
      );
    }));
  }

  static async #decorateElement(
    element,
    activity,
    { labelTarget = null, sheetKind = null, activityChoiceBadgeRow = false } = {},
    {
      revision = ActivityConditionBadges.#evaluationRevision,
      evaluationCache = new Map()
    } = {}
  ) {
    const requestId = ++ActivityConditionBadges.#nextElementRequestId;
    ActivityConditionBadges.#elementRequests.set(element, requestId);

    if (!activity || !ActivityConditionService.hasCondition(activity)) {
      if (ActivityConditionBadges.#canApplyResult(element, revision, requestId)) {
        ActivityConditionBadges.#clearElement(element);
      }
      return;
    }

    const evaluationKey = activity.uuid ?? activity;
    let evaluation = evaluationCache.get(evaluationKey);
    if (!evaluation) {
      evaluation = ActivityConditionService.evaluate(activity, { source: "ui" });
      evaluationCache.set(evaluationKey, evaluation);
    }
    const result = await evaluation;
    if (!ActivityConditionBadges.#canApplyResult(element, revision, requestId)) {
      return;
    }

    if (result.available) {
      ActivityConditionBadges.#clearElement(element);
      return;
    }

    const label = result.error
      ? ActivityConditionService.getConditionErrorBadgeLabel()
      : ActivityConditionService.getConditionFailedBadgeLabel(activity);
    const tooltip = result.error
      ? ActivityConditionService.getConditionErrorWarningMessage()
      : ActivityConditionService.getConditionFailedWarningMessage(activity);

    const tidyItemCardTarget = ActivityConditionBadges.#getTidyItemCardLabelTarget(element);
    const tidyInlineVisualRow = ActivityConditionBadges.#getTidyInlineVisualRow(element, sheetKind);
    const tidyItemInlineTarget = ActivityConditionBadges.#getTidyItemInlineBadgeTarget(element, sheetKind, tidyInlineVisualRow);
    const tidyPrimaryCell = sheetKind === "actor" ? ActivityConditionBadges.#getTidyPrimaryCell(element) : null;
    const activityChoiceTarget = activityChoiceBadgeRow
      ? ActivityConditionBadges.#getActivityChoiceBadgeTarget(element)
      : null;

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

    const ownedBadges = ActivityConditionBadges.#getOwnedBadges(element);
    const currentBadge = ownedBadges.shift() ?? document.createElement("span");
    for (const duplicate of ownedBadges) {
      duplicate.remove();
    }

    ActivityConditionBadges.#toggleClass(element, LOCKED_CLASS, true);
    ActivityConditionBadges.#toggleClass(element, TIDY_ITEM_CARD_LOCKED_CLASS, Boolean(tidyItemCardTarget));
    ActivityConditionBadges.#toggleClass(element, TIDY_ITEM_INLINE_LOCKED_CLASS, !tidyInlineVisualRow && Boolean(tidyItemInlineTarget));
    ActivityConditionBadges.#toggleClass(element, TIDY_LOCKED_ROW_CLASS, !tidyInlineVisualRow && !tidyItemInlineTarget && Boolean(tidyPrimaryCell));
    if (tidyInlineVisualRow) {
      ActivityConditionBadges.#toggleClass(tidyInlineVisualRow, TIDY_ITEM_INLINE_LOCKED_CLASS, Boolean(tidyItemInlineTarget));
      ActivityConditionBadges.#toggleClass(tidyInlineVisualRow, TIDY_LOCKED_ROW_CLASS, !tidyItemInlineTarget && Boolean(tidyPrimaryCell));
    }
    ActivityConditionBadges.#setAttribute(element, "data-sc-ca-locked", "true");
    ActivityConditionBadges.#setAttribute(element, "data-tooltip", tooltip);

    if (!currentBadge.classList.contains(BADGE_CLASS)) {
      currentBadge.className = BADGE_CLASS;
    }
    if (currentBadge.textContent !== label) {
      currentBadge.textContent = label;
    }
    if (currentBadge.title !== tooltip) {
      currentBadge.title = tooltip;
    }
    if (currentBadge.parentElement !== target) {
      target.appendChild(currentBadge);
    }
  }

  static #clearElement(element) {
    const tidyInlineVisualRow = ActivityConditionBadges.#getTidyInlineVisualRow(element);
    ActivityConditionBadges.#toggleClass(element, LOCKED_CLASS, false);
    ActivityConditionBadges.#toggleClass(element, TIDY_ITEM_CARD_LOCKED_CLASS, false);
    ActivityConditionBadges.#toggleClass(element, TIDY_ITEM_INLINE_LOCKED_CLASS, false);
    ActivityConditionBadges.#toggleClass(element, TIDY_LOCKED_ROW_CLASS, false);
    if (tidyInlineVisualRow) {
      ActivityConditionBadges.#toggleClass(tidyInlineVisualRow, TIDY_ITEM_INLINE_LOCKED_CLASS, false);
      ActivityConditionBadges.#toggleClass(tidyInlineVisualRow, TIDY_LOCKED_ROW_CLASS, false);
    }
    ActivityConditionBadges.#removeAttribute(element, "data-sc-ca-locked");
    ActivityConditionBadges.#removeAttribute(element, "data-tooltip");
    for (const badge of ActivityConditionBadges.#getOwnedBadges(element)) {
      badge.remove();
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

    if (table.style.getPropertyValue("--grid-template-columns") !== TIDY_INLINE_GRID_TEMPLATE) {
      table.style.setProperty("--grid-template-columns", TIDY_INLINE_GRID_TEMPLATE);
    }
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

  static #registerOpenSurface(app, root, kind) {
    if (!app || !root) {
      return;
    }
    ActivityConditionBadges.#openSurfaces.set(app, { app, root, kind });
  }

  static #pruneOpenSurfaces() {
    for (const [app, surface] of ActivityConditionBadges.#openSurfaces) {
      if (!surface.root?.isConnected) {
        ActivityConditionBadges.#openSurfaces.delete(app);
      }
    }
  }

  static #canApplyResult(element, revision, requestId) {
    return Boolean(element?.isConnected)
      && revision === ActivityConditionBadges.#evaluationRevision
      && ActivityConditionBadges.#elementRequests.get(element) === requestId;
  }

  static #getOwnedBadges(element) {
    return Array.from(element.querySelectorAll(`.${BADGE_CLASS}`)).filter((badge) =>
      badge.closest("[data-activity-id]") === element
      || badge.closest("[data-action='choose'][data-activity-id]") === element
    );
  }

  static #toggleClass(element, className, enabled) {
    if (element.classList.contains(className) !== enabled) {
      element.classList.toggle(className, enabled);
    }
  }

  static #setAttribute(element, name, value) {
    if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }

  static #removeAttribute(element, name) {
    if (element.hasAttribute(name)) {
      element.removeAttribute(name);
    }
  }
}
