import { describe, expect, it } from 'vitest';
import { detectFromBytes } from '../detect';

const bytes = (...b: number[]) => new Uint8Array(b);

describe('format detection', () => {
  it('detects PNG by magic', () => {
    expect(detectFromBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'x.png')).toBe('png');
  });

  it('detects JPEG by magic', () => {
    expect(detectFromBytes(bytes(0xff, 0xd8, 0xff, 0xe0), 'photo.jpg')).toBe('jpeg');
  });

  it('detects PDF by magic', () => {
    expect(detectFromBytes(bytes(0x25, 0x50, 0x44, 0x46, 0x2d), 'doc.pdf')).toBe('pdf');
  });

  it('disambiguates a PK zip as DOCX by extension', () => {
    expect(detectFromBytes(bytes(0x50, 0x4b, 0x03, 0x04, 0, 0), 'report.docx')).toBe('docx');
  });

  it('keeps a plain PK zip as zip', () => {
    expect(detectFromBytes(bytes(0x50, 0x4b, 0x03, 0x04, 0, 0), 'bundle.zip')).toBe('zip');
  });

  it('detects WEBP via the RIFF container', () => {
    const b = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
    expect(detectFromBytes(b, 'image.webp')).toBe('webp');
  });

  it('falls back to extension when no magic matches', () => {
    expect(detectFromBytes(bytes(1, 2, 3, 4), 'data.csv')).toBe('csv');
  });

  it('sniffs SVG text without an extension', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectFromBytes(svg, 'noext')).toBe('svg');
  });
});
