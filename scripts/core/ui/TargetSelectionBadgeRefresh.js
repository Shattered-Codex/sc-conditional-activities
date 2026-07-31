import { ActivityConditionBadges } from "./ActivityConditionBadges.js";

export class TargetSelectionBadgeRefresh {
  static #targetTokenHandler = null;
  static #scheduledHandle = null;
  static #scheduledWithAnimationFrame = false;

  static activate() {
    if (TargetSelectionBadgeRefresh.#targetTokenHandler) {
      return;
    }

    TargetSelectionBadgeRefresh.#targetTokenHandler = (user) => {
      if (user?.id !== game.user?.id) {
        return;
      }

      ActivityConditionBadges.invalidateEvaluations();
      TargetSelectionBadgeRefresh.#scheduleRefresh();
    };
    Hooks.on("targetToken", TargetSelectionBadgeRefresh.#targetTokenHandler);
  }

  static deactivate() {
    if (TargetSelectionBadgeRefresh.#targetTokenHandler) {
      Hooks.off("targetToken", TargetSelectionBadgeRefresh.#targetTokenHandler);
      TargetSelectionBadgeRefresh.#targetTokenHandler = null;
    }

    TargetSelectionBadgeRefresh.#cancelScheduledRefresh();
    ActivityConditionBadges.invalidateEvaluations();
  }

  static #scheduleRefresh() {
    if (TargetSelectionBadgeRefresh.#scheduledHandle !== null) {
      return;
    }

    const refresh = () => {
      TargetSelectionBadgeRefresh.#scheduledHandle = null;
      void ActivityConditionBadges.refreshOpenSurfaces();
    };

    if (typeof globalThis.requestAnimationFrame === "function") {
      TargetSelectionBadgeRefresh.#scheduledWithAnimationFrame = true;
      TargetSelectionBadgeRefresh.#scheduledHandle = globalThis.requestAnimationFrame(refresh);
      return;
    }

    TargetSelectionBadgeRefresh.#scheduledWithAnimationFrame = false;
    TargetSelectionBadgeRefresh.#scheduledHandle = globalThis.setTimeout(refresh, 0);
  }

  static #cancelScheduledRefresh() {
    if (TargetSelectionBadgeRefresh.#scheduledHandle === null) {
      return;
    }

    if (
      TargetSelectionBadgeRefresh.#scheduledWithAnimationFrame
      && typeof globalThis.cancelAnimationFrame === "function"
    ) {
      globalThis.cancelAnimationFrame(TargetSelectionBadgeRefresh.#scheduledHandle);
    } else {
      globalThis.clearTimeout(TargetSelectionBadgeRefresh.#scheduledHandle);
    }
    TargetSelectionBadgeRefresh.#scheduledHandle = null;
  }
}
