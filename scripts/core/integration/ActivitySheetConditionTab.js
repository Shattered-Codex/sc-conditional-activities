import { Constants } from "../Constants.js";
import { ActivityConditionService } from "../services/ActivityConditionService.js";

const TEMPLATE_PATH = `modules/${Constants.MODULE_ID}/templates/activity-condition-tab.hbs`;
const PATCHED = Symbol.for(`${Constants.MODULE_ID}.ActivitySheetConditionTab.patched`);

export class ActivitySheetConditionTab {
  static activate() {
    if (!Constants.isDnd5eActive()) {
      return;
    }

    for (const sheetClass of ActivitySheetConditionTab.#getActivitySheetClasses()) {
      ActivitySheetConditionTab.#patchSheetClass(sheetClass);
    }
  }

  static #getActivitySheetClasses() {
    const classes = new Set();
    const baseSheet = dnd5e?.applications?.activity?.ActivitySheet;
    if (typeof baseSheet === "function") {
      classes.add(baseSheet);
    }

    for (const config of Object.values(CONFIG?.DND5E?.activityTypes ?? {})) {
      if (typeof config?.sheetClass === "function") {
        classes.add(config.sheetClass);
      }
      const metadataSheet = config?.documentClass?.metadata?.sheetClass;
      if (typeof metadataSheet === "function") {
        classes.add(metadataSheet);
      }
    }

    return classes;
  }

  static #patchSheetClass(sheetClass) {
    if (!sheetClass?.prototype || Object.prototype.hasOwnProperty.call(sheetClass, PATCHED)) {
      return;
    }

    sheetClass[PATCHED] = true;
    ActivitySheetConditionTab.#addPart(sheetClass);
    ActivitySheetConditionTab.#wrapGetTabs(sheetClass);
    ActivitySheetConditionTab.#wrapPreparePartContext(sheetClass);
    ActivitySheetConditionTab.#wrapOnRender(sheetClass);
    ActivitySheetConditionTab.#wrapPrepareSubmitData(sheetClass);
  }

  static #addPart(sheetClass) {
    const parts = Object.prototype.hasOwnProperty.call(sheetClass, "PARTS")
      ? (sheetClass.PARTS ?? {})
      : { ...(sheetClass.PARTS ?? {}) };
    sheetClass.PARTS = parts;
    parts.condition = {
      template: TEMPLATE_PATH
    };
  }

  static #wrapGetTabs(sheetClass) {
    const original = sheetClass.prototype._getTabs;
    if (typeof original !== "function") {
      return;
    }

    sheetClass.prototype._getTabs = function(...args) {
      const tabs = original.apply(this, args) ?? {};
      tabs.condition = {
        id: "condition",
        group: "sheet",
        icon: "fa-solid fa-code",
        label: Constants.localize("SCConditionalActivities.ConditionTab.Label", "Condition")
      };

      if (typeof this._markTabs === "function") {
        return this._markTabs(tabs);
      }

      const active = this.tabGroups?.sheet === "condition";
      tabs.condition.active = active;
      tabs.condition.cssClass = active ? "active" : "";
      return tabs;
    };
  }

  static #wrapPreparePartContext(sheetClass) {
    const original = sheetClass.prototype._preparePartContext;
    if (typeof original !== "function") {
      return;
    }

    sheetClass.prototype._preparePartContext = async function(partId, context, options) {
      context = await original.call(this, partId, context, options);
      if (partId !== "condition") {
        return context;
      }

      const condition = ActivityConditionService.getCondition(this.activity);
      const warningMessage = ActivityConditionService.getWarningMessage(this.activity);
      const disableWarningMessage = ActivityConditionService.getDisableWarningMessage(this.activity);
      const badgeLabel = ActivityConditionService.getBadgeLabel(this.activity);
      const validation = ActivityConditionService.validateCondition(condition);
      return foundry.utils.mergeObject(context ?? {}, {
        tab: context?.tabs?.condition ?? {
          id: "condition",
          group: "sheet",
          cssClass: this.tabGroups?.sheet === "condition" ? "active" : ""
        },
        condition,
        warningMessage,
        disableWarningMessage,
        badgeLabel,
        warningInputId: `sc-ca-warning-message-${this.activity.id}`,
        disableWarningInputId: `sc-ca-disable-warning-message-${this.activity.id}`,
        badgeInputId: `sc-ca-badge-label-${this.activity.id}`,
        badgeLabelLength: badgeLabel.length,
        badgeLabelMaxLength: Constants.BADGE_LABEL_MAX_LENGTH,
        conditionFlagPath: Constants.CONDITION_FLAG_PATH,
        warningMessageFlagPath: Constants.WARNING_MESSAGE_FLAG_PATH,
        disableWarningMessageFlagPath: Constants.DISABLE_WARNING_MESSAGE_FLAG_PATH,
        badgeLabelFlagPath: Constants.BADGE_LABEL_FLAG_PATH,
        conditionWikiUrl: `${Constants.MODULE_WIKI_URL}#activity-condition`,
        conditionInvalid: !validation.valid,
        validationMessage: validation.error?.message ?? "",
        previewBadgeLabel: ActivityConditionService.resolveConditionFailedBadgeLabel(badgeLabel),
        previewWarningMessage: ActivityConditionService.resolveConditionFailedWarningMessage(warningMessage),
        strings: {
          label: Constants.localize("SCConditionalActivities.ConditionTab.Label", "Condition"),
          heading: Constants.localize("SCConditionalActivities.ConditionTab.Heading", "Activity condition"),
          hint: Constants.localize(
            "SCConditionalActivities.ConditionTab.Hint",
            "Use JavaScript. The activity is available only when the script returns true."
          ),
          variables: Constants.localize(
            "SCConditionalActivities.ConditionTab.Variables",
            "Available variables: activity, activityType, item, actor, user, usage, dialog, message, rollData, source, getProperty, hasProperty, deepClone, game."
          ),
          placeholder: Constants.localize(
            "SCConditionalActivities.ConditionTab.Placeholder",
            "Example: return actor?.system?.attributes?.hp?.value > 0;"
          ),
          warningLabel: Constants.localize("SCConditionalActivities.ConditionTab.WarningLabel", "Warning message"),
          warningHint: Constants.localize(
            "SCConditionalActivities.ConditionTab.WarningHint",
            "Shown when the condition returns false. Leave blank to use the default warning."
          ),
          warningTooltip: Constants.localize(
            "SCConditionalActivities.ConditionTab.WarningTooltip",
            "Optional. If left blank, Conditional Activities uses the default warning text."
          ),
          warningPlaceholder: Constants.localize(
            "SCConditionalActivities.ConditionTab.WarningPlaceholder",
            "Example: You must be raging to use this ability."
          ),
          disableWarningLabel: Constants.localize(
            "SCConditionalActivities.ConditionTab.DisableWarningLabel",
            "Disable warning message"
          ),
          disableWarningHint: Constants.localize(
            "SCConditionalActivities.ConditionTab.DisableWarningHint",
            "Blocks the activity without showing the warning notification when the condition returns false."
          ),
          disableWarningTooltip: Constants.localize(
            "SCConditionalActivities.ConditionTab.DisableWarningTooltip",
            "Condition errors still warn normally so invalid scripts are easier to spot."
          ),
          badgeLabel: Constants.localize("SCConditionalActivities.ConditionTab.BadgeLabel", "Locked badge label"),
          badgeHint: Constants.localize(
            "SCConditionalActivities.ConditionTab.BadgeHint",
            "Single-line label shown on locked activities. Leave blank to use the default badge."
          ),
          badgeTooltip: Constants.localize(
            "SCConditionalActivities.ConditionTab.BadgeTooltip",
            "Optional. Maximum 36 characters. If left blank, Conditional Activities uses the default badge label."
          ),
          badgePlaceholder: Constants.localize(
            "SCConditionalActivities.ConditionTab.BadgePlaceholder",
            "Example: Requires Essence"
          ),
          charactersUsed: Constants.localize("SCConditionalActivities.ConditionTab.CharactersUsed", "characters"),
          preview: Constants.localize("SCConditionalActivities.ConditionTab.Preview", "Preview"),
          previewBadge: Constants.localize("SCConditionalActivities.ConditionTab.PreviewBadge", "Badge"),
          previewWarning: Constants.localize("SCConditionalActivities.ConditionTab.PreviewWarning", "Warning"),
          wiki: Constants.localize("SCConditionalActivities.ConditionTab.Wiki", "Open wiki"),
          invalid: Constants.localize("SCConditionalActivities.ConditionTab.Invalid", "This condition has invalid code.")
        }
      }, { inplace: false });
    };
  }

  static #wrapOnRender(sheetClass) {
    const original = sheetClass.prototype._onRender;
    if (typeof original !== "function") {
      return;
    }

    sheetClass.prototype._onRender = async function(...args) {
      await original.apply(this, args);
      ActivitySheetConditionTab.#bindPreviewListeners(this.element);
    };
  }

  static #wrapPrepareSubmitData(sheetClass) {
    const original = sheetClass.prototype._prepareSubmitData;
    if (typeof original !== "function") {
      return;
    }

    sheetClass.prototype._prepareSubmitData = function(event, formData) {
      const submitData = original.call(this, event, formData);
      ActivityConditionService.sanitizeFlagSubmitData(submitData);
      return submitData;
    };
  }

  static #bindPreviewListeners(root) {
    if (!root?.querySelector) {
      return;
    }

    const section = root.querySelector(".sc-ca-condition-tab");
    if (!section) {
      return;
    }

    const warningInput = section.querySelector("[data-sc-ca-warning-input]");
    const badgeInput = section.querySelector("[data-sc-ca-badge-input]");
    const badgePreview = section.querySelector("[data-sc-ca-preview-badge]");
    const warningPreview = section.querySelector("[data-sc-ca-preview-warning]");
    const counter = section.querySelector("[data-sc-ca-badge-counter]");

    if (!warningInput || !badgeInput || !badgePreview || !warningPreview || !counter) {
      return;
    }

    const syncPreview = () => {
      counter.textContent = `${badgeInput.value.length}/${Constants.BADGE_LABEL_MAX_LENGTH}`;
      badgePreview.textContent = ActivityConditionService.resolveConditionFailedBadgeLabel(badgeInput.value);
      warningPreview.textContent = ActivityConditionService.resolveConditionFailedWarningMessage(warningInput.value);
    };

    warningInput.addEventListener("input", syncPreview);
    badgeInput.addEventListener("input", syncPreview);
    syncPreview();
  }
}
