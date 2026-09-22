import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { main, readVmad } from './export-skyrim-scripts.mjs';

const u8 = n => Buffer.from([n]);
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const i16 = n => { const b = Buffer.alloc(2); b.writeInt16LE(n); return b; };
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const i32 = n => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const wstr = s => { const b = Buffer.from(s, 'latin1'); return Buffer.concat([u16(b.length), b]); };
const str = s => Buffer.from(s + '\0');
const field = (s, b) => { const h = Buffer.alloc(6); h.write(s); h.writeUInt16LE(b.length, 4); return Buffer.concat([h, b]); };
const record = (s, id, fields, flags = 0) => {
  let b = Buffer.concat(fields);
  if (flags & 0x40000) b = Buffer.concat([u32(b.length), zlib.deflateSync(b)]);
  const h = Buffer.alloc(24); h.write(s); h.writeUInt32LE(b.length, 4); h.writeUInt32LE(flags, 8); h.writeUInt32LE(id, 12);
  return Buffer.concat([h, b]);
};
const group = (s, content) => { const h = Buffer.alloc(24); h.write('GRUP'); h.writeUInt32LE(content.length + 24, 4); h.write(s, 8); return Buffer.concat([h, content]); };

// Format d'objet 2 : FormID puis alias. Format 1 : inutilisé, alias, puis FormID.
const object2 = id => Buffer.concat([u32(id), i16(-1), u16(0)]);
const object1 = id => Buffer.concat([u16(0), i16(-1), u32(id)]);
// Version 5 : un octet d'état suit le nom du script et le type de chaque propriété.
const vmad5 = Buffer.concat([
  i16(5), i16(2), u16(1),
  wstr('KzlCraftHandler'), u8(0), u16(5),
  wstr('Station'), u8(1), u8(1), object2(0x0aaa),
  wstr('Recettes'), u8(11), u8(1), u32(2), object2(0x0aaa), object2(0x0bbb),
  wstr('Nom'), u8(2), u8(1), wstr('Établi'),
  wstr('Cout'), u8(3), u8(1), i32(4),
  wstr('Actif'), u8(5), u8(1), u8(1)
]);
// Version 2 : aucun octet d'état, et l'ancien format d'objet.
const vmad2 = Buffer.concat([
  i16(2), i16(1), u16(1),
  wstr('KzlLegacy'), u16(1),
  wstr('Cible'), u8(1), object1(0x0aaa)
]);

const legacy = readVmad(vmad2);
assert.equal(legacy.objFormat, 1);
assert.equal(legacy.scripts[0].nom, 'KzlLegacy');
assert.equal(legacy.scripts[0].proprietes[0].valeur, '000AAA');
const moderne = readVmad(vmad5);
assert.equal(moderne.scripts[0].proprietes[2].valeur, 'Établi');
assert.deepEqual(moderne.scripts[0].proprietes[1].valeur, ['000AAA', '000BBB']);
assert.equal(moderne.reste, 0);
assert.throws(() => readVmad(vmad5.subarray(0, vmad5.length - 3)), /tronqué/);
assert.throws(() => readVmad(Buffer.concat([i16(9), i16(2), u16(0)])), /Version VMAD/);
assert.throws(() => readVmad(Buffer.concat([i16(5), i16(3), u16(0)])), /Format d'objet/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skyrim-scripts-test-'));
try {
  const data = path.join(root, 'Data'), out = path.join(root, 'export');
  fs.mkdirSync(data);
  const order = path.join(root, 'loadorder.txt');
  fs.writeFileSync(order, '# Test\nBase.esm\nPatch.esp\nLight.esp\n');
  fs.writeFileSync(path.join(data, 'Base.esm'), Buffer.concat([
    record('TES4', 0, []),
    group('ACTI', Buffer.concat([
      record('ACTI', 0x123, [field('EDID', str('KzlCraftBench')), field('VMAD', vmad5)]),
      record('ACTI', 0x124, [field('EDID', str('KzlOldBench')), field('VMAD', vmad2)])
    ])),
    group('MISC', record('MISC', 0xaaa, [field('EDID', str('KzlIngotIron'))]))
  ]));
  // Patch surcharge 0x124 sans VMAD : les scripts doivent être signalés comme retirés.
  fs.writeFileSync(path.join(data, 'Patch.esp'), Buffer.concat([
    record('TES4', 0, [field('MAST', str('Base.esm'))]),
    group('ACTI', Buffer.concat([
      record('ACTI', 0x124, [field('EDID', str('KzlOldBench'))]),
      record('ACTI', 0x01000001, [field('EDID', str('KzlPatchBench')), field('VMAD', vmad5)], 0x40000)
    ]))
  ]));
  // Plugin léger : il ne consomme pas de slot normal et s'adresse FE 000 yyy.
  fs.writeFileSync(path.join(data, 'Light.esp'), Buffer.concat([
    record('TES4', 0, [], 512),
    group('MISC', record('MISC', 0x123, [field('EDID', str('KzlLightItem'))]))
  ]));
  const snapshot = fs.readFileSync(path.join(data, 'Base.esm'));

  const report = main(data, order, out, '291, 0x01000001, 0xFE000123');
  assert.equal(report.enregistrements_scriptes, 2);
  assert.equal(report.attachements, 2);
  assert.equal(report.scripts_distincts, 1);
  assert.equal(report.scripts_retires, 1);

  const attaches = fs.readFileSync(path.join(out, 'scripts-attaches.csv'), 'utf8');
  assert.ok(attaches.includes('"base.esm|000123";"ACTI";"KzlCraftBench";"KzlCraftHandler"'));
  assert.ok(attaches.includes('"patch.esp|000001"'));
  assert.ok(!attaches.includes('KzlLegacy'));

  const proprietes = fs.readFileSync(path.join(out, 'proprietes-scripts.csv'), 'utf8');
  assert.ok(proprietes.includes('"KzlIngotIron [base.esm|000AAA]"'));
  assert.ok(proprietes.includes('"KzlIngotIron [base.esm|000AAA] ; base.esm|000BBB"'));
  assert.ok(proprietes.includes('"Établi"'));
  assert.ok(proprietes.includes('"objets[]"'));

  const index = fs.readFileSync(path.join(out, 'index-scripts.csv'), 'utf8');
  assert.ok(index.includes('"KzlCraftHandler";"2";"ACTI"'));
  assert.ok(index.includes('Actif ; Cout ; Nom ; Recettes ; Station'));

  const retires = fs.readFileSync(path.join(out, 'scripts-retires.csv'), 'utf8');
  assert.ok(retires.includes('"base.esm|000124";"KzlOldBench"'));

  const recherche = fs.readFileSync(path.join(out, 'recherche-formids.csv'), 'utf8');
  assert.ok(recherche.includes('"291";"0x123";"0";"Base.esm";"000123";"base.esm|000123";"KzlCraftBench";"KzlCraftHandler"'));
  assert.ok(recherche.includes('"1";"Patch.esp";"000001";"patch.esp|000001";"KzlPatchBench"'));
  assert.ok(recherche.includes('"FE 000";"Light.esp";"000123";"light.esp|000123";"KzlLightItem"'));

  assert.deepEqual(fs.readFileSync(path.join(data, 'Base.esm')), snapshot);
  assert.throws(() => main(data, order, path.join(data, 'export')), /extérieure/);
  fs.writeFileSync(order, 'Patch.esp\nBase.esm\nLight.esp\n');
  assert.throws(() => main(data, order, out), /Master absent/);
} finally {
  // Répertoire créé par ce test, sous os.tmpdir(), jamais une entrée utilisateur.
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert.ok(path.basename(root).startsWith('skyrim-scripts-test-'));
  fs.rmSync(root, { recursive: true, force: true });
}
console.log('Tests scripts Papyrus : OK');
