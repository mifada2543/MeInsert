import { fields, sections, readVorbis, writeVorbis } from './vorbis-common.js';

export const meta = {
  id: 'ogg',
  engine: 'media',
  label: 'OGG / Opus',
  description: 'Audio Vorbis / Opus dalam container Ogg',
  extensions: ['ogg', 'oga', 'opus'],
  mime: 'audio/ogg',
  cover: true,
};

export { fields, sections };

export const read = (file) => readVorbis(file);
export const write = (file, payload, options, report) => writeVorbis(file, payload, options, report, {
  label: 'OGG / Opus',
  mime: 'audio/ogg',
  defaultExt: 'ogg',
  // Ogg packets start with a small negative (pre-roll) timestamp; allow the
  // shift needed to copy them into a non-negative Ogg container.
  copy: { shiftTolerance: Infinity },
  formatClass: 'OggOutputFormat',
});

export default { meta, sections, fields, read, write };
