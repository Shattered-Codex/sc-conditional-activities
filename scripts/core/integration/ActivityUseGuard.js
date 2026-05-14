import { Constants } from "../Constants.js";
import { ActivityConditionService } from "../services/ActivityConditionService.js";

const PATCHED = Symbol.for(`${Constants.MODULE_ID}.ActivityUseGuard.patched`);

export class ActivityUseGuard {
  static activate() {
    if (!Constants.isDnd5eActive()) {
      return;
    }

    for (const documentClass of ActivityUseGuard.#getActivityDocumentClasses()) {
      ActivityUseGuard.#patchDocumentClass(documentClass);
    }
  }

  static #getActivityDocumentClasses() {
    const classes = new Set();
    for (const config of Object.values(CONFIG?.DND5E?.activityTypes ?? {})) {
      if (typeof config?.documentClass === "function") {
        classes.add(config.documentClass);
      }
    }
    return classes;
  }

  static #patchDocumentClass(documentClass) {
    const prototype = documentClass?.prototype;
    if (!prototype || Object.prototype.hasOwnProperty.call(prototype, PATCHED) || typeof prototype.use !== "function") {
      return;
    }

    prototype[PATCHED] = true;
    const original = prototype.use;
    prototype.use = async function(usage = {}, dialog = {}, message = {}) {
      const result = await ActivityConditionService.evaluate(this, {
        usage,
        dialog,
        message,
        source: "use"
      });

      if (!result.available) {
        ui.notifications?.warn?.(
          result.error
            ? ActivityConditionService.getConditionErrorWarningMessage()
            : ActivityConditionService.getConditionFailedWarningMessage(this)
        );
        return;
      }

      return original.call(this, usage, dialog, message);
    };
  }
}
