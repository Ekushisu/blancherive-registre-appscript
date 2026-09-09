import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { main, records, lz4Frame, stringTable } from './export-skyrim-objects.mjs';

const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const field = (s, b) => { const h = Buffer.alloc(6); h.write(s); h.writeUInt16LE(b.length, 4); return Buffer.concat([h,b]); };
const str = s => Buffer.from(s + '\0');
const record = (s, id, fields, flags = 0) => {
  let b = Buffer.concat(fields);
  if (flags & 0x40000) b = Buffer.concat([u32(b.length), zlib.deflateSync(b)]);
  const h = Buffer.alloc(24); h.write(s); h.writeUInt32LE(b.length, 4); h.writeUInt32LE(flags, 8); h.writeUInt32LE(id, 12);
  return Buffer.concat([h,b]);
};
const group = (s, content) => { const h = Buffer.alloc(24); h.write('GRUP'); h.writeUInt32LE(content.length + 24, 4); h.write(s, 8); return Buffer.concat([h,content]); };

// Référence LZ4 avec copie chevauchante : abc + répétition + cinq littéraux finaux.
const packed = Buffer.from([0x32, 97,98,99, 3,0, 0x50, 49,50,51,52,53]);
const frame = Buffer.concat([Buffer.from('04224d18604000', 'hex'), u32(packed.length), packed, u32(0)]);
assert.equal(lz4Frame(frame, 14).toString(), 'abcabcabc12345');
assert.throws(() => lz4Frame(frame, 13));
assert.throws(() => [...records(Buffer.alloc(23))]);
const strings = Buffer.concat([u32(1),u32(4),u32(7),u32(0),Buffer.from([0xC9,0x70,0xE9,0])]);
assert.equal(stringTable(strings).get(7), 'Épé');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skyrim-catalog-test-'));
try {
  const data = path.join(root, 'Data'), out = path.join(root, 'export');
  fs.mkdirSync(data);
  fs.mkdirSync(path.join(data, 'Strings'));
  const order = path.join(root, 'loadorder.txt');
  fs.writeFileSync(order, '# Test\nBase.esm\nOther.esm\nPatch.esp\n');
  fs.writeFileSync(path.join(data, 'Strings', 'Base_french.strings'), strings);
  fs.writeFileSync(path.join(data, 'Base.esm'), Buffer.concat([
    record('TES4',0,[],128), group('MISC', Buffer.concat([
      record('MISC',0x123,[field('FULL',u32(7)),field('EDID',str('Original'))]),
      record('MISC',0x124,[field('FULL',u32(7))])
    ]))
  ]));
  fs.writeFileSync(path.join(data, 'Other.esm'), Buffer.concat([
    record('TES4',0,[]), group('MISC',record('MISC',0x123,[field('FULL',str('Autre objet'))]))
  ]));
  // Base est ici le second master, pas l'index global 0 : vérifier la résolution locale.
  fs.writeFileSync(path.join(data, 'Patch.esp'), Buffer.concat([
    record('TES4',0,[field('MAST',str('Other.esm')),field('MAST',str('Base.esm'))]),
    group('MISC',Buffer.concat([
      record('MISC',0x01000123,[field('FULL',str('Nom final'))],0x40000),
      record('MISC',0x02000123,[field('FULL',str('Objet propre'))]),
      record('MISC',0x01000124,[],32)
    ]))
  ]));
  const snapshot = fs.readFileSync(path.join(data, 'Base.esm'));
  const report = main(data,order,out);
  assert.equal(report.total, 4);
  assert.equal(report.candidates, 3);
  assert.equal(report.exclusions['Supprimé par le plugin final'], 1);
  const csv = fs.readFileSync(path.join(out,'objets-candidats.csv'),'utf8');
  assert.ok(csv.includes('"base.esm|000123";"Nom final"'));
  assert.ok(csv.includes('"other.esm|000123";"Autre objet"'));
  assert.ok(csv.includes('"patch.esp|000123";"Objet propre"'));
  assert.deepEqual(fs.readFileSync(path.join(data, 'Base.esm')), snapshot);
  assert.throws(() => main(data,order,path.join(data,'export')), /extérieure/);
  fs.writeFileSync(order,'Patch.esp\nBase.esm\nOther.esm\n');
  assert.throws(() => main(data,order,out), /Master absent/);
} finally {
  // Répertoire créé par ce test, sous os.tmpdir(), jamais une entrée utilisateur.
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert.ok(path.basename(root).startsWith('skyrim-catalog-test-'));
  fs.rmSync(root,{recursive:true,force:true});
}
console.log('Tests extraction : OK');
