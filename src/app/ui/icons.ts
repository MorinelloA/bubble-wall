/**
 * Every icon in the app, as shape data. Icons are built element by element, never
 * from HTML text. The remote's icons are the ones from the remote app he already uses.
 */

type Shape = readonly [
  tag: "path" | "circle" | "rect",
  attributes: Readonly<Record<string, string>>,
];

const filled = { fill: "currentColor" };

const SHAPES = {
  power: [
    ["path", { d: "M12 3v8" }],
    ["path", { d: "M6.3 6.8a8 8 0 1 0 11.4 0" }],
  ],
  brighter: [
    ["circle", { cx: "12", cy: "12", r: "4.2", ...filled }],
    [
      "path",
      {
        d: "M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1",
      },
    ],
  ],
  dimmer: [
    ["circle", { cx: "12", cy: "12", r: "3", ...filled }],
    [
      "path",
      {
        d: "M12 6v1.2M12 16.8V18M6 12h1.2M16.8 12H18M7.8 7.8l.8.8M15.4 15.4l.8.8M7.8 16.2l.8-.8M15.4 8.6l.8-.8",
      },
    ],
  ],
  flash: [["path", { d: "M13.5 2.5 5 13.5h6l-1 8 8.5-11.5h-6z", ...filled }]],
  strobe: [
    ["path", { d: "M12 2.5l1.9 6.1 6.1 1.9-6.1 1.9L12 18.5l-1.9-6.1L4 10.5l6.1-1.9z", ...filled }],
    ["path", { d: "M19 16.5v4M17 18.5h4" }],
  ],
  fade: [
    ["circle", { cx: "12", cy: "12", r: "8.5" }],
    ["path", { d: "M12 3.5a8.5 8.5 0 0 1 0 17z", ...filled }],
  ],
  smooth: [
    ["path", { d: "M2.5 9c2.4-3 4.7-3 7.1 0s4.7 3 7.1 0 3.6-2.6 4.8-1.4" }],
    ["path", { d: "M2.5 15.5c2.4-3 4.7-3 7.1 0s4.7 3 7.1 0 3.6-2.6 4.8-1.4" }],
  ],
  remote: [
    ["rect", { x: "6.5", y: "2.5", width: "11", height: "19", rx: "3" }],
    ["circle", { cx: "12", cy: "7", r: "1.4", ...filled }],
    [
      "path",
      { d: "M9.5 11.5h.01M12 11.5h.01M14.5 11.5h.01M9.5 14.5h.01M12 14.5h.01M14.5 14.5h.01" },
    ],
  ],
  sound: [
    ["path", { d: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z", ...filled }],
    ["path", { d: "M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" }],
  ],
  wall: [
    ["circle", { cx: "8", cy: "15.5", r: "4.5" }],
    ["circle", { cx: "16.5", cy: "8", r: "3" }],
    ["circle", { cx: "17.5", cy: "17.5", r: "1.6" }],
  ],
  more: [
    [
      "path",
      {
        d: "M12 3.2l2.6 5.6 6.1.7-4.5 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.5l6.1-.7z",
      },
    ],
  ],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  minus: [["path", { d: "M5 12h14" }]],
  pause: [["path", { d: "M8.5 5.5v13M15.5 5.5v13" }]],
  play: [["path", { d: "M8 5l11 7-11 7z", ...filled }]],
  rainbow: [
    ["path", { d: "M3 17a9 9 0 0 1 18 0" }],
    ["path", { d: "M6.5 17a5.5 5.5 0 0 1 11 0" }],
    ["path", { d: "M10 17a2 2 0 0 1 4 0" }],
  ],
  breathe: [
    ["circle", { cx: "12", cy: "12", r: "3.2", ...filled }],
    ["circle", { cx: "12", cy: "12", r: "6.2" }],
    ["circle", { cx: "12", cy: "12", r: "9.2", "stroke-dasharray": "2 3" }],
  ],
  tubes6: [["path", { d: "M4 4v16M7.2 4v16M10.4 4v16M13.6 4v16M16.8 4v16M20 4v16" }]],
  tubes3: [
    ["rect", { x: "3.5", y: "4", width: "4", height: "16", rx: "1.5" }],
    ["rect", { x: "10", y: "4", width: "4", height: "16", rx: "1.5" }],
    ["rect", { x: "16.5", y: "4", width: "4", height: "16", rx: "1.5" }],
  ],
  open: [["rect", { x: "3.5", y: "4", width: "17", height: "16", rx: "2" }]],
  grip: [["path", { d: "M10 5v14M14 5v14" }]],
  motor: [
    ["circle", { cx: "12", cy: "12", r: "3.2" }],
    ["circle", { cx: "12", cy: "12", r: "7.2" }],
    [
      "path",
      {
        d: "M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6",
      },
    ],
  ],
  stream: [
    ["path", { d: "M2.5 7c2.4-2.6 4.7-2.6 7.1 0s4.7 2.6 7.1 0 3.6-2.2 4.8-1.2" }],
    ["path", { d: "M2.5 12.5c2.4-2.6 4.7-2.6 7.1 0s4.7 2.6 7.1 0 3.6-2.2 4.8-1.2" }],
    ["path", { d: "M2.5 18c2.4-2.6 4.7-2.6 7.1 0s4.7 2.6 7.1 0 3.6-2.2 4.8-1.2" }],
  ],
  rain: [
    ["path", { d: "M7 14a4 4 0 0 1 .6-7.9A5.5 5.5 0 0 1 18 7.5a3.3 3.3 0 0 1-.5 6.5z" }],
    ["path", { d: "M8.5 17.5l-1 2.8M12.5 17.5l-1 2.8M16.5 17.5l-1 2.8" }],
  ],
  ocean: [
    ["path", { d: "M2.5 13.5c3-6.5 7.5-7.5 10-3.5 1 1.7.2 3.6-1.6 3.3" }],
    ["path", { d: "M2.5 19c2.4-2 4.7-2 7.1 0s4.7 2 7.1 0 3.6-1.6 4.8-.6" }],
  ],
  deep: [
    ["path", { d: "M12 3v11M7.5 9.8l4.5 4.5 4.5-4.5" }],
    ["path", { d: "M4 19.5c2.7-1.7 5.3-1.7 8 0s5.3 1.7 8 0" }],
  ],
  noise: [["path", { d: "M3.5 10v4M7 6v12M10.5 9v6M14 4v16M17.5 8v8M21 11v2" }]],
  chimes: [
    ["path", { d: "M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" }],
    ["path", { d: "M10.5 20.6a1.6 1.6 0 0 0 3 0" }],
  ],
  none: [
    ["circle", { cx: "12", cy: "12", r: "8.5" }],
    ["path", { d: "M6 18 18 6" }],
  ],
  fish: [
    ["path", { d: "M3 12c3-5 9-6 13-2.5L21 6v12l-5-3.5C12 18 6 17 3 12z" }],
    ["circle", { cx: "8", cy: "11", r: "0.9", ...filled }],
  ],
  ball: [
    ["circle", { cx: "12", cy: "12", r: "8.5" }],
    ["path", { d: "M8 7.5a6 6 0 0 1 3.5-1.6" }],
  ],
  burst: [
    ["circle", { cx: "12", cy: "12", r: "3" }],
    [
      "path",
      {
        d: "M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5M5.3 5.3l2.5 2.5M16.2 16.2l2.5 2.5M5.3 18.7l2.5-2.5M16.2 7.8l2.5-2.5",
      },
    ],
  ],
  lock: [
    ["rect", { x: "5", y: "10.5", width: "14", height: "10", rx: "2.5" }],
    ["path", { d: "M8 10.5V8a4 4 0 0 1 8 0v2.5" }],
  ],
  moon: [["path", { d: "M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" }]],
  flame: [
    [
      "path",
      {
        d: "M12 21c-3.6 0-6.2-2.6-6.2-6 0-2.8 1.7-4.6 3.2-6.4C10.3 7 11 5.3 11 3c3.2 1.6 6.8 5.4 6.8 11.2 0 3.9-2.4 6.8-5.8 6.8z",
      },
    ],
  ],
  mute: [
    ["path", { d: "M3.5 9.5v5H7l4.5 4v-13L7 9.5z", ...filled }],
    ["path", { d: "M15.5 9.5l5 5M20.5 9.5l-5 5" }],
  ],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof SHAPES;

const SHAPES_BY_NAME: ReadonlyMap<string, readonly Shape[]> = new Map(Object.entries(SHAPES));
const SVG = "http://www.w3.org/2000/svg";

/** A line icon on a 24 by 24 grid, drawn in the current text colour. Hidden from screen readers. */
export function icon(doc: Document, name: IconName): SVGSVGElement {
  const svg = doc.createElementNS(SVG, "svg");
  const frame = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2.2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  };
  for (const [attribute, value] of Object.entries(frame)) svg.setAttribute(attribute, value);
  for (const [tag, attributes] of SHAPES_BY_NAME.get(name) ?? []) {
    const shape = doc.createElementNS(SVG, tag);
    for (const [attribute, value] of Object.entries(attributes)) {
      shape.setAttribute(attribute, value);
    }
    svg.append(shape);
  }
  return svg;
}
