# Fixora Backend Update

This update fixes the customer-side integration issues.

## Changes

- Nearby service discovery now validates coordinates/radius and uses a robust geospatial query.
- Nearby services only return active and available services.
- Added authenticated `PATCH /api/auth/me` for updating the current user's name, phone, location and profile image URL.
- Added authenticated `PATCH /api/auth/password` for changing the current user's password.
- Added authenticated customer-only `GET /api/users/vendors/:id` for vendor profiles.
- Existing Socket.IO authentication fix is retained.

## Run

Keep your existing `.env` file. Do not commit or share secrets.

```bash
npm install
npm run dev
```

## Fixora Wallet Payment Flow
- Admin manually credits customer wallets from Admin → Customer Wallets.
- Vendor/task runner marks work completed.
- Customer opens the completed booking/task and clicks **Confirm completion & pay**.
- The server atomically deducts the full amount from the customer wallet, records the commission, and credits the provider's net earnings.
- Provider payout requests remain manual: admin sends the money externally and marks the payout completed in the admin payout workflow.
- Default platform commission is 10%; change `PLATFORM_COMMISSION_PERCENT` in `.env` if needed.
