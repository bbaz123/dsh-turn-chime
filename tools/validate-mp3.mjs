import fs from 'node:fs';

const BITRATES = {
  '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
};
const SR = { 3: [44100, 48000, 32000, 0] }; // MPEG1

const buf = fs.readFileSync(process.argv[2]);
console.log('bytes =', buf.length);

let off = 0;
let frames = 0;
let firstHdr = null;
let bad = 0;
const samplesPerFrame = 1152;
let totalSamples = 0;
const bitrateSeen = new Set();
const srSeen = new Set();

while (off + 4 <= buf.length) {
  if (buf[off] !== 0xff || (buf[off + 1] & 0xe0) !== 0xe0) {
    bad++;
    off++;
    continue;
  }
  const b1 = buf[off + 1];
  const b2 = buf[off + 2];
  const versionBits = (b1 >> 3) & 0x03; // 3 = MPEG1
  const layerBits = (b1 >> 1) & 0x03;   // 1 = Layer III
  const bitrateIdx = (b2 >> 4) & 0x0f;
  const srIdx = (b2 >> 2) & 0x03;
  const padding = (b2 >> 1) & 0x01;

  if (versionBits !== 3 || layerBits !== 1 || bitrateIdx === 0 || bitrateIdx === 15 || srIdx === 3) {
    bad++;
    off++;
    continue;
  }

  const kbps = BITRATES['1-3'][bitrateIdx];
  const sr = SR[3][srIdx];
  const frameLen = Math.floor((144 * kbps * 1000) / sr) + padding;

  if (!firstHdr) {
    firstHdr = { kbps, sr, frameLen, padding, headerHex: buf.subarray(off, off + 4).toString('hex') };
  }
  bitrateSeen.add(kbps);
  srSeen.add(sr);
  totalSamples += samplesPerFrame;
  frames++;
  off += frameLen;
}

console.log('frames =', frames, 'badBytes =', bad);
console.log('firstHeader =', JSON.stringify(firstHdr));
console.log('bitrates =', [...bitrateSeen].join(','), ' sampleRates =', [...srSeen].join(','));
console.log('duration_s =', (totalSamples / (firstHdr ? firstHdr.sr : 44100)).toFixed(3));
console.log('endOffset =', off, ' fileBytes =', buf.length, ' trailingBytes =', buf.length - off);
console.log('last16 =', buf.subarray(Math.max(0, buf.length - 16)).toString('hex'));
