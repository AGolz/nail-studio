# NARA Nail & Brow Atelier

An independent Armenian-first portfolio demo for a fictional manicure, pedicure and brow studio in Yerevan. Russian and English pages use manually written copy.

## Local preview

From the repository root, run:

```sh
python3 -m http.server 4173 --directory nail-studio/site
```

Then open `http://localhost:4173/`. The demo uses plain HTML, CSS and JavaScript and has no package installation or build step. The Netlify Function is not available from this basic static preview.

## Demo booking

The booking flow uses sample services, specialists and availability. It calculates add-on price and time, filters specialists by service, validates a phone number and ends with an explicit demo notice. It does not submit personal data or create an appointment.

`netlify/functions/booking.js` is the server-side integration point for a future booking provider. Until both `BOOKING_WEBHOOK_URL` and `BOOKING_WEBHOOK_SECRET` are configured in Netlify, the endpoint responds with `503 booking_integration_not_configured`. Keep the secret in Netlify environment variables; never place it in `site/app.js` or HTML.

## Netlify

This folder is configured as a separate site in the portfolio repository.

- Base directory: `nail-studio`
- Package directory: leave unset
- Build command: leave empty
- Publish directory: `site`
- Functions directory: `netlify/functions`

The site's configuration is in `nail-studio/netlify.toml`. Setting the base directory to `nail-studio` keeps its publish/function paths relative to this site and leaves the existing barber site's root `netlify.toml` unchanged.

## Demo content

Names, address, phone, hours, prices, specialists, service details and availability are fictional. Photos are stock images and do not depict actual NARA clients or staff. The sanitation and materials text is illustrative and must be confirmed by a real studio before publication.