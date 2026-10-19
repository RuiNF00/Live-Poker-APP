// Whether this device can get a push token for comment notices. Only Android has to wait for one
// (comment-push-ready.android.ts); elsewhere commentPushAvailable() is the whole answer.

export const commentPushReady = async (): Promise<boolean> => true;

export const useCommentPushReady = (): boolean => true;
