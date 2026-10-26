import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const RC = '$RCAnonymousID:0123456789abcdef0123456789abcdef';
const hasPro = vi.fn<(id: string) => Promise<boolean>>();
vi.mock('../src/lib/revenuecat', () => ({ hasPro: (id: string) => hasPro(id) }));
vi.mock('../src/lib/swaps', () => ({ swapStore: () => ({ ownerRc: async () => RC }) }));
vi.mock('../src/lib/swap-groups', () => ({ groupStore: () => ({ ownerRc: async () => null }) }));

const { creatorPro, groupCreatorPro, rcUserIdOf, swapCreatorPro } = await import('../src/lib/swap-pro');

describe('creatorPro', () => {
  beforeEach(() => hasPro.mockReset());

  it('follows the creator’s Pro', async () => {
    hasPro.mockResolvedValue(true);
    expect(await swapCreatorPro('abc123')).toBe(true);
    expect(hasPro).toHaveBeenCalledWith(RC);
    hasPro.mockResolvedValue(false);
    expect(await swapCreatorPro('abc123')).toBe(false);
  });

  it('is closed without an id, on an error or when RevenueCat is slow', async () => {
    expect(await groupCreatorPro('abc123')).toBe(false);
    expect(hasPro).not.toHaveBeenCalled();
    expect(await creatorPro(async () => { throw new Error('db'); })).toBe(false);
    hasPro.mockRejectedValue(new Error('rc'));
    expect(await creatorPro(async () => RC)).toBe(false);
    hasPro.mockImplementation(() => new Promise((r) => setTimeout(() => r(true), 200)));
    expect(await creatorPro(async () => RC, 20)).toBe(false);
  });
});

describe('rcUserIdOf', () => {
  it('takes only RevenueCat anonymous ids (32 random hex nobody can guess)', () => {
    expect(rcUserIdOf(RC)).toBe(RC);
    expect(rcUserIdOf('$RCAnonymousID:abc')).toBeNull();
    expect(rcUserIdOf(RC.toUpperCase())).toBeNull();
    expect(rcUserIdOf(RC + '0')).toBeNull();
    expect(rcUserIdOf('rui@example.com')).toBeNull();
    expect(rcUserIdOf('')).toBeNull();
    expect(rcUserIdOf(42)).toBeNull();
  });

  it('an id stored before the check, in another form, never reaches RevenueCat', async () => {
    hasPro.mockReset();
    hasPro.mockResolvedValue(true);
    expect(await creatorPro(async () => 'someone-elses-id')).toBe(false);
    expect(hasPro).not.toHaveBeenCalled();
  });
});
