/** MPEG-1/2 Layer III sample rates. */
const SAMPLE_RATES = [
  [44100, 48000, 32000],
  [22050, 24000, 16000],
  [11025, 12000, 8000],
] as const;

const BITRATES = [
  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
] as const;

function id3Size(bytes: Uint8Array): number {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  return 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
}

function frameAt(bytes: Uint8Array, offset: number) {
  if (offset + 4 > bytes.length) return null;
  if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) return null;
  const versionBits = (bytes[offset + 1] >> 3) & 3;
  const layer = (bytes[offset + 1] >> 1) & 3;
  if (versionBits === 1 || layer !== 1) return null;
  const version = versionBits === 3 ? 0 : versionBits === 2 ? 1 : 2;
  const bitrate = BITRATES[version === 0 ? 0 : 1][(bytes[offset + 2] >> 4) & 15];
  const rate = SAMPLE_RATES[version][(bytes[offset + 2] >> 2) & 3];
  const padding = (bytes[offset + 2] >> 1) & 1;
  if (!bitrate || !rate) return null;
  const samples = version === 0 ? 1152 : 576;
  const size = Math.floor((samples / 8) * ((bitrate * 1000) / rate)) + padding;
  return { version, rate, samples, size: Math.max(size, 4) };
}

function xingFrames(bytes: Uint8Array, offset: number, version: number): number {
  const channel = (bytes[offset + 3] >> 6) & 3;
  const side = version === 0 ? (channel === 3 ? 21 : 36) : channel === 3 ? 13 : 21;
  const tag = offset + 4 + side;
  if (tag + 8 > bytes.length) return 0;
  const name = String.fromCharCode(bytes[tag], bytes[tag + 1], bytes[tag + 2], bytes[tag + 3]);
  if (name !== 'Xing' && name !== 'Info') return 0;
  if ((bytes[tag + 7] & 1) === 0 || tag + 12 > bytes.length) return 0;
  return (bytes[tag + 8] << 24) | (bytes[tag + 9] << 16) | (bytes[tag + 10] << 8) | bytes[tag + 11];
}

/** Whole seconds of an mp3, or 0 if the buffer is not a readable MPEG stream. */
export function mp3DurationSeconds(buffer: ArrayBuffer): number {
  const bytes = new Uint8Array(buffer);
  let offset = id3Size(bytes);
  while (offset + 4 < bytes.length && !frameAt(bytes, offset)) offset += 1;
  const first = frameAt(bytes, offset);
  if (!first) return 0;

  const tagged = xingFrames(bytes, offset, first.version);
  if (tagged > 0) return Math.max(1, Math.round((tagged * first.samples) / first.rate));

  let frames = 0;
  let cursor = offset;
  while (cursor + 4 < bytes.length) {
    const frame = frameAt(bytes, cursor);
    if (!frame) {
      cursor += 1;
      continue;
    }
    frames += 1;
    cursor += frame.size;
    if (frames > 200_000) break;
  }
  return frames ? Math.max(1, Math.round((frames * first.samples) / first.rate)) : 0;
}
