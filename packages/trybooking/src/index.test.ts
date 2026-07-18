import { describe, expect, it } from 'vitest';
import { trybooking } from './index';
import translation from './i18n/translation.json';

describe('TryBooking piece metadata', () => {
  it('declares the current supported release floor', () => {
    expect(trybooking.minimumSupportedRelease).toBe('0.82.0');
  });

  it('exposes webhook and polling booking triggers with AI metadata', () => {
    const webhook = trybooking.getTrigger('new_booking');
    const polling = trybooking.getTrigger('new_booking_polling');

    expect(webhook?.sampleData).toBeDefined();
    expect(webhook?.aiMetadata?.description).toBeTruthy();
    expect(polling?.sampleData).toBeDefined();
    expect(polling?.aiMetadata?.description).toBeTruthy();
  });

  it('keeps the custom API action available', () => {
    expect(trybooking.getAction('custom_api_call')).toBeDefined();
  });

  it('keeps English translations aligned with the changed metadata', () => {
    const translationKeys = Object.keys(translation);

    expect(translationKeys).toContain('New Booking (Polling)');
    expect(translationKeys).toContain(
      'Fires in real time when TryBooking reports a successful new booking. No connection required.'
    );
    expect(translationKeys).toContain(
      'The UTC date the bookings were made, in yyyy-MM-dd format (e.g. 2026-07-14).'
    );
    expect(translationKeys).not.toContain(
      'Fires when a new booking is made on your TryBooking account.'
    );
  });
});
