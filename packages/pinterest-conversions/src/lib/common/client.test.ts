import { HttpError } from '@activepieces/pieces-common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendRequest = vi.fn();

vi.mock('@activepieces/pieces-common', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  httpClient: { sendRequest: (...args: unknown[]) => sendRequest(...args) },
}));

const { pinterestConversionsClient } = await import('./client');

/** HttpError reads status and body off an AxiosError-shaped `response`. */
function httpError(status: number, body?: unknown): HttpError {
  return new HttpError({}, { response: { status, data: body } } as never);
}

function send() {
  return pinterestConversionsClient.sendEvents({
    conversionToken: 'token-abc',
    adAccountId: '549755885175',
    events: [],
    test: false,
  });
}

beforeEach(() => {
  sendRequest.mockReset();
});

describe('sendEvents request', () => {
  it('wraps the events in a data object and authorizes with the token', async () => {
    sendRequest.mockResolvedValue({ body: { ok: true } });
    const events = [{ event_name: 'checkout' }];

    await pinterestConversionsClient.sendEvents({
      conversionToken: 'token-abc',
      adAccountId: '549755885175',
      events: events as never,
      test: false,
    });

    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.pinterest.com/v5/ad_accounts/549755885175/events',
        headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }),
        body: { data: events },
      })
    );
  });

  it('omits the test parameter entirely when not testing', async () => {
    // Pinterest warns that ?test=true must be off for real events. Sending
    // test=false would also work, but absent is unambiguous.
    sendRequest.mockResolvedValue({ body: {} });
    await send();
    expect(sendRequest.mock.calls[0][0].queryParams).toEqual({});
  });

  it('sets test=true when testing', async () => {
    sendRequest.mockResolvedValue({ body: {} });
    await pinterestConversionsClient.sendEvents({
      conversionToken: 'token-abc',
      adAccountId: '549755885175',
      events: [],
      test: true,
    });
    expect(sendRequest.mock.calls[0][0].queryParams).toEqual({ test: 'true' });
  });
});

describe('sendEvents error messages', () => {
  // Each status gets its own remedy, because the fix differs: a 401 means
  // regenerate the token, a 403 means check the account, a 429 means wait.
  it.each([
    [401, 'Generate a new token in Ads Manager'],
    [403, 'Confirm the Ad Account ID and the account role'],
    [429, '5,000 calls per minute'],
    [503, 'temporarily down'],
  ])('explains a %i with what to do about it', async (status, remedy) => {
    sendRequest.mockRejectedValue(httpError(status));
    await expect(send()).rejects.toThrow(remedy);
  });

  it.each([
    [400, 'Bad Request'],
    [422, 'unprocessable'],
  ])("includes Pinterest's own message on a %i", async (status, prefix) => {
    // These two are the statuses where the payload was at fault, so Pinterest's
    // detail is the only thing that says which field.
    sendRequest.mockRejectedValue(
      httpError(status, { message: 'event_time is required', code: 2 })
    );
    const error = await send().catch((e: Error) => e);
    expect(error.message).toContain(prefix);
    expect(error.message).toContain('event_time is required');
  });

  it('names the status for an unmapped code', async () => {
    sendRequest.mockRejectedValue(httpError(418));
    await expect(send()).rejects.toThrow('Pinterest Conversions API Error (418)');
  });

  it('survives an error body that carries no message', async () => {
    sendRequest.mockRejectedValue(httpError(400, undefined));
    await expect(send()).rejects.toThrow('Bad Request');
  });

  it('passes a non-HTTP failure through as-is', async () => {
    // A DNS or socket error is not something to reword into an API message.
    sendRequest.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    await expect(send()).rejects.toThrow('getaddrinfo ENOTFOUND');
  });
});
