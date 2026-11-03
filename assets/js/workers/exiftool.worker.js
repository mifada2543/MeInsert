import { runWorker } from './rpc.js';
import image from '../formats/image.js';
import mp4 from '../formats/mp4.js';

runWorker({ image, mp4 });
