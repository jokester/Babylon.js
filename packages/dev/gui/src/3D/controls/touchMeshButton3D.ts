import { TransformNode } from "core/Meshes/transformNode";
import { AbstractMesh } from "core/Meshes/abstractMesh";
import { Mesh } from "core/Meshes/mesh";
import { Scene } from "core/scene";

import { TouchButton3D } from "./touchButton3D";

/**
 * Class used to create an interactable object. It's a touchable 3D button using a mesh coming from the current scene
 * @since 5.0.0
 */
export class TouchMeshButton3D extends TouchButton3D {
    /** @hidden */
    protected _currentMesh: Mesh;

    /**
     * Creates a new 3D button based on a mesh
     * @param mesh mesh to become a 3D button. By default this is also the mesh for near interaction collision checking
     * @param name defines the control name
     */
    constructor(mesh: Mesh, name?: string) {
        super(name, mesh);

        this._currentMesh = mesh;

        /**
         * Provides a default behavior on hover/out & up/down
         * Override those function to create your own desired behavior specific to your mesh
         */
        this.pointerEnterAnimation = () => {
            if (!this.mesh) {
                return;
            }
            this.mesh.scaling.scaleInPlace(1.1);
        };

        this.pointerOutAnimation = () => {
            if (!this.mesh) {
                return;
            }
            this.mesh.scaling.scaleInPlace(1.0 / 1.1);
        };

        this.pointerDownAnimation = () => {
            if (!this.mesh) {
                return;
            }
            this.mesh.scaling.scaleInPlace(0.95);
        };

        this.pointerUpAnimation = () => {
            if (!this.mesh) {
                return;
            }
            this.mesh.scaling.scaleInPlace(1.0 / 0.95);
        };
    }

    protected _getTypeName(): string {
        return "TouchMeshButton3D";
    }

    // Mesh association
    protected _createNode(scene: Scene): TransformNode {
        this._currentMesh.getChildMeshes().forEach((mesh) => {
            this._injectGUI3DReservedDataStore(mesh).control = this;
        });

        return this._currentMesh;
    }

    protected _affectMaterial(mesh: AbstractMesh) {}
}
