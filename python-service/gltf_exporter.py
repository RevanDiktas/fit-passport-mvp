"""
Export SMPL meshes to glTF/GLB format for web rendering
"""
import numpy as np
import trimesh
from pathlib import Path
from typing import Optional

from config import EXPORT_FORMAT, OUTPUT_DIR


class GLTFExporter:
    """Export meshes to glTF format"""

    @staticmethod
    def export_mesh(
        vertices: np.ndarray,
        faces: np.ndarray,
        output_path: Optional[Path] = None,
        add_material: bool = True,
    ) -> bytes:
        """
        Export mesh to glTF/GLB format

        Args:
            vertices: (N, 3) vertex array in meters
            faces: (M, 3) face indices
            output_path: Optional path to save file
            add_material: Add default material

        Returns:
            Binary glTF/GLB data
        """
        # Create trimesh object
        mesh = trimesh.Trimesh(
            vertices=vertices,
            faces=faces,
            process=False,  # Don't modify the mesh
        )

        # Add default material for better rendering
        if add_material:
            mesh.visual = trimesh.visual.ColorVisuals(
                mesh=mesh,
                vertex_colors=np.array([200, 200, 200, 255]),  # Light gray
            )

        # Compute normals for smooth shading
        mesh.vertex_normals

        # Export to glTF/GLB
        if EXPORT_FORMAT == "glb":
            export_data = mesh.export(file_type="glb")
        else:
            export_data = mesh.export(file_type="gltf")

        # Save to file if path provided
        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(export_data)
            print(f"Exported mesh to {output_path}")

        return export_data

    @staticmethod
    def export_with_texture(
        vertices: np.ndarray,
        faces: np.ndarray,
        uv_coords: Optional[np.ndarray] = None,
        texture_path: Optional[Path] = None,
        output_path: Optional[Path] = None,
    ) -> bytes:
        """
        Export mesh with UV mapping and texture

        Args:
            vertices: (N, 3) vertex array
            faces: (M, 3) face indices
            uv_coords: (N, 2) UV coordinates
            texture_path: Path to texture image
            output_path: Optional output path

        Returns:
            Binary glTF/GLB data
        """
        mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)

        # Add UV coordinates and texture if provided
        if uv_coords is not None and texture_path is not None:
            from PIL import Image

            texture_image = Image.open(texture_path)

            # Create TextureVisuals
            material = trimesh.visual.material.SimpleMaterial(
                image=texture_image,
                diffuse=[255, 255, 255, 255],
            )

            mesh.visual = trimesh.visual.TextureVisuals(
                uv=uv_coords,
                material=material,
            )

        # Export
        if EXPORT_FORMAT == "glb":
            export_data = mesh.export(file_type="glb")
        else:
            export_data = mesh.export(file_type="gltf")

        if output_path:
            with open(output_path, "wb") as f:
                f.write(export_data)

        return export_data

    @staticmethod
    def generate_default_uv(vertices: np.ndarray, faces: np.ndarray) -> np.ndarray:
        """
        Generate simple UV coordinates using spherical mapping

        Args:
            vertices: (N, 3) vertex array
            faces: (M, 3) face indices

        Returns:
            (N, 2) UV coordinates
        """
        # Normalize vertices to unit sphere
        centroid = vertices.mean(axis=0)
        centered = vertices - centroid
        norms = np.linalg.norm(centered, axis=1, keepdims=True)
        norms[norms == 0] = 1  # Avoid division by zero
        normalized = centered / norms

        # Spherical coordinates
        u = 0.5 + np.arctan2(normalized[:, 2], normalized[:, 0]) / (2 * np.pi)
        v = 0.5 + np.arcsin(np.clip(normalized[:, 1], -1, 1)) / np.pi

        uv = np.stack([u, v], axis=1)
        return uv


def test_exporter():
    """Test glTF export with a simple mesh"""
    print("Testing glTF Exporter...")

    # Create simple cube
    vertices = np.array([
        [-0.5, -0.5, -0.5],
        [0.5, -0.5, -0.5],
        [0.5, 0.5, -0.5],
        [-0.5, 0.5, -0.5],
        [-0.5, -0.5, 0.5],
        [0.5, -0.5, 0.5],
        [0.5, 0.5, 0.5],
        [-0.5, 0.5, 0.5],
    ])

    faces = np.array([
        [0, 1, 2], [0, 2, 3],  # Front
        [4, 6, 5], [4, 7, 6],  # Back
        [0, 4, 5], [0, 5, 1],  # Bottom
        [2, 6, 7], [2, 7, 3],  # Top
        [0, 3, 7], [0, 7, 4],  # Left
        [1, 5, 6], [1, 6, 2],  # Right
    ])

    try:
        exporter = GLTFExporter()
        output_path = OUTPUT_DIR / "test_cube.glb"
        export_data = exporter.export_mesh(
            vertices, faces, output_path=output_path
        )

        print(f"Export successful!")
        print(f"  Output size: {len(export_data)} bytes")
        print(f"  Saved to: {output_path}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False


if __name__ == "__main__":
    test_exporter()
