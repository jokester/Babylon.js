import * as BABYLON from "core/index";
import * as DebugImport from "core/Debug/index";

declare let global: any;

/**
 * Legacy support, defining window.BABYLON (global variable).
 *
 * This is the entry point for the UMD module.
 * The entry point for a future ESM package should be index.ts
 */
const globalObject = typeof global !== "undefined" ? global : typeof window !== "undefined" ? window : undefined;
if (typeof globalObject !== "undefined") {
    (<any>globalObject).BABYLON = (<any>globalObject).BABYLON || {};
    const BABYLONGLOBAL = (<any>globalObject).BABYLON;
    BABYLONGLOBAL.Debug = BABYLONGLOBAL.Debug || {};

    const keys = [];
    for (var key in DebugImport) {
        BABYLONGLOBAL.Debug[key] = (<any>DebugImport)[key];
        keys.push(key);
    }
    for (var key in BABYLON) {
        BABYLONGLOBAL[key] = (<any>BABYLON)[key];
    }
}

export * from "core/index";
export const Debug = {
    AxesViewer: BABYLON.AxesViewer,
    BoneAxesViewer: BABYLON.BoneAxesViewer,
    PhysicsViewer: BABYLON.PhysicsViewer,
    SkeletonViewer: BABYLON.SkeletonViewer,
};
