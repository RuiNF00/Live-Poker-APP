import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const store = { queueCommentPush: vi.fn(), dropCommentPush: vi.fn() };
vi.mock('../src/lib/store', () => ({ getStore: () => store }));

const { notifyOwner } = await import('../src/lib/comment-push');

const msg = (to: string) => ({ to, title: 'Novo comentário na tua mão: turn', body: 'Toca para abrir a mão nesse comentário.' });

afterEach(() => {
  vi.restoreAllMocks();
  store.queueCommentPush.mockReset();
  store.dropCommentPush.mockReset();
});

describe('notice to the hand owner when a comment arrives', () => {
  it('sends nothing when the database holds it (quiet hours, or one already waiting to be opened)', async () => {
    store.queueCommentPush.mockResolvedValue([]);
    const f = vi.spyOn(globalThis, 'fetch');
    await notifyOwner('h1', 'turn');
    expect(store.queueCommentPush).toHaveBeenCalledWith('h1', 'turn');
    expect(f).not.toHaveBeenCalled();
  });

  it("sends the database's message to Expo and forgets a dead token", async () => {
    store.queueCommentPush.mockResolvedValue([{ handId: 'h1', message: msg('ExponentPushToken[aaaaaaaaaa]') }]);
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] })));
    await notifyOwner('h1', 'turn');
    expect(f).toHaveBeenCalledOnce();
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect(JSON.parse(String(init?.body))).toEqual([msg('ExponentPushToken[aaaaaaaaaa]')]);
    expect(store.dropCommentPush).toHaveBeenCalledWith('h1');
  });

  it('never fails the comment when Expo is down', async () => {
    store.queueCommentPush.mockResolvedValue([{ handId: 'h1', message: msg('ExponentPushToken[aaaaaaaaaa]') }]);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(notifyOwner('h1', null)).resolves.toBeUndefined();
    expect(store.dropCommentPush).not.toHaveBeenCalled();
  });
});
