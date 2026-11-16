# App Store / Play production checklist

Canonical app IDs (must match across Xcode, Android, Firebase, Contentsquare, ASC):

| Platform | ID |
|----------|----|
| iOS Bundle ID | `afras.wellnessshiftrn.ios` |
| Android applicationId | `afras.wellnessshiftrn.android` |

> **Android note:** Java/Kotlin package names must be fully lowercase. `afras.wellnessshiftrn.android` is the valid form of the intended `Afras.WellnessShiftRNAndroid` identifier.

## 1. Firebase

### iOS
1. In the Firebase console → Project settings → Your apps → iOS app, the **Bundle ID** must be `afras.wellnessshiftrn.ios`.
2. Download the updated `GoogleService-Info.plist` and place it at `ios/WellnessShift/GoogleService-Info.plist`. The `BUNDLE_ID` key in the plist must read `afras.wellnessshiftrn.ios`.

### Android
1. In the Firebase console → Project settings → Your apps → Android app, the **Android package name** must be `afras.wellnessshiftrn.android`.
2. Download the updated `google-services.json` and place it at `android/app/google-services.json`. The `package_name` field must read `afras.wellnessshiftrn.android`.

### Both
3. Enable Auth providers you ship (Email, **Sign in with Apple**). Google is **disabled for v1** (`appConfig.enableGoogleSignIn = false`).
4. To re-enable Google later: set `enableGoogleSignIn: true`, paste the **Web client ID** into `src/config/googleAuth.local.ts`, and keep Info.plist `GIDClientID` / URL scheme aligned with `GoogleService-Info.plist` `CLIENT_ID` / `REVERSED_CLIENT_ID`.

## 2. App Store Connect — subscription products (required before review)

Product IDs must exist in ASC (Subscriptions) and match `src/services/iap.ts`:

| Product ID | Tier | Period |
|------------|------|--------|
| `com.wellnessshift.growth.monthly` | Growth | Monthly |
| `com.wellnessshift.growth.yearly` | Growth | Yearly |
| `com.wellnessshift.pro.monthly` | Pro | Monthly |
| `com.wellnessshift.pro.yearly` | Pro | Yearly |

### Exact ASC steps
1. App Store Connect → **Agreements, Tax, and Banking** → accept **Paid Applications** + add banking/tax.
2. Your app (`afras.wellnessshiftrn.ios`) → **Subscriptions** → create a **Subscription Group** (e.g. “Wellness Shift Premium”).
3. Add the four products above; localization (EN-GB); pricing; **Cleared for Sale**.
4. Attach the subscription group to the app version you submit.
5. **Users and Access** → **Sandbox** → create a Sandbox Apple ID.
6. On a device/simulator signed into that Sandbox ID: open Paywall → purchase → confirm Metro `[IAP] All subscription product IDs resolved`.
7. Delete the app / sign out of subscription → open Paywall → **Restore** → expect “Your growth/pro plan is active”.

Checklist:

- [ ] Products created under the ASC app with Bundle ID `afras.wellnessshiftrn.ios`
- [ ] Paid Applications Agreement + banking + tax active
- [ ] Subscription group attached; products Cleared for Sale
- [ ] Sandbox tester can purchase; store returns all four (watch Metro `[IAP]` logs)
- [ ] Sandbox **Restore** works with the same Sandbox Apple ID
- [ ] **Do not** market "7-day free trial" in the app unless ASC has a matching introductory offer and StoreKit shows it

Local complimentary preview (`freeTrialService`) is **not** an App Store intro offer.

In-app restore lives on `PaywallScreen` → **Restore** (`subscriptionService.restore` → `iapService.restore`).

## 3. Privacy / Terms (website)

In-app disclosures in `src/data/legalContent.ts` are the source of truth. Update https://wellnesshift.co.uk/privacy (and related pages) to match before review.

### Paste these website fixes (required)

**Age policy** — replace any “13–16 parental consent” wording with:

> You must be at least 16 years old to create an App account. The App is not directed at children under 16. If you believe we have collected data from someone under 16, contact support@wellnesshift.co.uk and we will delete it.

**Contentsquare / analytics** — replace “on by default” with:

> Contentsquare analytics and session replay are off by default. Collection starts only if you turn on “Allow analytics” in Profile. When enabled, we may collect screen views, interaction events, and session replay of the app UI (with default masking). You can turn analytics off anytime in Profile.

**Wellness Coach** — replace “AI Health Coach generates…” with:

> The App’s Wellness Coach provides rule-based lifestyle guidance from your profile and messages — not a generative AI model. Outputs are for education only, are not medical advice, and never replace a GP. See the in-app Wellness Coach / AI Disclosure for details.

Also refresh the embedded “In-App Privacy Policy” block on the website from the current `PRIVACY_SECTIONS` in `legalContent.ts`.

## 4. Contentsquare (privacy-safe defaults)

- Environment IDs: `src/config/contentsquare.local.ts`
- Register **iOS** Bundle ID `afras.wellnessshiftrn.ios` in Contentsquare Apps
- Register **Android** package `afras.wellnessshiftrn.android` in Contentsquare Apps
- **Default masking ON** (`contentsquareDefaultMasking: true`)
- **Collection is opt-in** via Profile → Allow analytics (off until the user enables it)
- Identity uses Firebase **UID**, not email
- Session replay starts only after opt-in
- **Push notification autocapture ON** (`enablePushNotificationAutocapture` + title/body) so Product Analytics can define Notification Interaction events
- Confirm Session Replay is enabled for the project in Contentsquare console
- If replays still look wrong, check CSQ Console → Data Masking (remote rules can override the app)

## 5. v1 feature gates (`src/config/appConfig.ts`)

| Flag | v1 default | Effect |
|------|------------|--------|
| `enableSocialFeed` | `false` | Hides Social Feed from More |
| `enableCommunityLeaderboard` | `false` | Hides Community Progress / leaderboard |
| `enableCommunityForum` | `false` | Hides the local-only forum of sample posts |
| `enableCoachingBookings` | `false` | Hides coach booking that only saves on the phone |
| `enableNewsletterSignup` | `false` | Hides the newsletter form that does not send mail |
| `enablePremiumShop` | `false` | Shop screen redirects to paywall |
| `enableGoogleSignIn` | `false` | Apple + email only |

Social Hub (friends) remains available. Mock community posts / fake leaderboard users were removed.

## 6. Wellness Coach (not generative AI)

User-facing name is **Wellness Coach**. Copy discloses rule-based / on-device coaching — see `AI_DISCLOSURE_SECTIONS` and the coach welcome message.

## 7. Info.plist

- `UIBackgroundModes`: **remote-notification** only (unused `fetch` removed)
- Google URL scheme / `GIDClientID` aligned with `GoogleService-Info.plist` for a future Google re-enable

## 8. Google Play

Mirror the four product IDs in Play Console subscriptions under the app with package `afras.wellnessshiftrn.android`.

Checklist:

- [ ] Four subscription products created (same IDs as §2)
- [ ] Play App Signing enrolled
- [ ] Release AAB signed with the upload keystore from §9 (not the debug keystore)
- [ ] Data Safety form matches Health Connect + opt-in analytics + Crashlytics

## 9. Android release signing

Release builds **must not** use the debug keystore. `android/app/build.gradle` reads `android/keystore.properties` and fails `assembleRelease` / `bundleRelease` if it is missing.

1. From `android/`, generate an upload keystore (back it up securely — losing it blocks updates):

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore upload-keystore.jks -alias wellnessshift-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

2. Copy `android/keystore.properties.example` → `android/keystore.properties` and set `storeFile`, passwords, and `keyAlias`.
3. Keep `keystore.properties`, `*.jks`, and `*.keystore` out of git (already gitignored).
4. Build: `cd android && ./gradlew bundleRelease`
5. In Play Console → App integrity → use Play App Signing; upload the AAB signed with this upload key.
6. After creating the release keystore, add its SHA-1 / SHA-256 to Firebase Android app settings (needed if you re-enable Google Sign-In later).

The upload keystore for this machine was created on 29 Sep 2026 and is gitignored:

- `android/upload-keystore.jks`
- `android/keystore.properties` (password lives only here — copy both into a password manager)

Upload certificate fingerprints (public):

- SHA-1: `5D:BF:48:E2:AB:B6:A0:74:01:5B:6C:8D:C5:A1:AA:01:DD:34:6E:48`
- SHA-256: `2E:7B:68:A0:0F:E1:34:DC:EE:94:38:4F:18:C0:B2:B8:06:66:C9:38:65:35:4E:89:25:CC:77:F9:8C:9A:64:94`

Release bundle built 29 Sep 2026 and signed with that upload certificate (`jarsigner` reported `jar verified`):

`android/app/build/outputs/bundle/release/app-release.aab`

## 10. Listing copy, privacy labels, and Data safety

Paste these into App Store Connect and Play Console. They match `ios/WellnessShift/PrivacyInfo.xcprivacy` and the live privacy policy. Do not describe Wellness Coach as generative AI.

**Name:** Wellness Shift

**Subtitle (30):** Score, plan, and learn

**Promotional text:** A daily wellness score, a plan, and practical learning for food, movement, sleep, and habits. Education only — it does not diagnose or replace your GP.

**Keywords:** wellness,fitness,nutrition,sleep,habits,health score,daily plan,learning

**Short description (Play, 80):** Daily wellness score, plan, and practical health learning.

**Full description:**

Wellness Shift helps you follow one wellness score, a daily plan, and short learning on food, movement, sleep, and habits.

What you can do:
- See a wellness score and a daily plan
- Learn from fitness, nutrition, and anatomy guides
- Log habits, steps, and check-ins
- Optionally read activity and sleep from Apple Health or Health Connect
- Link a clinician with an invite code if they use Wellness Shift
- Use Wellness Coach for rule-based lifestyle guidance

Wellness Shift is education and wellness support. It does not diagnose, treat, or replace advice from your GP. In an emergency call 999.

Subscriptions: Growth and Pro unlock more of the plan and learning. Prices are shown in the app before you confirm with Apple or Google. You can restore purchases from the paywall.

**Privacy nutrition (App Store Connect)** — Data used to track you: none. Tracking: off.

| Data type | Linked to user | Used for tracking | Purpose |
|-----------|----------------|-------------------|---------|
| Name | Yes | No | App functionality |
| Email address | Yes | No | App functionality |
| Health and fitness | Yes | No | App functionality, product personalisation |
| Product interaction | Yes | No | App functionality, analytics |
| Device ID | Yes | No | App functionality, analytics |
| Crash data | No | No | App functionality |
| Other user content | Yes | No | App functionality, product personalisation |
| Purchase history | Yes | No | App functionality |

Analytics and session replay are collected only if the user turns on Allow analytics. Crash reports are not used for advertising.

**Play Data safety**

- Collects user data: Yes. Sells data: No. Shares data with third parties: No.
- Encrypted in transit: Yes.
- Users can request deletion: Yes, in the app under Data Rights.
- Personal info: name, email — collected, required for the account.
- Health and fitness: collected when the user enters it or connects Apple Health / Health Connect (steps, distance, calories, exercise, heart rate, sleep, weight, height, blood pressure, blood glucose, oxygen, respiratory rate). Optional.
- Messages: collected when the user messages a linked clinician.
- App activity: collected. Product analytics only if the user opts in.
- Device or other IDs and crash logs: collected for diagnostics. Crash logs are not used for ads.
- Financial info: purchase history, so Growth or Pro can be restored.
- Photos: the food scan can read an image the user picks. Do not declare photos as collected on a server unless that upload is enabled.

**Screenshots**

- App Store 6.9-inch (1320×2868): `store-assets/ios/app-store-6.9-fitness-hub.png` (scaled from the iPhone 17 Pro simulator). Capture Home, a learning guide, and Analytics on an iPhone 17 Pro Max simulator before submission so the set is not a single screen.
- Play phone shots must be 9:16. The Pixel 10 Pro frame (1280×2856) is taller than 9:16, so crop before upload. Do not upload shots that still show the Metro Fast Refresh bar or the red debugger toast.

**What still needs your store login**

This repo cannot open App Store Connect or Play Console. The Mac keychain has an Apple Development certificate for team `J5TW7P57Y2` and no Apple Distribution certificate, so a TestFlight upload cannot be signed from here until Xcode is signed in with the Apple Developer account that can create that certificate. Play internal testing starts when you upload `app-release.aab` in Play Console → Testing → Internal testing, with the four subscription products from section 8.
