'use strict';
/* File type detection (by content, not by name) and HTTP Range parsing. */

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const NOT_VIDEO_BRANDS = ['heic', 'heix', 'hevc', 'mif1', 'msf1', 'avif', 'avis'];

function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(PNG_SIG)) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (buf.toString('ascii', 4, 8) === 'ftyp') {
    return NOT_VIDEO_BRANDS.includes(buf.toString('ascii', 8, 12)) ? null : 'video/mp4';
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
  return null;
}

const MB = 1024 * 1024;
const LIMITS = {
  'image/jpeg': 8 * MB,
  'image/png': 8 * MB,
  'image/webp': 8 * MB,
  'image/gif': 8 * MB,
  'video/mp4': 40 * MB,
  'video/webm': 40 * MB,
};

/*
 * Returns null (send the whole file), 'invalid' (send 416) or {start, end}
 * with an inclusive end, for a header such as "bytes=0-1023".
 */
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m) return null;
  let start;
  let end;
  if (m[1] === '') {
    if (m[2] === '') return null;
    const suffix = Number(m[2]);
    if (suffix === 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (size === 0 || start > end || start >= size) return 'invalid';
  return { start, end };
}

module.exports = { sniff, LIMITS, parseRange };
