import { runWorker } from './rpc.js';
import mp3 from '../formats/mp3.js';
import flac from '../formats/flac.js';
import ogg from '../formats/ogg.js';
import mkv from '../formats/mkv.js';

runWorker({ mp3, flac, ogg, mkv });
