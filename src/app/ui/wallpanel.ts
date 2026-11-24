/** The Wall tab: what the real remote cannot do. Bubbles, light speed, extra shows, layout. */
import {
  changeBubbleSpeed,
  changeLightSpeed,
  setLayout,
  setMode,
  toggleBubbles,
  togglePause,
} from "../../core/actions";
import {
  BUBBLE_SPEED_STEPS,
  LIGHT_SPEED_STEPS,
  type Layout,
  type Settings,
} from "../../core/settings";
import type { Change, Store } from "../../core/store";
import { button, el, section, setPressed, stepper } from "./dom";
import type { IconName } from "./icons";

/** A piece of the panel: its element, and how to bring it up to date. */
interface Part {
  readonly element: HTMLElement;
  readonly refresh: (settings: Settings) => void;
}

const LAYOUT_CHOICES: readonly (readonly [Layout, string, IconName])[] = [
  ["tubes6", "Six tubes", "tubes6"],
  ["tubes3", "Three tubes", "tubes3"],
  ["open", "One big tank", "open"],
];

/** A tile that applies one change and lights up while `isOn` holds. */
function tile(
  doc: Document,
  store: Store,
  spec: { label: string; icon: IconName; change: Change; isOn: (settings: Settings) => boolean },
): Part {
  const element = button(doc, {
    label: spec.label,
    className: "tile",
    icon: spec.icon,
    caption: true,
    onPress: () => {
      store.update(spec.change);
    },
  });
  return {
    element,
    refresh: (settings) => {
      setPressed(element, spec.isOn(settings));
    },
  };
}

function bubbleControls(doc: Document, store: Store): Part {
  const pump = tile(doc, store, {
    label: "Bubbles",
    icon: "wall",
    change: toggleBubbles,
    isOn: (settings) => settings.bubblesOn,
  });
  const speed = stepper(doc, {
    label: "Bubble speed",
    steps: BUBBLE_SPEED_STEPS,
    onChange: (direction) => {
      store.update(changeBubbleSpeed(direction));
    },
  });
  const row = el(doc, "div", "row");
  row.append(pump.element, speed.element);
  return {
    element: section(doc, "Bubbles", row),
    refresh: (settings) => {
      pump.refresh(settings);
      speed.show(settings.bubbleSpeed);
    },
  };
}

function lightControls(doc: Document, store: Store): Part {
  const speed = stepper(doc, {
    label: "Light speed",
    steps: LIGHT_SPEED_STEPS,
    onChange: (direction) => {
      store.update(changeLightSpeed(direction));
    },
  });
  const tiles = [
    tile(doc, store, {
      label: "Rainbow",
      icon: "rainbow",
      change: setMode("rainbow"),
      isOn: (settings) => settings.mode === "rainbow",
    }),
    tile(doc, store, {
      label: "Breathe",
      icon: "breathe",
      change: setMode("breathe"),
      isOn: (settings) => settings.mode === "breathe",
    }),
    tile(doc, store, {
      label: "Hold this colour",
      icon: "pause",
      change: togglePause,
      isOn: (settings) => settings.paused,
    }),
  ];
  const shows = el(doc, "div", "tiles");
  shows.append(...tiles.map((part) => part.element));
  const element = el(doc, "div");
  element.append(section(doc, "Light speed", speed.element), section(doc, "More lights", shows));
  return {
    element,
    refresh: (settings) => {
      speed.show(settings.lightSpeed);
      for (const part of tiles) part.refresh(settings);
    },
  };
}

function layoutControls(doc: Document, store: Store): Part {
  const tiles = LAYOUT_CHOICES.map(([layout, label, iconName]) =>
    tile(doc, store, {
      label,
      icon: iconName,
      change: setLayout(layout),
      isOn: (settings) => settings.layout === layout,
    }),
  );
  const choices = el(doc, "div", "tiles");
  choices.append(...tiles.map((part) => part.element));
  return {
    element: section(doc, "Wall", choices),
    refresh: (settings) => {
      for (const part of tiles) part.refresh(settings);
    },
  };
}

export function createWallPanel(doc: Document, store: Store): HTMLElement {
  const parts = [bubbleControls(doc, store), lightControls(doc, store), layoutControls(doc, store)];
  const element = el(doc, "div", "wall-panel");
  element.append(...parts.map((part) => part.element));
  const refresh = (): void => {
    for (const part of parts) part.refresh(store.get());
  };
  store.subscribe(refresh);
  refresh();
  return element;
}
