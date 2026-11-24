/**
 * The remote, key for key: On, Off, Dimmer, Brighter, the 16 colours, then Flash,
 * Strobe, Fade and Smooth, four across and six down like the real one.
 */
import { isRemoteKeyActive, remoteKeyEffect } from "../../core/actions";
import { REMOTE_KEYS, type RemoteKey } from "../../core/palette";
import { isFlashing, LIGHT_MODES } from "../../core/settings";
import type { Store } from "../../core/store";
import type { PowerControl } from "../power";
import { button, el, setPressed } from "./dom";
import type { IconName } from "./icons";

const ICONS: ReadonlyMap<string, IconName> = new Map([
  ["on", "power"],
  ["off", "power"],
  ["dimmer", "dimmer"],
  ["brighter", "brighter"],
  ["flash", "flash"],
  ["strobe", "strobe"],
  ["fade", "fade"],
  ["smooth", "smooth"],
]);

function isFlashingKey(key: RemoteKey): boolean {
  const mode = LIGHT_MODES.find((id) => id === key.id);
  return mode !== undefined && isFlashing(mode);
}

export function createRemote(doc: Document, store: Store, power: PowerControl): HTMLElement {
  const element = el(doc, "div", "remote");
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", "Bubble wall remote");

  const keys = REMOTE_KEYS.map((key) => {
    const isColor = key.group === "colors";
    const iconName = ICONS.get(key.id);
    const keyButton = button(doc, {
      label: key.label,
      className: isColor ? "bubble" : "bubble glass",
      caption: !isColor,
      ...(iconName ? { icon: iconName } : {}),
      onPress: () => {
        const effect = remoteKeyEffect(key);
        if (effect.kind === "change") store.update(effect.change);
        else if (effect.on) power.on();
        else power.off();
      },
    });
    keyButton.dataset.key = key.id;
    keyButton.style.setProperty("--c", key.color);
    element.append(keyButton);
    return { key, keyButton };
  });

  const refresh = (): void => {
    const settings = store.get();
    for (const { key, keyButton } of keys) {
      setPressed(keyButton, isRemoteKeyActive(key, settings, power.isOn()));
      keyButton.hidden = isFlashingKey(key) && !settings.allowFlashStrobe;
    }
  };
  store.subscribe(refresh);
  power.subscribe(refresh);
  refresh();
  return element;
}
