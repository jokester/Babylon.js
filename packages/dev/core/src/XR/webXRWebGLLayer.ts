import { RenderTargetTexture } from "../Materials/Textures/renderTargetTexture";
import { Viewport } from "../Maths/math.viewport";
import { Scene } from "../scene";
import { Nullable } from "../types";
import { WebXRLayerWrapper } from "./webXRLayerWrapper";
import { WebXRLayerRenderTargetTextureProvider } from "./webXRRenderTargetTextureProvider";

/**
 * Wraps xr webgl layers.
 * @hidden
 */
export class WebXRWebGLLayerWrapper extends WebXRLayerWrapper {
    /**
     * @param layer is the layer to be wrapped.
     * @returns a new WebXRLayerWrapper wrapping the provided XRWebGLLayer.
     */
    constructor(public readonly layer: XRWebGLLayer) {
        super(
            () => layer.framebufferWidth,
            () => layer.framebufferHeight,
            layer,
            "XRWebGLLayer",
            (sessionManager) => new WebXRWebGLLayerRenderTargetTextureProvider(sessionManager.scene, this)
        );
    }
}

/**
 * Provides render target textures and other important rendering information for a given XRWebGLLayer.
 * @hidden
 */
export class WebXRWebGLLayerRenderTargetTextureProvider extends WebXRLayerRenderTargetTextureProvider {
    // The dimensions will always be defined in this class.
    protected _framebufferDimensions: { framebufferWidth: number; framebufferHeight: number };
    private _rtt: Nullable<RenderTargetTexture>;
    private _framebuffer: WebGLFramebuffer;
    private _layer: XRWebGLLayer;

    constructor(scene: Scene, public readonly layerWrapper: WebXRWebGLLayerWrapper) {
        super(scene, layerWrapper);
        this._layer = layerWrapper.layer;
        this._framebufferDimensions = {
            framebufferWidth: this._layer.framebufferWidth,
            framebufferHeight: this._layer.framebufferHeight,
        };
    }

    public trySetViewportForView(viewport: Viewport, view: XRView): boolean {
        const xrViewport = this._layer.getViewport(view);
        const framebufferWidth = this._framebufferDimensions.framebufferWidth;
        const framebufferHeight = this._framebufferDimensions.framebufferHeight;
        viewport.x = xrViewport.x / framebufferWidth;
        viewport.y = xrViewport.y / framebufferHeight;
        viewport.width = xrViewport.width / framebufferWidth;
        viewport.height = xrViewport.height / framebufferHeight;
        return true;
    }

    public getRenderTargetTextureForEye(eye: XREye): Nullable<RenderTargetTexture> {
        const layerWidth = this._layer.framebufferWidth;
        const layerHeight = this._layer.framebufferHeight;
        const framebuffer = this._layer.framebuffer;

        if (
            !this._rtt ||
            layerWidth !== this._framebufferDimensions.framebufferWidth ||
            layerHeight !== this._framebufferDimensions.framebufferHeight ||
            framebuffer !== this._framebuffer
        ) {
            this._rtt = this._createRenderTargetTexture(layerWidth, layerHeight, framebuffer);
            this._framebufferDimensions.framebufferWidth = layerWidth;
            this._framebufferDimensions.framebufferHeight = layerHeight;
            this._framebuffer = framebuffer;
        }

        return this._rtt;
    }

    public getRenderTargetTextureForView(view: XRView): Nullable<RenderTargetTexture> {
        return this.getRenderTargetTextureForEye(view.eye);
    }
}
