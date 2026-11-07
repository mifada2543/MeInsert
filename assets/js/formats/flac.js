/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { fields, sections, readVorbis, writeVorbis } from './vorbis-common.js';
export const meta = {
  id: 'flac',
  engine: 'media',
  label: 'FLAC',
  description: 'Audio lossless dengan Vorbis comment',
  extensions: ['flac'],
  mime: 'audio/flac',
  cover: true,
};
export { fields, sections };
export const read = (file) => readVorbis(file);
export const write = (file, payload, options, report) => writeVorbis(file, payload, options, report, {
  label: 'FLAC',
  mime: 'audio/flac',
  defaultExt: 'flac',
  copy: {},
  formatClass: 'FlacOutputFormat',
});
export default { meta, sections, fields, read, write };
