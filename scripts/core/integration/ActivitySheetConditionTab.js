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
      const validation = ActivityConditionService.validateCondition(condition);
      return foundry.utils.mergeObject(context ?? {}, {
        tab: context?.tabs?.condition ?? {
          id: "condition",
          group: "sheet",
          cssClass: this.tabGroups?.sheet === "condition" ? "active" : ""
        },
        condition,
        conditionFlagPath: Constants.CONDITION_FLAG_PATH,
        conditionWikiUrl: `${Constants.MODULE_WIKI_URL}#activity-condition`,
        conditionInvalid: !validation.valid,
        validationMessage: validation.error?.message ?? "",
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
          wiki: Constants.localize("SCConditionalActivities.ConditionTab.Wiki", "Open wiki"),
          invalid: Constants.localize("SCConditionalActivities.ConditionTab.Invalid", "This condition has invalid code.")
        }
      }, { inplace: false });
    };
  }

  static #wrapPrepareSubmitData(sheetClass) {
    const original = sheetClass.prototype._prepareSubmitData;
    if (typeof original !== "function") {
      return;
    }

    sheetClass.prototype._prepareSubmitData = function(event, formData) {
      const submitData = original.call(this, event, formData);
      const condition = foundry.utils.getProperty(submitData, Constants.CONDITION_FLAG_PATH);
      if (typeof condition === "string" && !condition.trim().length) {
        foundry.utils.setProperty(submitData, Constants.CONDITION_FLAG_PATH, null);
      }
      return submitData;
    };
  }
}
