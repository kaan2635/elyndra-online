// Prints nodes, meshes, skins and animations of a glTF/GLB file.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f), root = doc.getRoot();
  console.log('==', f);
  console.log('meshes:', root.listMeshes().map(m => m.getName() + '(' + m.listPrimitives().reduce((a, p) => a + (p.getIndices()?.getCount() || 0) / 3, 0) + 't)').join(', '));
  console.log('materials:', root.listMaterials().map(m => m.getName()).join(', '), '| textures:', root.listTextures().map(t => t.getName() + ':' + t.getImage()?.byteLength).join(', '));
  console.log('skins:', root.listSkins().map(s => s.getName() + '[' + s.listJoints().length + ']').join(', '));
  const nodes = root.listNodes().filter(n => !n.getSkin() && !n.getMesh()).map(n => n.getName());
  if (process.env.NODES) console.log('nodes:', nodes.join(', '));
  console.log('mesh nodes:', root.listNodes().filter(n => n.getMesh()).map(n => n.getName() + (n.getSkin() ? '*' : '') + '<' + (n.getParentNode?.()?.getName() || '') ).join(', '));
  console.log('anims(' + root.listAnimations().length + '):', root.listAnimations().map(a => a.getName()).join(', '));
}
