import { AppConnectionType } from '@activepieces/shared';
import {
  AuthenticationType,
  HttpMethod,
  httpClient,
} from '@activepieces/pieces-common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { trybookingCommon, TryBookingAuth } from './client';

const REGIONS: Array<'au' | 'nz' | 'uk' | 'us'> = ['au', 'nz', 'uk', 'us'];

function authForRegion(
  region: 'au' | 'nz' | 'uk' | 'us'
): TryBookingAuth {
  return {
    type: AppConnectionType.CUSTOM_AUTH,
    props: {
      api_key: 'api-key',
      secret_key: 'secret-key',
      region,
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('trybookingCommon.apiCall', () => {
  it.each(REGIONS)(
    'builds the %s regional v1 URL with Basic authentication',
    async (region) => {
      const sendRequest = vi
        .spyOn(httpClient, 'sendRequest')
        .mockResolvedValue({ status: 200, headers: {}, body: { ok: true } });

      await trybookingCommon.apiCall<{ ok: boolean }>({
        auth: authForRegion(region),
        method: HttpMethod.GET,
        version: 'v1',
        path: '/event',
      });

      expect(sendRequest).toHaveBeenCalledWith({
        method: HttpMethod.GET,
        url: `https://api.trybooking.com/${region}/reporting/v1/event`,
        authentication: {
          type: AuthenticationType.BASIC,
          username: 'api-key',
          password: 'secret-key',
        },
        queryParams: undefined,
      });
    }
  );

  it('routes scan requests to Reporting API v2', async () => {
    const scanResponse = {
      sessionId: 123,
      totalAttendance: 1,
      listOfTicketScans: [
        {
          ticketBarcode: 'ABC-123',
          ticketScanId: 'scan-1',
          scanDateTime: '2026-07-15T01:02:03Z',
          scanEvent: 'Scan In',
          scanDeviceName: 'Front Door',
          scanDeviceLocation: 'Venue',
          ruleId: 'rule-1',
        },
      ],
    };
    const sendRequest = vi
      .spyOn(httpClient, 'sendRequest')
      .mockResolvedValue({ status: 200, headers: {}, body: scanResponse });

    const result = await trybookingCommon.apiCall<typeof scanResponse>({
      auth: authForRegion('au'),
      method: HttpMethod.GET,
      version: 'v2',
      path: '/scans/123/attendance',
    });

    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.trybooking.com/au/reporting/v2/scans/123/attendance',
      })
    );
    expect(result.listOfTicketScans[0]?.ruleId).toBe('rule-1');
  });

  it('exposes the unversioned Reporting API base for custom calls', () => {
    expect(trybookingCommon.reportingBaseUrl('uk')).toBe(
      'https://api.trybooking.com/uk/reporting'
    );
  });
});

describe('trybookingCommon.validateUtcDate', () => {
  it('accepts real UTC calendar dates', () => {
    expect(trybookingCommon.validateUtcDate('2024-02-29')).toBe('2024-02-29');
  });

  it.each(['2026-2-03', '2026-02-30', '15-07-2026', 'not-a-date'])(
    'rejects invalid date %s',
    (date) => {
      expect(() => trybookingCommon.validateUtcDate(date)).toThrow(
        'Booking Date must be a real UTC date in yyyy-MM-dd format'
      );
    }
  );
});
