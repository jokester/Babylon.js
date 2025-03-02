import { Nullable } from "core/types";
import { Matrix } from "core/Maths/math.vector";
import { Tools } from "core/Misc/tools";
import { StandardMaterial } from "core/Materials/standardMaterial";
import { Geometry } from "core/Meshes/geometry";
import { Mesh } from "core/Meshes/mesh";

/**
 * Class for generating OBJ data from a Babylon scene.
 */
export class OBJExport {
    /**
     * Exports the geometry of a Mesh array in .OBJ file format (text)
     * @param mesh defines the list of meshes to serialize
     * @param materials defines if materials should be exported
     * @param matlibname defines the name of the associated mtl file
     * @param globalposition defines if the exported positions are globals or local to the exported mesh
     * @returns the OBJ content
     */
    public static OBJ(mesh: Mesh[], materials?: boolean, matlibname?: string, globalposition?: boolean): string {
        const output: string[] = [];
        let v = 1;
        // keep track of uv index in case mixed meshes are passed in
        let textureV = 1;

        if (materials) {
            if (!matlibname) {
                matlibname = "mat";
            }
            output.push("mtllib " + matlibname + ".mtl");
        }
        for (let j = 0; j < mesh.length; j++) {
            output.push("g object" + j);
            output.push("o object_" + j);

            //Uses the position of the item in the scene, to the file (this back to normal in the end)
            let inverseTransform: Nullable<Matrix> = null;
            if (globalposition) {
                const transform = mesh[j].computeWorldMatrix(true);
                inverseTransform = new Matrix();
                transform.invertToRef(inverseTransform);

                mesh[j].bakeTransformIntoVertices(transform);
            }

            //TODO: submeshes (groups)
            //TODO: smoothing groups (s 1, s off);
            if (materials) {
                const mat = mesh[j].material;

                if (mat) {
                    output.push("usemtl " + mat.id);
                }
            }
            const g: Nullable<Geometry> = mesh[j].geometry;

            if (!g) {
                Tools.Warn("No geometry is present on the mesh");
                continue;
            }

            const trunkVerts = g.getVerticesData("position");
            const trunkNormals = g.getVerticesData("normal");
            const trunkUV = g.getVerticesData("uv");
            const trunkFaces = g.getIndices();
            let currentV = 0;
            let currentTextureV = 0;

            if (!trunkVerts || !trunkFaces) {
                Tools.Warn("There are no position vertices or indices on the mesh!");
                continue;
            }

            for (var i = 0; i < trunkVerts.length; i += 3) {
                // Babylon.js default is left handed, while OBJ default is right handed
                // Need to invert Z vertices unless Babylon is set to use a right handed system
                if (mesh[0].getScene().useRightHandedSystem) {
                    output.push("v " + trunkVerts[i] + " " + trunkVerts[i + 1] + " " + trunkVerts[i + 2]);
                } else {
                    output.push("v " + trunkVerts[i] + " " + trunkVerts[i + 1] + " " + -trunkVerts[i + 2]);
                }
                currentV++;
            }

            if (trunkNormals != null) {
                for (i = 0; i < trunkNormals.length; i += 3) {
                    output.push("vn " + trunkNormals[i] + " " + trunkNormals[i + 1] + " " + trunkNormals[i + 2]);
                }
            }
            if (trunkUV != null) {
                for (i = 0; i < trunkUV.length; i += 2) {
                    output.push("vt " + trunkUV[i] + " " + trunkUV[i + 1]);
                    currentTextureV++;
                }
            }

            for (i = 0; i < trunkFaces.length; i += 3) {
                const indices = [String(trunkFaces[i + 2] + v), String(trunkFaces[i + 1] + v), String(trunkFaces[i] + v)];
                const textureIndices = [String(trunkFaces[i + 2] + textureV), String(trunkFaces[i + 1] + textureV), String(trunkFaces[i] + textureV)];
                const blanks: string[] = ["", "", ""];

                const facePositions = indices;
                const faceUVs = trunkUV != null ? textureIndices : blanks;
                const faceNormals = trunkNormals != null ? indices : blanks;

                output.push(
                    "f " +
                        facePositions[0] +
                        "/" +
                        faceUVs[0] +
                        "/" +
                        faceNormals[0] +
                        " " +
                        facePositions[1] +
                        "/" +
                        faceUVs[1] +
                        "/" +
                        faceNormals[1] +
                        " " +
                        facePositions[2] +
                        "/" +
                        faceUVs[2] +
                        "/" +
                        faceNormals[2]
                );
            }
            //back de previous matrix, to not change the original mesh in the scene
            if (globalposition && inverseTransform) {
                mesh[j].bakeTransformIntoVertices(inverseTransform);
            }
            v += currentV;
            textureV += currentTextureV;
        }
        const text: string = output.join("\n");
        return text;
    }

    /**
     * Exports the material(s) of a mesh in .MTL file format (text)
     * @param mesh defines the mesh to extract the material from
     * @returns the mtl content
     */
    //TODO: Export the materials of mesh array
    public static MTL(mesh: Mesh): string {
        const output = [];
        const m = <StandardMaterial>mesh.material;
        output.push("newmtl mat1");
        output.push("  Ns " + m.specularPower.toFixed(4));
        output.push("  Ni 1.5000");
        output.push("  d " + m.alpha.toFixed(4));
        output.push("  Tr 0.0000");
        output.push("  Tf 1.0000 1.0000 1.0000");
        output.push("  illum 2");
        output.push("  Ka " + m.ambientColor.r.toFixed(4) + " " + m.ambientColor.g.toFixed(4) + " " + m.ambientColor.b.toFixed(4));
        output.push("  Kd " + m.diffuseColor.r.toFixed(4) + " " + m.diffuseColor.g.toFixed(4) + " " + m.diffuseColor.b.toFixed(4));
        output.push("  Ks " + m.specularColor.r.toFixed(4) + " " + m.specularColor.g.toFixed(4) + " " + m.specularColor.b.toFixed(4));
        output.push("  Ke " + m.emissiveColor.r.toFixed(4) + " " + m.emissiveColor.g.toFixed(4) + " " + m.emissiveColor.b.toFixed(4));

        //TODO: uv scale, offset, wrap
        //TODO: UV mirrored in Blender? second UV channel? lightMap? reflection textures?
        const uvscale = "";

        if (m.ambientTexture) {
            output.push("  map_Ka " + uvscale + m.ambientTexture.name);
        }

        if (m.diffuseTexture) {
            output.push("  map_Kd " + uvscale + m.diffuseTexture.name);
            //TODO: alpha testing, opacity in diffuse texture alpha channel (diffuseTexture.hasAlpha -> map_d)
        }

        if (m.specularTexture) {
            output.push("  map_Ks " + uvscale + m.specularTexture.name);
            /* TODO: glossiness = specular highlight component is in alpha channel of specularTexture. (???)
            if (m.useGlossinessFromSpecularMapAlpha)  {
                output.push("  map_Ns "+uvscale + m.specularTexture.name);
            }
            */
        }

        /* TODO: emissive texture not in .MAT format (???)
        if (m.emissiveTexture) {
            output.push("  map_d "+uvscale+m.emissiveTexture.name);
        }
        */

        if (m.bumpTexture) {
            output.push("  map_bump -imfchan z " + uvscale + m.bumpTexture.name);
        }

        if (m.opacityTexture) {
            output.push("  map_d " + uvscale + m.opacityTexture.name);
        }

        const text = output.join("\n");
        return text;
    }
}
