<p align="center">
  <a href="https://www.patreon.com/c/shatteredcodex?utm_source=sc-conditional-activities&utm_medium=github&utm_campaign=support_readme">
    <img src="https://i.imgur.com/9kf3oWy.png" alt="Shattered Codex" width="200" height="200" />
  </a>
</p>

# SC - Conditional Activities

[![Wiki](https://img.shields.io/badge/Wiki-SC%20Conditional%20Activities-1f6feb?logo=bookstack&logoColor=white&style=for-the-badge)](https://wiki.shattered-codex.com/modules/sc-conditional-activities)
[![Support on Patreon](https://img.shields.io/badge/Patreon-Shattered%20Codex-FF424D?logo=patreon&logoColor=white&style=for-the-badge)](https://www.patreon.com/c/shatteredcodex?utm_source=sc-conditional-activities&utm_medium=github&utm_campaign=support_readme)
![Foundry VTT 13-14](https://img.shields.io/badge/Foundry%20VTT-v13%20%7C%20v14-orange?logo=foundry-vtt&logoColor=white&style=for-the-badge)
![System: dnd5e](https://img.shields.io/badge/System-dnd5e-blue?style=for-the-badge)
![Activities](https://img.shields.io/badge/dnd5e-Activities-2ea44f?style=for-the-badge)
![More Activities Compatible](https://img.shields.io/badge/More%20Activities-Compatible-8A2BE2?style=for-the-badge)
![Downloads](https://img.shields.io/github/downloads/Shattered-Codex/sc-conditional-activities/total?style=for-the-badge)
![Forks](https://img.shields.io/github/forks/Shattered-Codex/sc-conditional-activities.svg?style=for-the-badge)

Adds a **Condition** tab to every **dnd5e activity sheet** in Foundry VTT.

The condition is a JavaScript snippet that must return `true` for the activity to be usable. If the condition returns `false`, the activity shows a **Not available** label and is blocked when a user tries to use it.

This also applies to activity types added by **More Activities**.

[Report an issue or request a feature](https://github.com/Shattered-Codex/sc-conditional-activities/issues)  
[Official Wiki](https://wiki.shattered-codex.com/modules/sc-conditional-activities)

---

## Preview

### Locked Activity Choice

![Activity choice dialog with Teleport marked as Not available](https://i.imgur.com/sk4Yjq3.png)

When an item has multiple activities, locked activities remain visible in the choice dialog with a clear **Not available** label.

### Activity List Label

![Item activity list with a locked Teleport activity](https://i.imgur.com/NJITpZI.png)

The same label is shown in the item sheet activity list, so users can see which activity is currently blocked before trying to use it.

### Condition Tab

![Activity condition tab with a Simple Sockets condition script](https://i.imgur.com/aIgCxFC.png)

Each activity sheet gets a **Condition** tab with a JavaScript editor and direct wiki access. This example checks whether the item has an occupied Simple Sockets socket.

## What It Does

- Adds a **Condition** tab to dnd5e activities.
- Stores the condition on the activity at `flags.sc-conditional-activities.condition`.
- Evaluates the condition before `activity.use()`.
- Shows a visible **Not available** label when an activity is locked.
- Works with native dnd5e activities.
- Works with activities registered by **More Activities**.
- Supports English and Brazilian Portuguese.

## Requirements

- **Foundry VTT:** v13 and v14
- **System:** dnd5e

## Installation

1. In Foundry, open **Add-on Modules > Install Module**.
2. Paste this manifest URL:

```text
https://github.com/Shattered-Codex/sc-conditional-activities/releases/latest/download/module.json
```

3. Install the module.
4. Enable **SC - Conditional Activities** in your world.

## Condition Context

Available variables in the condition script:

- `activity`
- `activityType`
- `item`
- `actor`
- `user`
- `usage`
- `dialog`
- `message`
- `rollData`
- `source`
- `getProperty`
- `hasProperty`
- `deepClone`
- `game`

You can write either a complete script:

```js
return actor?.system?.attributes?.hp?.value > 0;
```

Or a simple expression. This only works when the entire condition is one expression:

```js
actor?.system?.attributes?.hp?.value > 0
```

If your condition uses statements like `const`, `let`, `if`, or `await`, finish with `return`.

This works:

```js
const hp = actor?.system?.attributes?.hp?.value ?? 0;
return hp > 0;
```

This does not work:

```js
const hp = actor?.system?.attributes?.hp?.value ?? 0;
hp > 0;
```

## Example Conditions

### Actor must be alive

```js
return actor?.system?.attributes?.hp?.value > 0;
```

### Only the GM can use this activity

```js
return user?.isGM === true;
```

### Item must be equipped

```js
return item?.system?.equipped === true;
```

### Item must be attuned

```js
return item?.system?.attuned === true;
```

### Item must be identified

```js
return item?.system?.identified === true;
```

### Actor must have at least 10 HP

```js
return actor?.system?.attributes?.hp?.value >= 10;
```

### Actor must have a specific flag

```js
return getProperty(actor, "flags.world.canUseAncientPower") === true;
```

### Activity must be an attack activity

```js
return activityType === "attack";
```

### Item name must include a word

```js
return item?.name?.toLowerCase().includes("flame");
```

### Actor must have a minimum Strength score

```js
return actor?.system?.abilities?.str?.value >= 16;
```

### Actor must have a resource available

```js
return actor?.system?.resources?.primary?.value > 0;
```

### Require at least one target selected

```js
return game.user?.targets?.size > 0;
```

### Require exactly one target selected

```js
return game.user?.targets?.size === 1;
```

### Require combat to be active

```js
return Boolean(game.combat?.started);
```

## SC - Simple Sockets Examples

These examples are useful when the activity belongs to an item that also uses **SC - Simple Sockets**.

### Item must have at least one occupied socket

Recommended version using the Simple Sockets API:

```js
const socketsApi = game.modules.get("sc-simple-sockets")?.api?.sockets;
if (!socketsApi) return false;

const slots = await socketsApi.getItemSlots(item);
return slots.some((entry) => entry.hasGem);
```

### First socket must be occupied

```js
const socketsApi = game.modules.get("sc-simple-sockets")?.api?.sockets;
if (!socketsApi) return false;

const slots = await socketsApi.getItemSlots(item);
return slots[0]?.hasGem === true;
```

### Item must have at least two occupied sockets

```js
const socketsApi = game.modules.get("sc-simple-sockets")?.api?.sockets;
if (!socketsApi) return false;

const slots = await socketsApi.getItemSlots(item);
return slots.filter((entry) => entry.hasGem).length >= 2;
```

### Item must have a gem with a specific name

```js
const socketsApi = game.modules.get("sc-simple-sockets")?.api?.sockets;
if (!socketsApi) return false;

const gems = await socketsApi.getItemGems(item);
return gems.some((gem) => gem.name?.toLowerCase().includes("ruby"));
```

### Direct flag check for an occupied socket

Use this only if you want a simple direct read and do not need the Simple Sockets API helpers.

```js
const sockets = item?.getFlag?.("sc-simple-sockets", "sockets") ?? [];
return sockets.some((slot) => Boolean(slot?.gem));
```

## Notes

- Empty conditions always allow the activity.
- If a condition throws an error, the activity is treated as unavailable.
- Conditions can use `await`.
- Conditions run when the UI checks availability and again when the activity is used.