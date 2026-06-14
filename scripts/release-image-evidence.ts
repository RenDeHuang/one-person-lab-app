import fs from 'node:fs';
import path from 'node:path';

export type ImageEvidencePolicy = {
  minimum_file_size_bytes: number;
  minimum_width_px: number;
  minimum_height_px: number;
};

type Dimensions = {
  width: number;
  height: number;
};

function isJpegSofMarker(marker: number) {
  return (
    (marker >= 0xc0 && marker <= 0xc3)
    || (marker >= 0xc5 && marker <= 0xc7)
    || (marker >= 0xc9 && marker <= 0xcb)
    || (marker >= 0xcd && marker <= 0xcf)
  );
}

function readUInt24LE(bytes: Buffer, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function webpDimensions(bytes: Buffer): Dimensions | null {
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
    return null;
  }
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunkType = bytes.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const nextOffset = dataOffset + chunkSize + (chunkSize % 2);
    if (dataOffset + chunkSize > bytes.length) {
      return null;
    }
    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        width: readUInt24LE(bytes, dataOffset + 4) + 1,
        height: readUInt24LE(bytes, dataOffset + 7) + 1,
      };
    }
    if (chunkType === 'VP8L' && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      return {
        width: 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8),
        height: 1 + ((bytes[dataOffset + 2] & 0xc0) >> 6) + (bytes[dataOffset + 3] << 2) + ((bytes[dataOffset + 4] & 0x0f) << 10),
      };
    }
    if (
      chunkType === 'VP8 '
      && chunkSize >= 10
      && bytes[dataOffset + 3] === 0x9d
      && bytes[dataOffset + 4] === 0x01
      && bytes[dataOffset + 5] === 0x2a
    ) {
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }
    offset = nextOffset;
  }
  return null;
}

function imageDimensions(filePath: string, header: Buffer): Dimensions | null {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') {
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    const bytes = fs.readFileSync(filePath);
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = bytes.readUInt16BE(offset + 2);
      if (isJpegSofMarker(marker)) {
        return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  if (extension === '.webp') {
    return webpDimensions(fs.readFileSync(filePath));
  }
  return null;
}

export function assertImageEvidenceFile(filePath: string, label: string, policy: ImageEvidencePolicy) {
  const stat = fs.statSync(filePath);
  if (stat.size < policy.minimum_file_size_bytes) {
    throw new Error(`${label} must be a real screenshot, not a placeholder image: ${filePath}`);
  }
  if (!/\.(png|jpg|jpeg|webp)$/i.test(filePath)) {
    throw new Error(`${label} must be a screenshot image file: ${filePath}`);
  }
  const header = fs.readFileSync(filePath).subarray(0, 24);
  const extension = path.extname(filePath).toLowerCase();
  const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const isWebp = header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
  if ((extension === '.png' && !isPng) || (['.jpg', '.jpeg'].includes(extension) && !isJpeg) || (extension === '.webp' && !isWebp)) {
    throw new Error(`${label} must contain real screenshot image bytes: ${filePath}`);
  }
  const dimensions = imageDimensions(filePath, header);
  if (!dimensions) {
    throw new Error(`${label} dimensions must be readable screenshot evidence: ${filePath}`);
  }
  if (dimensions.width < policy.minimum_width_px || dimensions.height < policy.minimum_height_px) {
    throw new Error(`${label} must be at least ${policy.minimum_width_px}x${policy.minimum_height_px}px screenshot evidence: ${filePath}`);
  }
}
