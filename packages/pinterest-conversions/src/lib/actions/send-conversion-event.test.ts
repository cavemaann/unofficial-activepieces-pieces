import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversionApiResponse, ConversionEvent } from '../common/client';
import { sendConversionEvent } from './send-conversion-event';

const sendEvents = vi.fn();

vi.mock('../common/client', () => ({
  pinterestConversionsClient: {
    sendEvents: (...args: unknown[]) => sendEvents(...args),
  },
}));

/** A response in which every event Pinterest received was also processed. */
function accepted(count = 1): ConversionApiResponse {
  return {
    num_events_received: count,
    num_events_processed: count,
    events: Array.from({ length: count }, () => ({ status: 'processed' })),
  };
}

function runAction(propsValue: Record<string, unknown>) {
  return sendConversionEvent.run({
    auth: {
      props: { conversion_token: 'token-abc', ad_account_id: '549755885175' },
    },
    propsValue,
  } as never);
}

/** The single call the action made, unwrapped for assertions. */
function sentCall(): { events: ConversionEvent[]; test: boolean; adAccountId: string } {
  expect(sendEvents).toHaveBeenCalledTimes(1);
  return sendEvents.mock.calls[0][0];
}

const minimalProps = {
  event_name: 'checkout',
  action_source: 'web',
  event_time: 1737331200,
  event_id: 'order-1001',
  email: 'Person@Example.com',
};

beforeEach(() => {
  sendEvents.mockReset();
  sendEvents.mockResolvedValue(accepted());
});

describe('run — Pinterest accepted fewer events than it received', () => {
  it('throws rather than returning success', async () => {
    // The worst failure mode in the piece: HTTP 200, nothing recorded. Without
    // this branch the flow goes green forever while logging no conversions.
    sendEvents.mockResolvedValue({
      num_events_received: 1,
      num_events_processed: 0,
      events: [{ status: 'failed', error_message: 'invalid user_data' }],
    });

    await expect(runAction(minimalProps)).rejects.toThrow(
      'Pinterest did not process the event: invalid user_data'
    );
  });

  it('still throws when Pinterest gives no reason', async () => {
    sendEvents.mockResolvedValue({
      num_events_received: 1,
      num_events_processed: 0,
      events: [{ status: 'failed' }],
    });

    await expect(runAction(minimalProps)).rejects.toThrow(
      'Pinterest did not process the event.'
    );
  });

  it('returns the response when the event was processed', async () => {
    await expect(runAction(minimalProps)).resolves.toEqual(accepted());
  });

  it('does not treat a warning on a processed event as a failure', async () => {
    // warning_message accompanies events Pinterest kept. Throwing here would
    // fail runs whose conversions were recorded perfectly well.
    const warned: ConversionApiResponse = {
      num_events_received: 1,
      num_events_processed: 1,
      events: [{ status: 'processed', warning_message: 'unrecognised currency' }],
    };
    sendEvents.mockResolvedValue(warned);

    await expect(runAction(minimalProps)).resolves.toEqual(warned);
  });
});

describe('run — test mode', () => {
  it('is off unless the box is ticked', async () => {
    // Defaulting the other way would silently discard real conversions.
    await runAction(minimalProps);
    expect(sentCall().test).toBe(false);
  });

  it('is passed through when enabled', async () => {
    await runAction({ ...minimalProps, test_mode: true });
    expect(sentCall().test).toBe(true);
  });
});

describe('run — assembled payload', () => {
  it('sends the documented shape for a fully populated event', async () => {
    // A golden payload: the per-field builders are each tested in isolation, so
    // this exists to catch a field landing at the wrong nesting level or being
    // dropped from assembly entirely.
    await runAction({
      event_name: 'checkout',
      action_source: 'app_ios',
      event_time: '2025-01-20T00:00:00Z',
      event_id: 'order-1001',
      event_source_url: 'https://shop.example.com/thanks',
      opt_out: false,
      opt_out_type: 'LDP',
      email: 'Person@Example.com',
      client_ip_address: '203.0.113.7',
      client_user_agent: 'Mozilla/5.0',
      currency: 'GBP',
      value: 49.99,
      content_ids: ['SKU-1', 'SKU-2'],
      num_items: '2',
      order_id: 'order-1001',
      app_id: '123456',
      app_name: 'Example',
      app_version: '2.1.0',
      device_brand: 'Apple',
      device_model: 'iPhone 15',
      device_type: 'mobile',
      language: 'en',
      os_version: '18.3',
      // The dropdown's option value, as the builder actually sends it.
      wifi: 'true',
      partner_name: 'ss-shopify',
    });

    const [event] = sentCall().events;

    expect(event).toEqual({
      event_name: 'checkout',
      action_source: 'app_ios',
      event_time: 1737331200,
      event_id: 'order-1001',
      event_source_url: 'https://shop.example.com/thanks',
      opt_out: false,
      partner_name: 'ss-shopify',
      app_id: '123456',
      app_name: 'Example',
      app_version: '2.1.0',
      // Duplicated on purpose — Pinterest documents both shapes.
      app_info: { app_id: '123456', app_name: 'Example', app_version: '2.1.0' },
      device_brand: 'Apple',
      device_model: 'iPhone 15',
      device_type: 'mobile',
      language: 'en',
      os_version: '18.3',
      wifi: true,
      user_data: {
        // sha256('person@example.com') — lowercased before hashing.
        em: [
          '542d240129883c019e106e3b1b2d3f3cb3537c43c425364de8e951d5a3083345',
        ],
        client_ip_address: '203.0.113.7',
        client_user_agent: 'Mozilla/5.0',
      },
      custom_data: {
        currency: 'GBP',
        value: '49.99',
        content_ids: ['SKU-1', 'SKU-2'],
        num_items: 2,
        opt_out_type: 'LDP',
        order_id: 'order-1001',
      },
    });
  });

  it('omits every optional field that was not supplied', async () => {
    // Pinterest treats an absent field and an empty one differently, so blanks
    // must not reach the payload as "" or {}.
    await runAction(minimalProps);
    const [event] = sentCall().events;

    expect(Object.keys(event).sort()).toEqual([
      'action_source',
      'event_id',
      'event_name',
      'event_time',
      'user_data',
    ]);
  });

  it('sends the ad account ID from the connection', async () => {
    await runAction(minimalProps);
    expect(sentCall().adAccountId).toBe('549755885175');
  });
});
