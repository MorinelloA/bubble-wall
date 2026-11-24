// The layer map as a rule: src/core is pure TypeScript and may import only from
// src/core. Nothing may import in a circle.
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "core-is-pure",
      comment: "src/core must not import the browser layer, Node or any package.",
      severity: "error",
      from: { path: "^src/core/" },
      to: { pathNot: "^src/core/" },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
  },
};
