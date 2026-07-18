import { PieceAuth, Property } from '@activepieces/pieces-framework';
import {
  AuthenticationType,
  HttpMethod,
  httpClient,
} from '@activepieces/pieces-common';

const markdownDescription = `
Connect Activepieces to the **TryBooking Reporting API** to read your events, bookings and ticket scans.

**1. Generate your API keys**
1. Sign in to the [TryBooking Portal](https://portal.trybooking.com/).
2. Go to **Integration Tools → API Management**.
3. Click **Generate API Key**, give it a name and confirm.
4. Copy the **Key** and the **Secret Key** — the secret is only shown once.

**2. Pick your region**
TryBooking runs a separate system per region. Choose the region your account belongs to (the same one you sign in to).

The keys are used as HTTP Basic credentials (Key = username, Secret Key = password) and only grant read access.
`;

const REGION_OPTIONS = [
  { label: 'Australia (au)', value: 'au' },
  { label: 'New Zealand (nz)', value: 'nz' },
  { label: 'United Kingdom (uk)', value: 'uk' },
  { label: 'United States (us)', value: 'us' },
];

export const trybookingAuth = PieceAuth.CustomAuth({
  description: markdownDescription,
  required: true,
  props: {
    api_key: PieceAuth.SecretText({
      displayName: 'API Key',
      description: 'The Key generated in Portal → Integration Tools → API Management.',
      required: true,
    }),
    secret_key: PieceAuth.SecretText({
      displayName: 'Secret Key',
      description: 'The Secret Key shown when you generated the API Key.',
      required: true,
    }),
    region: Property.StaticDropdown({
      displayName: 'Region',
      description: 'The TryBooking system that hosts your account.',
      required: true,
      defaultValue: 'au',
      options: { options: REGION_OPTIONS },
    }),
  },
  validate: async ({ auth }) => {
    try {
      await httpClient.sendRequest({
        method: HttpMethod.GET,
        url: `https://api.trybooking.com/${auth.region}/reporting/v1/event`,
        authentication: {
          type: AuthenticationType.BASIC,
          username: auth.api_key,
          password: auth.secret_key,
        },
      });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error:
          'Could not authenticate with TryBooking. Check the API Key, Secret Key and region, then try again.',
      };
    }
  },
});
