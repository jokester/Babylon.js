import * as Loaders from "loaders/STL/index";

/**
 * This is the entry point for the UMD module.
 * The entry point for a future ESM package should be index.ts
 */
const globalObject = typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : undefined;
if (typeof globalObject !== "undefined") {
    for (const key in Loaders) {
        (<any>globalObject).BABYLON[key] = (<any>Loaders)[key];
    }
}

export * from "loaders/STL/index";
