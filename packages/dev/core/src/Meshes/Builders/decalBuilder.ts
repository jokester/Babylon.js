import { Nullable, IndicesArray } from "../../types";
import { Vector3, Matrix, Vector2 } from "../../Maths/math.vector";
import { Mesh, _CreationDataStorage } from "../mesh";
import { VertexBuffer } from "../../Buffers/buffer";
import { VertexData } from "../mesh.vertexData";
import { AbstractMesh } from "../abstractMesh";
import { Camera } from "../../Cameras/camera";
import { PositionNormalTextureVertex } from "../../Maths/math.vertexFormat";
import { CompatibilityOptions } from "../../Compat/compatibilityOptions";

/**
 * Creates a decal mesh.
 * A decal is a mesh usually applied as a model onto the surface of another mesh. So don't forget the parameter `sourceMesh` depicting the decal
 * * The parameter `position` (Vector3, default `(0, 0, 0)`) sets the position of the decal in World coordinates
 * * The parameter `normal` (Vector3, default `Vector3.Up`) sets the normal of the mesh where the decal is applied onto in World coordinates
 * * The parameter `size` (Vector3, default `(1, 1, 1)`) sets the decal scaling
 * * The parameter `angle` (float in radian, default 0) sets the angle to rotate the decal
 * * The parameter `captureUVS` defines if we need to capture the uvs or compute them
 * @param name defines the name of the mesh
 * @param sourceMesh defines the mesh where the decal must be applied
 * @param options defines the options used to create the mesh
 * @param scene defines the hosting scene
 * @param options.position
 * @param options.normal
 * @param options.size
 * @param options.angle
 * @param options.captureUVS
 * @returns the decal mesh
 * @see https://doc.babylonjs.com/how_to/decals
 */
export function CreateDecal(name: string, sourceMesh: AbstractMesh, options: { position?: Vector3; normal?: Vector3; size?: Vector3; angle?: number; captureUVS?: boolean }): Mesh {
    const indices = <IndicesArray>sourceMesh.getIndices();
    const positions = sourceMesh.getVerticesData(VertexBuffer.PositionKind);
    const normals = sourceMesh.getVerticesData(VertexBuffer.NormalKind);
    const uvs = sourceMesh.getVerticesData(VertexBuffer.UVKind);
    const position = options.position || Vector3.Zero();
    let normal = options.normal || Vector3.Up();
    const size = options.size || Vector3.One();
    const angle = options.angle || 0;

    // Getting correct rotation
    if (!normal) {
        const target = new Vector3(0, 0, 1);
        const camera = <Camera>sourceMesh.getScene().activeCamera;
        const cameraWorldTarget = Vector3.TransformCoordinates(target, camera.getWorldMatrix());

        normal = camera.globalPosition.subtract(cameraWorldTarget);
    }

    const yaw = -Math.atan2(normal.z, normal.x) - Math.PI / 2;
    const len = Math.sqrt(normal.x * normal.x + normal.z * normal.z);
    const pitch = Math.atan2(normal.y, len);

    // Matrix
    const decalWorldMatrix = Matrix.RotationYawPitchRoll(yaw, pitch, angle).multiply(Matrix.Translation(position.x, position.y, position.z));
    const inverseDecalWorldMatrix = Matrix.Invert(decalWorldMatrix);
    const meshWorldMatrix = sourceMesh.getWorldMatrix();
    const transformMatrix = meshWorldMatrix.multiply(inverseDecalWorldMatrix);

    const vertexData = new VertexData();
    vertexData.indices = [];
    vertexData.positions = [];
    vertexData.normals = [];
    vertexData.uvs = [];

    let currentVertexDataIndex = 0;

    const extractDecalVector3 = (indexId: number): PositionNormalTextureVertex => {
        const result = new PositionNormalTextureVertex();
        if (!indices || !positions || !normals) {
            return result;
        }

        const vertexId = indices[indexId];
        result.position = new Vector3(positions[vertexId * 3], positions[vertexId * 3 + 1], positions[vertexId * 3 + 2]);

        // Send vector to decal local world
        result.position = Vector3.TransformCoordinates(result.position, transformMatrix);

        // Get normal
        result.normal = new Vector3(normals[vertexId * 3], normals[vertexId * 3 + 1], normals[vertexId * 3 + 2]);
        result.normal = Vector3.TransformNormal(result.normal, transformMatrix);

        if (options.captureUVS && uvs) {
            const v = uvs[vertexId * 2 + 1];
            result.uv = new Vector2(uvs[vertexId * 2], CompatibilityOptions.UseOpenGLOrientationForUV ? 1 - v : v);
        }

        return result;
    }; // Inspired by https://github.com/mrdoob/three.js/blob/eee231960882f6f3b6113405f524956145148146/examples/js/geometries/DecalGeometry.js
    const clip = (vertices: PositionNormalTextureVertex[], axis: Vector3): PositionNormalTextureVertex[] => {
        if (vertices.length === 0) {
            return vertices;
        }

        const clipSize = 0.5 * Math.abs(Vector3.Dot(size, axis));

        const clipVertices = (v0: PositionNormalTextureVertex, v1: PositionNormalTextureVertex): PositionNormalTextureVertex => {
            const clipFactor = Vector3.GetClipFactor(v0.position, v1.position, axis, clipSize);

            return new PositionNormalTextureVertex(Vector3.Lerp(v0.position, v1.position, clipFactor), Vector3.Lerp(v0.normal, v1.normal, clipFactor));
        };
        const result = new Array<PositionNormalTextureVertex>();

        for (let index = 0; index < vertices.length; index += 3) {
            var v1Out: boolean;
            var v2Out: boolean;
            var v3Out: boolean;
            let total = 0;
            let nV1: Nullable<PositionNormalTextureVertex> = null;
            let nV2: Nullable<PositionNormalTextureVertex> = null;
            let nV3: Nullable<PositionNormalTextureVertex> = null;
            let nV4: Nullable<PositionNormalTextureVertex> = null;

            const d1 = Vector3.Dot(vertices[index].position, axis) - clipSize;
            const d2 = Vector3.Dot(vertices[index + 1].position, axis) - clipSize;
            const d3 = Vector3.Dot(vertices[index + 2].position, axis) - clipSize;

            v1Out = d1 > 0;
            v2Out = d2 > 0;
            v3Out = d3 > 0;

            total = (v1Out ? 1 : 0) + (v2Out ? 1 : 0) + (v3Out ? 1 : 0);

            switch (total) {
                case 0:
                    result.push(vertices[index]);
                    result.push(vertices[index + 1]);
                    result.push(vertices[index + 2]);
                    break;
                case 1:
                    if (v1Out) {
                        nV1 = vertices[index + 1];
                        nV2 = vertices[index + 2];
                        nV3 = clipVertices(vertices[index], nV1);
                        nV4 = clipVertices(vertices[index], nV2);
                    }

                    if (v2Out) {
                        nV1 = vertices[index];
                        nV2 = vertices[index + 2];
                        nV3 = clipVertices(vertices[index + 1], nV1);
                        nV4 = clipVertices(vertices[index + 1], nV2);

                        result.push(nV3);
                        result.push(nV2.clone());
                        result.push(nV1.clone());

                        result.push(nV2.clone());
                        result.push(nV3.clone());
                        result.push(nV4);
                        break;
                    }
                    if (v3Out) {
                        nV1 = vertices[index];
                        nV2 = vertices[index + 1];
                        nV3 = clipVertices(vertices[index + 2], nV1);
                        nV4 = clipVertices(vertices[index + 2], nV2);
                    }

                    if (nV1 && nV2 && nV3 && nV4) {
                        result.push(nV1.clone());
                        result.push(nV2.clone());
                        result.push(nV3);

                        result.push(nV4);
                        result.push(nV3.clone());
                        result.push(nV2.clone());
                    }
                    break;
                case 2:
                    if (!v1Out) {
                        nV1 = vertices[index].clone();
                        nV2 = clipVertices(nV1, vertices[index + 1]);
                        nV3 = clipVertices(nV1, vertices[index + 2]);
                        result.push(nV1);
                        result.push(nV2);
                        result.push(nV3);
                    }
                    if (!v2Out) {
                        nV1 = vertices[index + 1].clone();
                        nV2 = clipVertices(nV1, vertices[index + 2]);
                        nV3 = clipVertices(nV1, vertices[index]);
                        result.push(nV1);
                        result.push(nV2);
                        result.push(nV3);
                    }
                    if (!v3Out) {
                        nV1 = vertices[index + 2].clone();
                        nV2 = clipVertices(nV1, vertices[index]);
                        nV3 = clipVertices(nV1, vertices[index + 1]);
                        result.push(nV1);
                        result.push(nV2);
                        result.push(nV3);
                    }
                    break;
                case 3:
                    break;
            }
        }

        return result;
    };
    for (let index = 0; index < indices.length; index += 3) {
        let faceVertices = new Array<PositionNormalTextureVertex>();

        faceVertices.push(extractDecalVector3(index));
        faceVertices.push(extractDecalVector3(index + 1));
        faceVertices.push(extractDecalVector3(index + 2));

        // Clip
        faceVertices = clip(faceVertices, new Vector3(1, 0, 0));
        faceVertices = clip(faceVertices, new Vector3(-1, 0, 0));
        faceVertices = clip(faceVertices, new Vector3(0, 1, 0));
        faceVertices = clip(faceVertices, new Vector3(0, -1, 0));
        faceVertices = clip(faceVertices, new Vector3(0, 0, 1));
        faceVertices = clip(faceVertices, new Vector3(0, 0, -1));

        if (faceVertices.length === 0) {
            continue;
        }

        // Add UVs and get back to world
        for (let vIndex = 0; vIndex < faceVertices.length; vIndex++) {
            const vertex = faceVertices[vIndex];

            //TODO check for Int32Array | Uint32Array | Uint16Array
            (<number[]>vertexData.indices).push(currentVertexDataIndex);
            vertex.position.toArray(vertexData.positions, currentVertexDataIndex * 3);
            vertex.normal.toArray(vertexData.normals, currentVertexDataIndex * 3);

            if (!options.captureUVS) {
                (<number[]>vertexData.uvs).push(0.5 + vertex.position.x / size.x);
                const v = 0.5 + vertex.position.y / size.y;
                (<number[]>vertexData.uvs).push(CompatibilityOptions.UseOpenGLOrientationForUV ? 1 - v : v);
            } else {
                vertex.uv.toArray(vertexData.uvs, currentVertexDataIndex * 2);
            }
            currentVertexDataIndex++;
        }
    }

    // Return mesh
    const decal = new Mesh(name, sourceMesh.getScene());
    vertexData.applyToMesh(decal);

    decal.position = position.clone();
    decal.rotation = new Vector3(pitch, yaw, angle);

    return decal;
}

/**
 * Class containing static functions to help procedurally build meshes
 * @deprecated use the function directly from the module
 */
export const DecalBuilder = {
    CreateDecal,
};

(Mesh as any).CreateDecal = (name: string, sourceMesh: AbstractMesh, position: Vector3, normal: Vector3, size: Vector3, angle: number): Mesh => {
    const options = {
        position,
        normal,
        size,
        angle,
    };

    return CreateDecal(name, sourceMesh, options);
};
