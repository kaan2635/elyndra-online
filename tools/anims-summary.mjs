import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f), r = doc.getRoot();
  const tris = r.listMeshes().reduce((a, m) => a + m.listPrimitives().reduce((b, p) => b + (p.getIndices()?.getCount() || p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  console.log(f.split('/').pop().padEnd(18), String(fs.statSync(f).size >> 10).padStart(5) + 'K', String(tris | 0).padStart(6) + 't', 'tex:' + r.listTextures().length, 'mat:' + r.listMaterials().length, 'joints:' + (r.listSkins()[0]?.listJoints().length || 0), '|', r.listAnimations().map(a => a.getName().replace(/^.*\|/, '')).join(','));
}
