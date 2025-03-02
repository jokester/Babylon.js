import { Nullable } from "core/types";
import { PBRMaterial } from "core/Materials/PBR/pbrMaterial";
import { Material } from "core/Materials/material";

import { IMaterial } from "../glTFLoaderInterfaces";
import { IGLTFLoaderExtension } from "../glTFLoaderExtension";
import { GLTFLoader } from "../glTFLoader";
import { IKHRMaterialsIor } from "babylonjs-gltf2interface";

const NAME = "KHR_materials_ior";

/**
 * [Specification](https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_ior)
 */
export class KHR_materials_ior implements IGLTFLoaderExtension {
    /**
     * Default ior Value from the spec.
     */
    private static readonly _DEFAULT_IOR = 1.5;

    /**
     * The name of this extension.
     */
    public readonly name = NAME;

    /**
     * Defines whether this extension is enabled.
     */
    public enabled: boolean;

    /**
     * Defines a number that determines the order the extensions are applied.
     */
    public order = 180;

    private _loader: GLTFLoader;

    /**
     * @param loader
     * @hidden
     */
    constructor(loader: GLTFLoader) {
        this._loader = loader;
        this.enabled = this._loader.isExtensionUsed(NAME);
    }

    /** @hidden */
    public dispose() {
        (this._loader as any) = null;
    }

    /**
     * @param context
     * @param material
     * @param babylonMaterial
     * @hidden
     */
    public loadMaterialPropertiesAsync(context: string, material: IMaterial, babylonMaterial: Material): Nullable<Promise<void>> {
        return GLTFLoader.LoadExtensionAsync<IKHRMaterialsIor>(context, material, this.name, (extensionContext, extension) => {
            const promises = new Array<Promise<any>>();
            promises.push(this._loader.loadMaterialPropertiesAsync(context, material, babylonMaterial));
            promises.push(this._loadIorPropertiesAsync(extensionContext, extension, babylonMaterial));
            return Promise.all(promises).then(() => {});
        });
    }

    private _loadIorPropertiesAsync(context: string, properties: IKHRMaterialsIor, babylonMaterial: Material): Promise<void> {
        if (!(babylonMaterial instanceof PBRMaterial)) {
            throw new Error(`${context}: Material type not supported`);
        }

        if (properties.ior !== undefined) {
            babylonMaterial.indexOfRefraction = properties.ior;
        } else {
            babylonMaterial.indexOfRefraction = KHR_materials_ior._DEFAULT_IOR;
        }

        return Promise.resolve();
    }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new KHR_materials_ior(loader));
