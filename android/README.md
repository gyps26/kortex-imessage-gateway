# Kortex Android SMS Gateway

Fork of [selfhostsim/android](https://github.com/ampilares/selfhostsim/tree/main/android) configured for the Kortex hub.

## Setup

1. Fork or clone the selfhostsim repository:
   ```bash
   git clone https://github.com/ampilares/selfhostsim.git
   cp -r selfhostsim/android ./android-app
   ```

2. Update `android-app/app/build.gradle` (or `build.gradle.kts`):
   ```gradle
   buildConfigField "String", "API_BASE_URL", "\"https://YOUR_KORTEX_URL/api/gateway/\""
   ```

3. Replace `google-services.json` with your Firebase project credentials.

4. Build and install the APK on your Android device with SMS permissions.

## API compatibility

The Kortex hub implements these selfhostsim-compatible endpoints:

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/gateway/devices` | None (returns API key) |
| PATCH | `/api/gateway/devices/{id}` | `x-api-key` |
| POST | `/api/gateway/devices/{id}/receive-sms` | `x-api-key` |
| PATCH | `/api/gateway/devices/{id}/sms-status` | `x-api-key` |

FCM outbound payloads use the `smsData` JSON format expected by `FCMService.java`.

## Pairing

1. In the Kortex dashboard, open **Connectors → Android** and register a device (or use the app’s first-launch registration).
2. Copy the API key and assign the device to a GHL location on **Subaccounts**.
3. Ensure Firebase env vars are set on the server (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
