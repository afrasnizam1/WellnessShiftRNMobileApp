/**
 * Path from ~4/10 public launch readiness → ~9/10.
 *
 * Code in this repo can get you most of the way. Store consoles + website + SMTP
 * still need your hands. Work top-to-bottom.
 */

## Scoreboard

| Area | Before | After this pass | You still need |
|------|--------|-----------------|----------------|
| Privacy (clinician email lookup) | Broad client reads | Cloud Function + tightened rules | Deploy functions + rules |
| Entitlements | Client-only tier | `entitlements/{uid}` via callable | Deploy functions; later add Apple/Play server API verify |
| App Check | Off | On for production builds | Register apps in Firebase App Check; debug token for Simulator |
| Verification email | Generic Firebase | Branded HTML when SMTP env set; else Auth template | Set Public-facing name + SMTP secrets **or** edit Auth template in Console |
| IAP / store products | Code ready | Unchanged | Create 4 products in ASC + Play; sandbox purchase |
| Website legal | In-app source of truth | Unchanged | Paste blocks from `docs/APP_STORE_SETUP.md` §3 |
| Tests / smoke | Thin | Checklist below | Run TestFlight / internal track smoke |

## Deploy (required)

**Cloud Functions need the Firebase Blaze (pay-as-you-go) plan.**  
Upgrade: https://console.firebase.google.com/project/wellnessshift-rn-ios/usage/details

Until Blaze is enabled, email connection falls back to the client path (rules still allow clinician `pendingClinicianRequests` create). Entitlement + branded-email callables will no-op until functions deploy.

```bash
# Rules only (works on Spark):
firebase deploy --only firestore:rules

# After Blaze upgrade:
cd functions && npm run build
cd .. && firebase deploy --only functions,firestore:rules
```

Optional branded email (Cloud Function `sendBrandedVerificationEmail`):

```bash
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
# optional: SMTP_FROM, SMTP_PORT, SMTP_SECURE
```

Until SMTP is set, the app falls back to Firebase Auth’s built-in verification email.
Still set **Project Settings → Public-facing name** to `Wellness Shift` so the default template doesn’t say `project-912633076119`.

## Firebase Console (15 min)

1. **Authentication → Templates → Email address verification**  
   - Subject: `Verify your email for Wellness Shift`  
   - Body: use friendly Wellness Shift wording + `%LINK%`  
2. **Project settings → Public-facing name** → `Wellness Shift`  
3. **App Check** → register iOS (DeviceCheck/App Attest) + Android (Play Integrity); create a **debug token** for Simulator and paste into `appConfig.appCheckDebugToken` while developing  
4. Enforce App Check on Firestore / Functions when you’re ready (start in Monitor mode)

## App Store Connect / Play (blocker for review)

Follow `docs/APP_STORE_SETUP.md` §§2 & 8 until every checkbox is green — especially sandbox purchase + restore.

## Smoke test (both platforms)

- [ ] Fresh install → Sign up → verification email arrives → open link → lands on branded page  
- [ ] Complete onboarding → Home loads  
- [ ] Paywall → product prices from store (not only fallbacks) → sandbox purchase → tier unlocks  
- [ ] Restore purchases  
- [ ] HealthKit / Health Connect permission flow  
- [ ] Clinician: invite code share + email connect → patient appears in Patients  
- [ ] Patient: approve / enter invite code → care plan / messages  
- [ ] Sign out / delete account path  

## Honest remaining gap to a true 10/10

- Server-side **receipt cryptographically verified** with App Store Server API + Google Play Developer API (entitlement sync today trusts authenticated client + known product IDs; still far better than local-only).  
- Broader E2E / Detox coverage.  
- Production monitoring SLOs.
