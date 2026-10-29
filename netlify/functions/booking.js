const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

const serviceAddons = {
  'natural-manicure': new Set(['simple-art', 'intricate-art']),
  'gel-manicure': new Set(['removal', 'strengthening', 'simple-art', 'intricate-art']),
  'classic-pedicure': new Set(),
  'gel-pedicure': new Set(['removal']),
  'brow-shape': new Set(),
  'brow-tint': new Set(),
  'brow-lamination': new Set(),
  'brow-complex': new Set()
};

const artistServices = {
  lilit: new Set(['natural-manicure', 'gel-manicure', 'classic-pedicure', 'gel-pedicure']),
  ani: new Set(['natural-manicure', 'gel-manicure', 'classic-pedicure', 'gel-pedicure']),
  mariam: new Set(['brow-shape', 'brow-tint', 'brow-lamination', 'brow-complex'])
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  let booking;
  try {
    booking = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const requiredFields = ['serviceId', 'masterId', 'date', 'time', 'name', 'phone'];
  if (requiredFields.some((field) => typeof booking[field] !== 'string' || !booking[field].trim())) {
    return json(400, { error: 'required_fields_missing' });
  }

  const allowedAddons = Object.hasOwn(serviceAddons, booking.serviceId)
    ? serviceAddons[booking.serviceId]
    : null;
  const addons = Array.isArray(booking.addonIds) ? booking.addonIds : [];
  const phoneDigits = booking.phone.replace(/\D/g, '');
  const phoneIsValid = /^\+?[\d\s().-]{8,24}$/.test(booking.phone.trim())
    && phoneDigits.length >= 8
    && phoneDigits.length <= 15;
  const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(booking.date)
    && !Number.isNaN(Date.parse(`${booking.date}T00:00:00Z`))
    && new Date(`${booking.date}T00:00:00Z`).toISOString().slice(0, 10) === booking.date;
  const timeIsValid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(booking.time);

  if (!allowedAddons
    || !Object.hasOwn(artistServices, booking.masterId)
    || !artistServices[booking.masterId].has(booking.serviceId)
    || addons.some((addonId) => typeof addonId !== 'string' || !allowedAddons.has(addonId))
    || booking.name.trim().length < 2
    || booking.name.trim().length > 80
    || !phoneIsValid
    || !dateIsValid
    || !timeIsValid) {
    return json(400, { error: 'booking_details_invalid' });
  }

  const webhookUrl = process.env.BOOKING_WEBHOOK_URL;
  const webhookSecret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    return json(503, { error: 'booking_integration_not_configured' });
  }

  try {
    const target = new URL(webhookUrl);
    if (target.protocol !== 'https:') {
      return json(503, { error: 'booking_integration_not_configured' });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${webhookSecret}`
      },
      body: JSON.stringify({
        source: 'nara-studio',
        serviceId: booking.serviceId,
        addonIds: addons,
        masterId: booking.masterId,
        date: booking.date,
        time: booking.time,
        name: booking.name.trim(),
        phone: booking.phone.trim()
      })
    });

    if (!response.ok) {
      return json(502, { error: 'booking_provider_failed' });
    }

    return json(200, { status: 'request_forwarded' });
  } catch {
    return json(502, { error: 'booking_provider_unavailable' });
  }
};