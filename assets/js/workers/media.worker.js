/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — AGPLv3 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
import { runWorker } from './rpc.js';
import mp3 from '../formats/mp3.js';
import flac from '../formats/flac.js';
import ogg from '../formats/ogg.js';
import mkv from '../formats/mkv.js';
runWorker({ mp3, flac, ogg, mkv });
