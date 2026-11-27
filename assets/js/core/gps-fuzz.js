/* MeInsert — Edit metadata file tanpa upload, 100% di browser. */
/* Copyright (C) 2026 mifada2543 — MeInsert Source-Available License v1.0 (see LICENSE) — Source: https://github.com/mifada2543/meinsert */
/* reference build: MeInsert TWVJbnNlcnQ6bWlmYWRhMjU0MzoyMDI2 */
export const GPS_RADII = [1000, 5000, 10000];
const EARTH_RADIUS = 6371008.8;
const degrees = Math.PI / 180;
function exifCoordinate(value) {
  const hundredthsOfArcSecond = 360000;
  const quantized = Math.round(value * hundredthsOfArcSecond) / hundredthsOfArcSecond;
  return String(Number(quantized.toFixed(6)));
}

export function fuzzCoordinates(latitude, longitude, radius) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !GPS_RADII.includes(radius)) {
    throw new RangeError('Invalid coordinates or radius');
  }
  const random = crypto.getRandomValues(new Uint32Array(2));
  // Sample uniformly by area within the disk. Nonzero sampling avoids a zero-distance draw.
  const distance = (radius - 0.5) * Math.sqrt((random[0] + 0.5) / 2 ** 32) / EARTH_RADIUS;
  const heading = 2 * Math.PI * random[1] / 2 ** 32;
  const lat = latitude * degrees;
  const lon = longitude * degrees;
  const latitude2 = Math.asin(Math.max(-1, Math.min(1,
    Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(heading))));
  const longitude2 = lon + Math.atan2(Math.sin(heading) * Math.sin(distance) * Math.cos(lat),
    Math.cos(distance) - Math.sin(lat) * Math.sin(latitude2));
  return {
    gpsLatitude: exifCoordinate(latitude2 / degrees),
    gpsLongitude: exifCoordinate(((longitude2 / degrees + 540) % 360) - 180),
  };
}

export function canFuzzGps(detection, readResult) {
  const { gpsLatitude, gpsLongitude } = readResult?.fields || {};
  return detection?.id === 'image' && detection?.subtype === 'jpeg'
    && [gpsLatitude, gpsLongitude].every((value) => value != null && String(value).trim() && Number.isFinite(Number(value)));
}

export function gpsFuzzPatch(readResult, radius) {
  const { gpsLatitude, gpsLongitude } = readResult.fields;
  const fields = fuzzCoordinates(Number(gpsLatitude), Number(gpsLongitude), radius);
  // Use the EXIF coordinate pair. Clear legacy copies, destinations and auxiliary GPS details.
  const canonicalPair = /^GPS:GPS(?:(?:Latitude|Longitude)(?:Ref)?|VersionID)$/i;
  const otherGps = /^(?:GPS:|(?:XMP[-\w.]*|EXIF|ExifIFD):GPS)/i;
  const rawRemove = [...new Set((readResult.raw || []).map(({ tag }) => tag)
    .filter((tag) => otherGps.test(tag) && !canonicalPair.test(tag)))];
  return { fields: { ...fields, gpsAltitude: null, gpsDate: null }, rawRemove };
}
