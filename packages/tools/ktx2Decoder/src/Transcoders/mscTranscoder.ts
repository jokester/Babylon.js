import { Transcoder, sourceTextureFormat, transcodeTarget } from "../transcoder";
import { KTX2FileReader, IKTX2_ImageDesc } from "../ktx2FileReader";
import { WASMMemoryManager } from "../wasmMemoryManager";

declare let MSC_TRANSCODER: any;

declare function importScripts(...urls: string[]): void;

/**
 * @hidden
 */
export class MSCTranscoder extends Transcoder {
    /**
     * URL to use when loading the MSC transcoder
     */
    public static JSModuleURL = "https://preview.babylonjs.com/ktx2Transcoders/msc_basis_transcoder.js";
    /**
     * URL to use when loading the wasm module for the transcoder
     */
    public static WasmModuleURL = "https://preview.babylonjs.com/ktx2Transcoders/msc_basis_transcoder.wasm";

    public static UseFromWorkerThread = true;

    public static Name = "MSCTranscoder";

    public getName(): string {
        return MSCTranscoder.Name;
    }

    private _mscBasisTranscoderPromise: Promise<void>;
    private _mscBasisModule: any;

    private _getMSCBasisTranscoder(): Promise<void> {
        if (this._mscBasisTranscoderPromise) {
            return this._mscBasisTranscoderPromise;
        }

        this._mscBasisTranscoderPromise = WASMMemoryManager.LoadWASM(MSCTranscoder.WasmModuleURL).then((wasmBinary) => {
            if (MSCTranscoder.UseFromWorkerThread) {
                importScripts(MSCTranscoder.JSModuleURL);
            }
            // Worker Number = 0 and MSC_TRANSCODER has not been loaded yet.
            else if (typeof MSC_TRANSCODER === "undefined") {
                return new Promise((resolve, reject) => {
                    const head = document.getElementsByTagName("head")[0];
                    const script = document.createElement("script");
                    script.setAttribute("type", "text/javascript");
                    script.setAttribute("src", MSCTranscoder.JSModuleURL);

                    script.onload = () => {
                        MSC_TRANSCODER({ wasmBinary }).then((basisModule: any) => {
                            basisModule.initTranscoders();
                            this._mscBasisModule = basisModule;
                            resolve();
                        });
                    };

                    script.onerror = () => {
                        reject("Can not load MSC_TRANSCODER script.");
                    };

                    head.appendChild(script);
                });
            }

            return new Promise((resolve) => {
                MSC_TRANSCODER({ wasmBinary }).then((basisModule: any) => {
                    basisModule.initTranscoders();
                    this._mscBasisModule = basisModule;
                    resolve();
                });
            });
        });

        return this._mscBasisTranscoderPromise;
    }

    public static CanTranscode(src: sourceTextureFormat, dst: transcodeTarget, isInGammaSpace: boolean): boolean {
        return true;
    }

    public transcode(
        src: sourceTextureFormat,
        dst: transcodeTarget,
        level: number,
        width: number,
        height: number,
        uncompressedByteLength: number,
        ktx2Reader: KTX2FileReader,
        imageDesc: IKTX2_ImageDesc | null,
        encodedData: Uint8Array
    ): Promise<Uint8Array | null> {
        const isVideo = false;

        return this._getMSCBasisTranscoder().then(() => {
            const basisModule = this._mscBasisModule;

            let transcoder: any;
            let imageInfo: any;
            let result: any;
            let textureData: any = null;

            try {
                transcoder = src === sourceTextureFormat.UASTC4x4 ? new basisModule.UastcImageTranscoder() : new basisModule.BasisLzEtc1sImageTranscoder();
                const texFormat = src === sourceTextureFormat.UASTC4x4 ? basisModule.TextureFormat.UASTC4x4 : basisModule.TextureFormat.ETC1S;

                imageInfo = new basisModule.ImageInfo(texFormat, width, height, level);

                const targetFormat = basisModule.TranscodeTarget[transcodeTarget[dst]]; // works because the labels of the sourceTextureFormat enum are the same as the property names used in TranscodeTarget!

                if (!basisModule.isFormatSupported(targetFormat, texFormat)) {
                    throw new Error(`MSCTranscoder: Transcoding from "${sourceTextureFormat[src]}" to "${transcodeTarget[dst]}" not supported by current transcoder build.`);
                }

                if (src === sourceTextureFormat.ETC1S) {
                    const sgd = ktx2Reader.supercompressionGlobalData;

                    transcoder.decodePalettes(sgd.endpointCount, sgd.endpointsData, sgd.selectorCount, sgd.selectorsData);
                    transcoder.decodeTables(sgd.tablesData);

                    imageInfo.flags = imageDesc!.imageFlags;
                    imageInfo.rgbByteOffset = 0;
                    imageInfo.rgbByteLength = imageDesc!.rgbSliceByteLength;
                    imageInfo.alphaByteOffset = imageDesc!.alphaSliceByteOffset > 0 ? imageDesc!.rgbSliceByteLength : 0;
                    imageInfo.alphaByteLength = imageDesc!.alphaSliceByteLength;

                    result = transcoder.transcodeImage(targetFormat, encodedData, imageInfo, 0, isVideo);
                } else {
                    imageInfo.flags = 0;
                    imageInfo.rgbByteOffset = 0;
                    imageInfo.rgbByteLength = uncompressedByteLength;
                    imageInfo.alphaByteOffset = 0;
                    imageInfo.alphaByteLength = 0;

                    result = transcoder.transcodeImage(targetFormat, encodedData, imageInfo, 0, ktx2Reader.hasAlpha, isVideo);
                }
            } finally {
                if (transcoder) {
                    transcoder.delete();
                }

                if (imageInfo) {
                    imageInfo.delete();
                }

                if (result && result.transcodedImage) {
                    textureData = result.transcodedImage.get_typed_memory_view().slice();
                    result.transcodedImage.delete();
                }
            }

            return textureData;
        });
    }
}
