/**
 * Lets a script import modules marked `import "server-only"`.
 *
 * Those modules are fine to run in a script — the guard exists to keep them
 * out of the browser bundle, and a script is neither a browser nor a bundle.
 *
 * Loaded with `bun --preload ./scripts/_stub-server-only.ts <script>`.
 * Written against the global Bun object rather than importing "bun", so the
 * repo does not need @types/bun to typecheck.
 */

declare const Bun: {
  plugin: (definition: {
    name: string;
    setup: (build: {
      module: (path: string, load: () => { exports: unknown; loader: string }) => void;
    }) => void;
  }) => void;
};

Bun.plugin({
  name: "stub-server-only",
  setup(build) {
    build.module("server-only", () => ({ exports: {}, loader: "object" }));
  },
});
