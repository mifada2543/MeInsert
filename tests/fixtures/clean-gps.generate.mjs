/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
/**
 * Generator mandiri untuk clean-gps.jpg.
 *
 * Membuat JPEG baseline 8x8 yang sangat kecil sepenuhnya dengan Node (tanpa
 * ffmpeg, ImageMagick, jaringan, atau unduhan). APP1 berisi TIFF little-endian
 * dengan IFD0 (Artist, Software, OwnerName, Orientation), ExifIFD
 * (ImageUniqueID dan BodySerialNumber), dan GPS IFD asli (versi + referen +
 * nilai RATIONAL untuk lintang/bujur + altitude).
 * Semua byte deterministik, sehingga menjalankan ulang skrip menghasilkan file
 * yang identik.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('clean-gps.jpg', import.meta.url));

/* ---------- penulis nilai TIFF ---------- */

function entry(tag, type, values) {
  if (type === 1 || type === 3 || type === 4) {
    const size = type === 1 ? 1 : type === 3 ? 2 : 4;
    const list = Array.isArray(values) ? values : [values];
    const bytes = Buffer.alloc(size * list.length);
    list.forEach((value, index) => {
      if (size === 1) bytes[index] = value;
      else if (size === 2) bytes.writeUInt16LE(value, index * 2);
      else bytes.writeUInt32LE(value, index * 4);
    });
    return { tag, type, count: list.length, bytes };
  }
  if (type === 2) {
    const text = String(values);
    const bytes = Buffer.from(text.endsWith('\0') ? text : `${text}\0`, 'ascii');
    return { tag, type, count: bytes.length, bytes };
  }
  if (type === 5) {
    const list = Array.isArray(values[0]) ? values : [values];
    const bytes = Buffer.alloc(8 * list.length);
    list.forEach(([numerator, denominator], index) => {
      bytes.writeUInt32LE(numerator, index * 8);
      bytes.writeUInt32LE(denominator, index * 8 + 4);
    });
    return { tag, type, count: list.length, bytes };
  }
  throw new Error(`Tipe TIFF tidak didukung: ${type}`);
}

/** Kode Huffman kanonik JPEG, dipakai untuk menyusun bit scan yang valid. */
function huffmanCodes(bits, values) {
  const codes = new Map();
  let code = 0;
  let index = 0;
  for (let length = 1; length <= 16; length += 1) {
    for (let i = 0; i < bits[length - 1]; i += 1) {
      codes.set(values[index], { code, length });
      code += 1;
      index += 1;
    }
    code <<= 1;
  }
  return codes;
}

function huffmanBits(codes, symbol) {
  const { code, length } = codes.get(symbol);
  return code.toString(2).padStart(length, '0');
}

/* ---------- EXIF / TIFF ---------- */

const artist = entry(0x013b, 2, 'MeInsert fixture');
const software = entry(0x0131, 2, 'MeInsert generator');
const owner = entry(0xa430, 2, 'Fixture Owner');
const uniqueId = entry(0xa420, 2, 'MEINSERT-CLEAN-GPS-0001'); // ImageUniqueID
const serial = entry(0xa431, 2, 'MEINSERT-CLEAN-GPS-SN-0001'); // BodySerialNumber
const orientation = entry(0x0112, 3, 6); // handmade orientation tag

const gpsEntries = [
  entry(0x0000, 1, [2, 3, 0, 0]), // GPSVersionID
  entry(0x0001, 2, 'S'), // GPSLatitudeRef
  entry(0x0002, 5, [[6, 1], [12, 1], [34, 1]]), // GPSLatitude = 6°12'34"
  entry(0x0003, 2, 'E'), // GPSLongitudeRef
  entry(0x0004, 5, [[106, 1], [45, 1], [0, 1]]), // GPSLongitude = 106°45'00"
  entry(0x0005, 1, 0), // GPSAltitudeRef = above sea level
  entry(0x0006, 5, [12, 1]), // GPSAltitude = 12 m
];

function buildTiff() {
  const ifd0Entries = [artist, software, owner, orientation];
  const exifEntries = [uniqueId, serial]; // Keduanya tag ExifIFD, bukan IFD0.
  // +2 karena IFD0 juga memuat penunjuk ExifIFD dan GPS IFD.
  const ifd0Size = 2 + (ifd0Entries.length + 2) * 12 + 4;
  const exifOffset = 8 + ifd0Size;
  const exifSize = 2 + exifEntries.length * 12 + 4;
  const gpsOffset = exifOffset + exifSize;
  const gpsSize = 2 + gpsEntries.length * 12 + 4;
  const dataStart = gpsOffset + gpsSize;
  let cursor = dataStart;
  const chunks = [];
  function allocate(bytes) {
    const offset = cursor;
    cursor += bytes.length;
    if (cursor % 2) cursor += 1; // TIFF values start on a word boundary
    chunks.push({ offset, bytes });
    return offset;
  }
  function makeIfd(entries, nextOffset) {
    const ifd = Buffer.alloc(2 + entries.length * 12 + 4);
    ifd.writeUInt16LE(entries.length, 0);
    entries.forEach((item, index) => {
      const position = 2 + index * 12;
      ifd.writeUInt16LE(item.tag, position);
      ifd.writeUInt16LE(item.type, position + 2);
      ifd.writeUInt32LE(item.count, position + 4);
      if (item.bytes.length <= 4) {
        item.bytes.copy(ifd, position + 8);
      } else {
        ifd.writeUInt32LE(allocate(item.bytes), position + 8);
      }
    });
    ifd.writeUInt32LE(nextOffset, ifd.length - 4);
    return ifd;
  }

  const ifd0 = makeIfd([
    ...ifd0Entries,
    entry(0x8769, 4, exifOffset),
    entry(0x8825, 4, gpsOffset),
  ], 0);
  const exifIfd = makeIfd(exifEntries, 0);
  const gps = makeIfd(gpsEntries, 0);
  const data = Buffer.alloc(cursor - dataStart);
  for (const chunk of chunks) chunk.bytes.copy(data, chunk.offset - dataStart);
  const header = Buffer.alloc(8);
  header.write('II', 0, 'ascii');
  header.writeUInt16LE(42, 2);
  header.writeUInt32LE(8, 4);
  return Buffer.concat([header, ifd0, exifIfd, gps, data]);
}

/* ---------- JPEG baseline ---------- */

function segment(marker, payload) {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), length, payload]);
}

function buildJpeg() {
  const app0 = Buffer.concat([
    Buffer.from('JFIF\0', 'ascii'),
    Buffer.from([1, 1, 1]),
    Buffer.from([0, 1, 0, 1]), // X/Y density
    Buffer.from([0, 0]), // no thumbnail
  ]);
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), buildTiff()]);

  const quant = Buffer.alloc(65);
  quant[0] = 0; // 8-bit luminance table 0
  quant.fill(16, 1);

  const dcBits = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
  const dcValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const acBits = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
  const acValues = [
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
    0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
    0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
    0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
    0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa,
  ];
  const dcHuffman = Buffer.concat([Buffer.from([0x00]), Buffer.from(dcBits), Buffer.from(dcValues)]);
  const acHuffman = Buffer.concat([Buffer.from([0x10]), Buffer.from(acBits), Buffer.from(acValues)]);

  const frame = Buffer.concat([
    Buffer.from([8, 0, 8, 0, 8, 1, 1, 0x11, 0]), // 8x8, one luminance component
  ]);
  const scan = Buffer.concat([Buffer.from([1, 1, 0x00, 0, 63, 0])]);

  // One 8x8 block: DC difference 0 (luminance DC table symbol 0) followed by EOB
  // (luminance AC table symbol 0x00). Pad the final byte with 1 bits, per JPEG.
  const bits = `${huffmanBits(huffmanCodes(dcBits, dcValues), 0)}${huffmanBits(huffmanCodes(acBits, acValues), 0x00)}`;
  const entropy = Buffer.from([parseInt(bits.padEnd(8, '1'), 2)]);

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]), // SOI
    segment(0xe1, exif), // APP1 / Exif
    segment(0xe0, app0), // APP0 / JFIF
    segment(0xdb, quant), // DQT
    segment(0xc0, frame), // SOF0
    segment(0xc4, dcHuffman), // DHT (DC)
    segment(0xc4, acHuffman), // DHT (AC)
    segment(0xda, scan), // SOS
    entropy,
    Buffer.from([0xff, 0xd9]), // EOI
  ]);
}

const jpeg = buildJpeg();
if (jpeg.length > 10 * 1024) throw new Error(`Fixture terlalu besar: ${jpeg.length} byte`);
writeFileSync(out, jpeg);
console.log(`Wrote ${out} (${jpeg.length} bytes): EXIF GPSLatitude/GPSLongitude + refs, GPSAltitude, Artist, Software, OwnerName, ImageUniqueID, BodySerialNumber, Orientation=6.`);
