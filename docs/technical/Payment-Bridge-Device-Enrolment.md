# Payment bridge — device enrolment and request signing

Status: backend, Android plugin, web-client signing and the pairing card are shipped and verified on an emulator.

## Why

The B2.9 fallback lets a receptionist's phone read a bank SMS / soundbox notification and post it to
`POST /api/v1/integrations/payments/bridge/notifications`. Until now the only credential was the
clinic JWT, so any signed-in user could manufacture a receipt from a browser. A paired handset now
signs each body with a secret the browser never sees.

## Flow

1. `POST /integrations/payments/bridge/devices/pairing-code` (ClinicAdmin)
   → `{ deviceId, pairingCode, expiresAt }` — six digits, 10 minutes, five attempts.
2. `POST /integrations/payments/bridge/devices/pair` (ClinicAdmin or Receptionist), body
   `{ pairingCode, name? }` → `{ deviceId, name, secret }`. The secret is returned **once**; the server
   keeps only a Data-Protection-wrapped copy.
3. The handset stores the secret and sends it with every signal:
   - `X-Device-Id: <deviceId>`
   - `X-Device-Timestamp: <unix ms>`
   - `X-Device-Signature: sha256=<hex HMAC-SHA256(secret, "deviceId\ntimestampMs\nbody")>`
4. `GET /integrations/payments/bridge/devices` (ClinicAdmin) lists devices;
   `POST /integrations/payments/bridge/devices/{id}/revoke` clears the secret and blocks the device.

## Enforcement rule

- Tenant has **no** paired device → the JWT alone is accepted (rollout window).
- Tenant has **any** paired, non-revoked device → unsigned signals get
  `401 { "error": "device_signature_required" }`.

Pairing is therefore the switch that turns signing on. Do not pair a phone until its app signs.

Rejected with 401: unknown/revoked device, timestamp older than five minutes, wrong HMAC.
Replayed bodies are stopped by the existing `(provider, eventId)` dedupe.

## Server-side guards

- Bodies over 8 KB are rejected with 413 — a bank alert is a few hundred bytes.
- Debit wording ("debited", "withdrawn", "deducted", "paid to", "sent to", "spent") is ignored even if
  the handset sends it, so an older APK cannot close an invoice with an outgoing payment.
- The parser on the device no longer treats "paid" as a credit word and no longer uploads the full SMS
  text; it sends `reference` only.

## Client wiring

1. `PaymentBridgePlugin.saveCredentials({ deviceId, secret })` stores the secret encrypted with an
   AES key generated inside the Android Keystore (`PaymentBridgeCredentials`); the web layer drops it
   immediately.
2. `PaymentBridgePlugin.signBody({ body })` returns `{ deviceId, timestampMs, signature }` for the exact
   JSON string about to be posted. `signBody` rejects when the phone is unpaired, so the drain falls back
   to the JWT-only rollout path.
3. Settings → **Device Signing**: an admin taps *Generate a code*, any billing user types the six digits
   and taps *Pair this phone*. Admins also see *Paired devices* with a revoke action per device.
4. If the server answers `unknown_device` (the device was revoked from another phone) the drain deletes
   the local credential, so the next attempt posts with the JWT instead of looping on 401.

Verified end to end on the emulator: unsigned post before pairing → `200 unmatched`; pairing → unsigned
post → `401 device_signature_required`; a real emulator SMS was parsed, signed, accepted and the queue
cleared; revoking the device restored the unsigned path (`200`).

`shortcut: the 6-digit pairing code is hashed with the device id, not a server pepper; a database
reader could brute-force an outstanding code. Upgrade if pairing ever leaves the same-tenant admin flow.`
