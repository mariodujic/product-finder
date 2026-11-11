import { ProductDetail } from '../core/api.models';
import { lifecycleNotice } from '../features/product/product-detail.page';
import { shareLink } from './share';
import { statusView } from './status-tag';

describe('statusView', () => {
  it('always pairs colour with a text label', () => {
    expect(statusView('ACTIVE')).toMatchObject({ label: 'Active', severity: 'success' });
    expect(statusView('PHASE_OUT')).toMatchObject({ label: 'Phase-out', severity: 'warn' });
    expect(statusView('DISCONTINUED')).toMatchObject({ label: 'Discontinued', severity: 'danger' });
  });

  it('shows delisted products as no longer offered, whatever their status', () => {
    expect(statusView('ACTIVE', false).label).toBe('No longer offered');
  });
});

describe('lifecycleNotice', () => {
  const product = (overrides: Partial<ProductDetail>): ProductDetail => ({
    sku: 'P-1',
    name: 'A',
    chemicalName: 'B',
    function: 'F',
    applicationArea: 'Ar',
    region: 'EMEA',
    certifications: [],
    status: 'ACTIVE',
    launchYear: 2020,
    rating: { average: null, count: 0 },
    description: '',
    isListed: true,
    ...overrides,
  });

  it('shows nothing for an active product', () => {
    expect(lifecycleNotice(product({}))).toBeNull();
  });

  it('warns about phase-out and discontinued products', () => {
    expect(lifecycleNotice(product({ status: 'PHASE_OUT' }))?.severity).toBe('warn');
    expect(lifecycleNotice(product({ status: 'DISCONTINUED' }))?.text).toContain('discontinued');
  });

  it('explains products that left the catalogue', () => {
    expect(lifecycleNotice(product({ isListed: false }))?.text).toContain('no longer in our catalogue');
  });
});

describe('shareLink', () => {
  it('uses the native share sheet when available (phones)', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    const writeText = jest.fn();
    const outcome = await shareLink('T', 'https://x/p', { share, clipboard: { writeText } } as never);
    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'T', url: 'https://x/p' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies the link on desktop', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    const outcome = await shareLink('T', 'https://x/p', { clipboard: { writeText } } as never);
    expect(outcome).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://x/p');
  });

  it('treats a dismissed share sheet as cancelled, not as an error', async () => {
    const share = jest.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'));
    const outcome = await shareLink('T', 'u', { share, clipboard: { writeText: jest.fn() } } as never);
    expect(outcome).toBe('cancelled');
  });

  it('reports a failure when the clipboard is blocked', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    expect(await shareLink('T', 'u', { clipboard: { writeText } } as never)).toBe('failed');
  });
});
