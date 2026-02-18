import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');

describe('index.html OG tags', () => {
  it('has og:title', () => {
    expect(html).toContain('property="og:title"');
    expect(html).toMatch(/og:title.*Daybreak/);
  });

  it('has og:description', () => {
    expect(html).toContain('property="og:description"');
  });

  it('has og:image', () => {
    expect(html).toContain('property="og:image"');
    expect(html).toMatch(/og:image.*daybreak-logo\.png/);
  });

  it('has og:url', () => {
    expect(html).toContain('property="og:url"');
    expect(html).toMatch(/og:url.*daybreakscan\.com/);
  });

  it('has og:type', () => {
    expect(html).toContain('property="og:type"');
  });

  it('has twitter:card', () => {
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('summary_large_image');
  });

  it('has twitter:title', () => {
    expect(html).toContain('name="twitter:title"');
  });

  it('has twitter:description', () => {
    expect(html).toContain('name="twitter:description"');
  });

  it('has twitter:image', () => {
    expect(html).toContain('name="twitter:image"');
    expect(html).toMatch(/twitter:image.*daybreak-logo\.png/);
  });

  it('has canonical URL', () => {
    expect(html).toContain('rel="canonical"');
    expect(html).toMatch(/canonical.*daybreakscan\.com/);
  });

  it('does not reference EVM migration', () => {
    const lower = html.toLowerCase();
    expect(lower).not.toContain('evm');
    expect(lower).not.toContain('migration');
    expect(lower).not.toContain('wormhole');
  });
});
