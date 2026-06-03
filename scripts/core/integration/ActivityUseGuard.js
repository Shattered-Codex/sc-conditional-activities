import { Constants } from "../Constants.js";
import { ActivityConditionService } from "../services/ActivityConditionService.js";

const PATCHED = Symbol.for(`${Constants.MODULE_ID}.ActivityUseGuard.patched`);

export class ActivityUseGuard {
  static #libWrapperTargets = new Set();

  static activate() {
    if (!Constants.isDnd5eActive()) {
      return;
    }

    if (globalThis.libWrapper?.register) {
      ActivityUseGuard.#installLibWrapperWrappers();
      return;
    }

    for (const documentClass of ActivityUseGuard.#getActivityDocumentTargets().keys()) {
      ActivityUseGuard.#patchDocumentClass(documentClass);
    }
  }

  static #getActivityDocumentTargets() {
    const targets = new Map();
    for (const [activityType, config] of Object.entries(CONFIG?.DND5E?.activityTypes ?? {})) {
      if (typeof config?.documentClass === "function") {
        targets.set(config.documentClass, `CONFIG.DND5E.activityTypes.${activityType}.documentClass.prototype.use`);
      }
    }
    return targets;
  }

  static #patchDocumentClass(documentClass) {
    const prototype = documentClass?.prototype;
    if (!prototype || Object.prototype.hasOwnProperty.call(prototype, PATCHED) || typeof prototype.use !== "function") {
      return;
    }

    prototype[PATCHED] = true;
    const original = prototype.use;
    prototype.use = async function(usage = {}, dialog = {}, message = {}) {
      return ActivityUseGuard.#handleUse.call(this, original, usage, dialog, message);
    };
  }

  static #installLibWrapperWrappers() {
    for (const [documentClass, target] of ActivityUseGuard.#getActivityDocumentTargets()) {
      if (ActivityUseGuard.#libWrapperTargets.has(target)) {
        continue;
      }

      try {
        globalThis.libWrapper.register(
          Constants.MODULE_ID,
          target,
          function(wrapped, usage = {}, dialog = {}, message = {}) {
            return ActivityUseGuard.#handleUse.call(this, wrapped, usage, dialog, message);
          },
          "MIXED"
        );
        ActivityUseGuard.#libWrapperTargets.add(target);
      } catch (error) {
        console.warn(`[${Constants.MODULE_ID}] could not wrap ${target}`, error);
        ActivityUseGuard.#patchDocumentClass(documentClass);
      }
    }
  }

  static async #handleUse(wrapped, usage = {}, dialog = {}, message = {}) {
    const result = await ActivityConditionService.evaluate(this, {
      usage,
      dialog,
      message,
      source: "use"
    });

    if (!result.available) {
      const warningMessage = result.error
        ? ActivityConditionService.getConditionErrorWarningMessage()
        : ActivityConditionService.shouldShowConditionFailedWarningMessage(this)
          ? ActivityConditionService.getConditionFailedWarningMessage(this)
          : null;
      if (warningMessage) {
        ui.notifications?.warn?.(warningMessage);
      }
      return;
    }

    return wrapped.call(this, usage, dialog, message);
  }
}
