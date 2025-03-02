import { IGLTFLoaderExtension } from "../glTFLoaderExtension";
import { GLTFLoader, ArrayItem } from "../glTFLoader";
import { ITexture } from "../glTFLoaderInterfaces";
import { BaseTexture } from "core/Materials/Textures/baseTexture";
import { Nullable } from "core/types";
import { IKHRTextureBasisU } from "babylonjs-gltf2interface";

const NAME = "KHR_texture_basisu";

/**
 * [Specification](https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_basisu)
 */
export class KHR_texture_basisu implements IGLTFLoaderExtension {
    /** The name of this extension. */
    public readonly name = NAME;

    /** Defines whether this extension is enabled. */
    public enabled: boolean;

    private _loader: GLTFLoader;

    /**
     * @param loader
     * @hidden
     */
    constructor(loader: GLTFLoader) {
        this._loader = loader;
        this.enabled = loader.isExtensionUsed(NAME);
    }

    /** @hidden */
    public dispose() {
        (this._loader as any) = null;
    }

    /**
     * @param context
     * @param texture
     * @param assign
     * @hidden
     */
    public _loadTextureAsync(context: string, texture: ITexture, assign: (babylonTexture: BaseTexture) => void): Nullable<Promise<BaseTexture>> {
        return GLTFLoader.LoadExtensionAsync<IKHRTextureBasisU, BaseTexture>(context, texture, this.name, (extensionContext, extension) => {
            const sampler = texture.sampler == undefined ? GLTFLoader.DefaultSampler : ArrayItem.Get(`${context}/sampler`, this._loader.gltf.samplers, texture.sampler);
            const image = ArrayItem.Get(`${extensionContext}/source`, this._loader.gltf.images, extension.source);
            return this._loader._createTextureAsync(
                context,
                sampler,
                image,
                (babylonTexture) => {
                    assign(babylonTexture);
                },
                texture._textureInfo.nonColorData ? { useRGBAIfASTCBC7NotAvailableWhenUASTC: true } : undefined,
                !texture._textureInfo.nonColorData
            );
        });
    }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new KHR_texture_basisu(loader));
