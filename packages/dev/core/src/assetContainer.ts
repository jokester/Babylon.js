import { AbstractScene } from "./abstractScene";
import { Scene } from "./scene";
import { Mesh } from "./Meshes/mesh";
import { TransformNode } from "./Meshes/transformNode";
import { Skeleton } from "./Bones/skeleton";
import { AnimationGroup } from "./Animations/animationGroup";
import { Animatable } from "./Animations/animatable";
import { AbstractMesh } from "./Meshes/abstractMesh";
import { MultiMaterial } from "./Materials/multiMaterial";
import { Material } from "./Materials/material";
import { Logger } from "./Misc/logger";
import { EngineStore } from "./Engines/engineStore";
import { Nullable } from "./types";
import { Node } from "./node";
import { Observer } from "./Misc/observable";
import { ThinEngine } from "./Engines/thinEngine";

/**
 * Set of assets to keep when moving a scene into an asset container.
 */
export class KeepAssets extends AbstractScene {}

/**
 * Class used to store the output of the AssetContainer.instantiateAllMeshesToScene function
 */
export class InstantiatedEntries {
    /**
     * List of new root nodes (eg. nodes with no parent)
     */
    public rootNodes: TransformNode[] = [];

    /**
     * List of new skeletons
     */
    public skeletons: Skeleton[] = [];

    /**
     * List of new animation groups
     */
    public animationGroups: AnimationGroup[] = [];
}

/**
 * Container with a set of assets that can be added or removed from a scene.
 */
export class AssetContainer extends AbstractScene {
    private _wasAddedToScene = false;
    private _onContextRestoredObserver: Nullable<Observer<ThinEngine>>;

    /**
     * The scene the AssetContainer belongs to.
     */
    public scene: Scene;

    /**
     * Instantiates an AssetContainer.
     * @param scene The scene the AssetContainer belongs to.
     */
    constructor(scene?: Nullable<Scene>) {
        super();
        scene = scene || EngineStore.LastCreatedScene;
        if (!scene) {
            return;
        }
        this.scene = scene;
        this["sounds"] = [];
        this["effectLayers"] = [];
        this["layers"] = [];
        this["lensFlareSystems"] = [];
        this["proceduralTextures"] = [];
        this["reflectionProbes"] = [];

        scene.onDisposeObservable.add(() => {
            if (!this._wasAddedToScene) {
                this.dispose();
            }
        });

        this._onContextRestoredObserver = scene.getEngine().onContextRestoredObservable.add(() => {
            for (const geometry of this.geometries) {
                geometry._rebuild();
            }

            for (const mesh of this.meshes) {
                mesh._rebuild();
            }

            for (const system of this.particleSystems) {
                system.rebuild();
            }

            for (const texture of this.textures) {
                texture._rebuild();
            }
        });
    }

    /**
     * Instantiate or clone all meshes and add the new ones to the scene.
     * Skeletons and animation groups will all be cloned
     * @param nameFunction defines an optional function used to get new names for clones
     * @param cloneMaterials defines an optional boolean that defines if materials must be cloned as well (false by default)
     * @param options defines an optional list of options to control how to instantiate / clone models
     * @param options.doNotInstantiate
     * @returns a list of rootNodes, skeletons and animation groups that were duplicated
     */
    public instantiateModelsToScene(nameFunction?: (sourceName: string) => string, cloneMaterials = false, options?: { doNotInstantiate: boolean }): InstantiatedEntries {
        const convertionMap: { [key: number]: number } = {};
        const storeMap: { [key: number]: any } = {};
        const result = new InstantiatedEntries();
        const alreadySwappedSkeletons: Skeleton[] = [];
        const alreadySwappedMaterials: Material[] = [];

        if (!options) {
            options = {
                doNotInstantiate: true,
            };
        }

        const onClone = (source: TransformNode, clone: TransformNode) => {
            convertionMap[source.uniqueId] = clone.uniqueId;
            storeMap[clone.uniqueId] = clone;

            if (nameFunction) {
                clone.name = nameFunction(source.name);
            }

            if (clone instanceof Mesh) {
                const clonedMesh = clone as Mesh;

                if (clonedMesh.morphTargetManager) {
                    const oldMorphTargetManager = (source as Mesh).morphTargetManager!;
                    clonedMesh.morphTargetManager = oldMorphTargetManager.clone();

                    for (let index = 0; index < oldMorphTargetManager.numTargets; index++) {
                        const oldTarget = oldMorphTargetManager.getTarget(index);
                        const newTarget = clonedMesh.morphTargetManager.getTarget(index);

                        convertionMap[oldTarget.uniqueId] = newTarget.uniqueId;
                        storeMap[newTarget.uniqueId] = newTarget;
                    }
                }
            }
        };

        this.transformNodes.forEach((o) => {
            if (!o.parent) {
                const newOne = o.instantiateHierarchy(null, options, (source, clone) => {
                    onClone(source, clone);
                });

                if (newOne) {
                    result.rootNodes.push(newOne);
                }
            }
        });

        this.meshes.forEach((o) => {
            if (!o.parent) {
                const newOne = o.instantiateHierarchy(null, options, (source, clone) => {
                    onClone(source, clone);

                    if ((clone as any).material) {
                        const mesh = clone as AbstractMesh;

                        if (mesh.material) {
                            if (cloneMaterials) {
                                const sourceMaterial = (source as AbstractMesh).material!;

                                if (alreadySwappedMaterials.indexOf(sourceMaterial) === -1) {
                                    let swap = sourceMaterial.clone(nameFunction ? nameFunction(sourceMaterial.name) : "Clone of " + sourceMaterial.name)!;
                                    alreadySwappedMaterials.push(sourceMaterial);
                                    convertionMap[sourceMaterial.uniqueId] = swap.uniqueId;
                                    storeMap[swap.uniqueId] = swap;

                                    if (sourceMaterial.getClassName() === "MultiMaterial") {
                                        const multi = sourceMaterial as MultiMaterial;

                                        for (const material of multi.subMaterials) {
                                            if (!material) {
                                                continue;
                                            }
                                            swap = material.clone(nameFunction ? nameFunction(material.name) : "Clone of " + material.name)!;
                                            alreadySwappedMaterials.push(material);
                                            convertionMap[material.uniqueId] = swap.uniqueId;
                                            storeMap[swap.uniqueId] = swap;
                                        }

                                        multi.subMaterials = multi.subMaterials.map((m) => m && storeMap[convertionMap[m.uniqueId]]);
                                    }
                                }

                                if (mesh.getClassName() !== "InstancedMesh") {
                                    mesh.material = storeMap[convertionMap[sourceMaterial.uniqueId]];
                                }
                            } else {
                                if (mesh.material.getClassName() === "MultiMaterial") {
                                    if (this.scene.multiMaterials.indexOf(mesh.material as MultiMaterial) === -1) {
                                        this.scene.addMultiMaterial(mesh.material as MultiMaterial);
                                    }
                                } else {
                                    if (this.scene.materials.indexOf(mesh.material) === -1) {
                                        this.scene.addMaterial(mesh.material);
                                    }
                                }
                            }
                        }
                    }
                });

                if (newOne) {
                    result.rootNodes.push(newOne);
                }
            }
        });

        this.skeletons.forEach((s) => {
            const clone = s.clone(nameFunction ? nameFunction(s.name) : "Clone of " + s.name);

            for (const m of this.meshes) {
                if (m.skeleton === s && !m.isAnInstance) {
                    const copy = storeMap[convertionMap[m.uniqueId]] as Mesh;
                    if (copy.isAnInstance) {
                        continue;
                    }
                    copy.skeleton = clone;

                    if (alreadySwappedSkeletons.indexOf(clone) !== -1) {
                        continue;
                    }

                    alreadySwappedSkeletons.push(clone);

                    // Check if bones are mesh linked
                    for (const bone of clone.bones) {
                        if (bone._linkedTransformNode) {
                            bone._linkedTransformNode = storeMap[convertionMap[bone._linkedTransformNode.uniqueId]];
                        }
                    }
                }
            }

            result.skeletons.push(clone);
        });

        this.animationGroups.forEach((o) => {
            const clone = o.clone(nameFunction ? nameFunction(o.name) : "Clone of " + o.name, (oldTarget) => {
                const newTarget = storeMap[convertionMap[oldTarget.uniqueId]];

                return newTarget || oldTarget;
            });

            result.animationGroups.push(clone);
        });

        return result;
    }

    /**
     * Adds all the assets from the container to the scene.
     */
    public addAllToScene() {
        if (this._wasAddedToScene) {
            return;
        }

        this._wasAddedToScene = true;

        this.cameras.forEach((o) => {
            this.scene.addCamera(o);
        });
        this.lights.forEach((o) => {
            this.scene.addLight(o);
        });
        this.meshes.forEach((o) => {
            this.scene.addMesh(o);
        });
        this.skeletons.forEach((o) => {
            this.scene.addSkeleton(o);
        });
        this.animations.forEach((o) => {
            this.scene.addAnimation(o);
        });
        this.animationGroups.forEach((o) => {
            this.scene.addAnimationGroup(o);
        });
        this.multiMaterials.forEach((o) => {
            this.scene.addMultiMaterial(o);
        });
        this.materials.forEach((o) => {
            this.scene.addMaterial(o);
        });
        this.morphTargetManagers.forEach((o) => {
            this.scene.addMorphTargetManager(o);
        });
        this.geometries.forEach((o) => {
            this.scene.addGeometry(o);
        });
        this.transformNodes.forEach((o) => {
            this.scene.addTransformNode(o);
        });
        this.actionManagers.forEach((o) => {
            this.scene.addActionManager(o);
        });
        this.textures.forEach((o) => {
            this.scene.addTexture(o);
        });
        this.reflectionProbes.forEach((o) => {
            this.scene.addReflectionProbe(o);
        });

        if (this.environmentTexture) {
            this.scene.environmentTexture = this.environmentTexture;
        }

        for (const component of this.scene._serializableComponents) {
            component.addFromContainer(this);
        }

        this.scene.getEngine().onContextRestoredObservable.remove(this._onContextRestoredObserver);
        this._onContextRestoredObserver = null;
    }

    /**
     * Removes all the assets in the container from the scene
     */
    public removeAllFromScene() {
        this._wasAddedToScene = false;

        this.cameras.forEach((o) => {
            this.scene.removeCamera(o);
        });
        this.lights.forEach((o) => {
            this.scene.removeLight(o);
        });
        this.meshes.forEach((o) => {
            this.scene.removeMesh(o);
        });
        this.skeletons.forEach((o) => {
            this.scene.removeSkeleton(o);
        });
        this.animations.forEach((o) => {
            this.scene.removeAnimation(o);
        });
        this.animationGroups.forEach((o) => {
            this.scene.removeAnimationGroup(o);
        });
        this.multiMaterials.forEach((o) => {
            this.scene.removeMultiMaterial(o);
        });
        this.materials.forEach((o) => {
            this.scene.removeMaterial(o);
        });
        this.morphTargetManagers.forEach((o) => {
            this.scene.removeMorphTargetManager(o);
        });
        this.geometries.forEach((o) => {
            this.scene.removeGeometry(o);
        });
        this.transformNodes.forEach((o) => {
            this.scene.removeTransformNode(o);
        });
        this.actionManagers.forEach((o) => {
            this.scene.removeActionManager(o);
        });
        this.textures.forEach((o) => {
            this.scene.removeTexture(o);
        });
        this.reflectionProbes.forEach((o) => {
            this.scene.removeReflectionProbe(o);
        });

        if (this.environmentTexture === this.scene.environmentTexture) {
            this.scene.environmentTexture = null;
        }

        for (const component of this.scene._serializableComponents) {
            component.removeFromContainer(this);
        }
    }

    /**
     * Disposes all the assets in the container
     */
    public dispose() {
        this.cameras.slice(0).forEach((o) => {
            o.dispose();
        });
        this.cameras = [];

        this.lights.slice(0).forEach((o) => {
            o.dispose();
        });
        this.lights = [];

        this.meshes.slice(0).forEach((o) => {
            o.dispose();
        });
        this.meshes = [];

        this.skeletons.slice(0).forEach((o) => {
            o.dispose();
        });
        this.skeletons = [];

        this.animationGroups.slice(0).forEach((o) => {
            o.dispose();
        });
        this.animationGroups = [];

        this.multiMaterials.slice(0).forEach((o) => {
            o.dispose();
        });
        this.multiMaterials = [];

        this.materials.slice(0).forEach((o) => {
            o.dispose();
        });
        this.materials = [];

        this.geometries.slice(0).forEach((o) => {
            o.dispose();
        });
        this.geometries = [];

        this.transformNodes.slice(0).forEach((o) => {
            o.dispose();
        });
        this.transformNodes = [];

        this.actionManagers.slice(0).forEach((o) => {
            o.dispose();
        });
        this.actionManagers = [];

        this.textures.slice(0).forEach((o) => {
            o.dispose();
        });
        this.textures = [];

        this.reflectionProbes.slice(0).forEach((o) => {
            o.dispose();
        });
        this.reflectionProbes = [];

        if (this.environmentTexture) {
            this.environmentTexture.dispose();
            this.environmentTexture = null;
        }

        for (const component of this.scene._serializableComponents) {
            component.removeFromContainer(this, true);
        }

        if (this._onContextRestoredObserver) {
            this.scene.getEngine().onContextRestoredObservable.remove(this._onContextRestoredObserver);
            this._onContextRestoredObserver = null;
        }
    }

    private _moveAssets<T>(sourceAssets: T[], targetAssets: T[], keepAssets: T[]): void {
        if (!sourceAssets) {
            return;
        }

        for (const asset of sourceAssets) {
            let move = true;
            if (keepAssets) {
                for (const keepAsset of keepAssets) {
                    if (asset === keepAsset) {
                        move = false;
                        break;
                    }
                }
            }

            if (move) {
                targetAssets.push(asset);
                (asset as any)._parentContainer = this;
            }
        }
    }

    /**
     * Removes all the assets contained in the scene and adds them to the container.
     * @param keepAssets Set of assets to keep in the scene. (default: empty)
     */
    public moveAllFromScene(keepAssets?: KeepAssets): void {
        this._wasAddedToScene = false;

        if (keepAssets === undefined) {
            keepAssets = new KeepAssets();
        }

        for (const key in this) {
            if (this.hasOwnProperty(key)) {
                (<any>this)[key] = (<any>this)[key] || (key === "environmentTexture" ? null : []);
                this._moveAssets((<any>this.scene)[key], (<any>this)[key], (<any>keepAssets)[key]);
            }
        }

        this.environmentTexture = this.scene.environmentTexture;

        this.removeAllFromScene();
    }

    /**
     * Adds all meshes in the asset container to a root mesh that can be used to position all the contained meshes. The root mesh is then added to the front of the meshes in the assetContainer.
     * @returns the root mesh
     */
    public createRootMesh() {
        const rootMesh = new Mesh("assetContainerRootMesh", this.scene);
        this.meshes.forEach((m) => {
            if (!m.parent) {
                rootMesh.addChild(m);
            }
        });
        this.meshes.unshift(rootMesh);
        return rootMesh;
    }

    /**
     * Merge animations (direct and animation groups) from this asset container into a scene
     * @param scene is the instance of BABYLON.Scene to append to (default: last created scene)
     * @param animatables set of animatables to retarget to a node from the scene
     * @param targetConverter defines a function used to convert animation targets from the asset container to the scene (default: search node by name)
     * @returns an array of the new AnimationGroup added to the scene (empty array if none)
     */
    public mergeAnimationsTo(
        scene: Nullable<Scene> = EngineStore.LastCreatedScene,
        animatables: Animatable[],
        targetConverter: Nullable<(target: any) => Nullable<Node>> = null
    ): AnimationGroup[] {
        if (!scene) {
            Logger.Error("No scene available to merge animations to");
            return [];
        }

        const _targetConverter = targetConverter
            ? targetConverter
            : (target: any) => {
                  let node = null;

                  const targetProperty = target.animations.length ? target.animations[0].targetProperty : "";
                  /*
                BabylonJS adds special naming to targets that are children of nodes.
                This name attempts to remove that special naming to get the parent nodes name in case the target
                can't be found in the node tree

                Ex: Torso_primitive0 likely points to a Mesh primitive. We take away primitive0 and are left with "Torso" which is the name
                of the primitive's parent.
            */
                  const name = target.name.split(".").join("").split("_primitive")[0];

                  switch (targetProperty) {
                      case "position":
                      case "rotationQuaternion":
                          node = scene.getTransformNodeByName(target.name) || scene.getTransformNodeByName(name);
                          break;
                      case "influence":
                          node = scene.getMorphTargetByName(target.name) || scene.getMorphTargetByName(name);
                          break;
                      default:
                          node = scene.getNodeByName(target.name) || scene.getNodeByName(name);
                  }

                  return node;
              };

        // Copy new node animations
        const nodesInAC = this.getNodes();
        nodesInAC.forEach((nodeInAC) => {
            const nodeInScene = _targetConverter(nodeInAC);
            if (nodeInScene !== null) {
                // Remove old animations with same target property as a new one
                for (const animationInAC of nodeInAC.animations) {
                    // Doing treatment on an array for safety measure
                    const animationsWithSameProperty = nodeInScene.animations.filter((animationInScene) => {
                        return animationInScene.targetProperty === animationInAC.targetProperty;
                    });
                    for (const animationWithSameProperty of animationsWithSameProperty) {
                        const index = nodeInScene.animations.indexOf(animationWithSameProperty, 0);
                        if (index > -1) {
                            nodeInScene.animations.splice(index, 1);
                        }
                    }
                }

                // Append new animations
                nodeInScene.animations = nodeInScene.animations.concat(nodeInAC.animations);
            }
        });

        const newAnimationGroups = new Array<AnimationGroup>();

        // Copy new animation groups
        this.animationGroups.slice().forEach((animationGroupInAC) => {
            // Clone the animation group and all its animatables
            newAnimationGroups.push(animationGroupInAC.clone(animationGroupInAC.name, _targetConverter));

            // Remove animatables related to the asset container
            animationGroupInAC.animatables.forEach((animatable) => {
                animatable.stop();
            });
        });

        // Retarget animatables
        animatables.forEach((animatable) => {
            const target = _targetConverter(animatable.target);

            if (target) {
                // Clone the animatable and retarget it
                scene.beginAnimation(
                    target,
                    animatable.fromFrame,
                    animatable.toFrame,
                    animatable.loopAnimation,
                    animatable.speedRatio,
                    animatable.onAnimationEnd ? animatable.onAnimationEnd : undefined,
                    undefined,
                    true,
                    undefined,
                    animatable.onAnimationLoop ? animatable.onAnimationLoop : undefined
                );

                // Stop animation for the target in the asset container
                scene.stopAnimation(animatable.target);
            }
        });

        return newAnimationGroups;
    }
}
