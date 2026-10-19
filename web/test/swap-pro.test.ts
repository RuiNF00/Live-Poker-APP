import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const hasPro = vi.fn<(id: string) => Promise<boolean>>();
vi.mock('../src/lib/revenuecat', () => ({ hasPro: (id: string) => hasPro(id) }));
vi.mock('../src/lib/swaps', () => ({ swapStore: () => ({ ownerRc: async () => 'rc-1' }) }));
vi.mock('../src/lib/swap-groups', () => ({ groupStore: () => ({ ownerRc: async () => null }) }));

const { creatorPro, groupCreatorPro, rcUserIdOf, swapCreatorPro } = await import('../src/lib/swap-pro');

describe('creatorPro', () => {
  beforeEach(() => hasPro.mockReset());

  it('follows the creator’s Pro', async () => {
    hasPro.mockResolvedValue(true);
    expect(await swapCreatorPro('abc123')).toBe(true);
    expect(hasPro).toHaveBeenCalledWith('rc-1');
    hasPro.mockResolvedValue(false);
    expect(await swapCreatorPro('abc123')).toBe(false);
  });

  it('is closed without an id, on an error or when RevenueCat is slow', async () => {
    expect(await groupCreatorPro('abc123')).toBe(false);
    expect(hasPro).not.toHaveBeenCalled();
    expect(await creatorPro(async () => { throw new Error('db'); })).toBe(false);
    hasPro.mockRejectedValue(new Error('rc'));
    expect(await creatorPro(async () => 'rc-1')).toBe(false);
    hasPro.mockImplementation(() => new Promise((r) => setTimeout(() => r(true), 200)));
    expect(await creatorPro(async () => 'rc-1', 20)).toBe(false);
  });
});

describe('rcUserIdOf', () => {
  it('takes 1 to 100 characters of text only', () => {
    expect(rcUserIdOf('$RCAnonymousID:abc')).toBe('$RCAnonymousID:abc');
    expect(rcUserIdOf('')).toBeNull();
    expect(rcUserIdOf('x'.repeat(101))).toBeNull();
    expect(rcUserIdOf(42)).toBeNull();
  });
});
