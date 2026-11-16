import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

const PRODUCT_TIERS: Record<string, 'growth' | 'pro'> = {
  'com.wellnessshift.growth.monthly': 'growth',
  'com.wellnessshift.growth.yearly': 'growth',
  'com.wellnessshift.pro.monthly': 'pro',
  'com.wellnessshift.pro.yearly': 'pro',
};

type PatientHit = {
  uid: string;
  email: string;
  displayName: string;
  linkedClinicianId?: string;
};

function assertAuthed(uid: string | undefined): asserts uid is string {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
}

async function assertClinician(uid: string) {
  const doc = await getFirestore().collection('clinicians').doc(uid).get();
  if (!doc.exists) {
    throw new HttpsError('permission-denied', 'Clinician profile required.');
  }
}

async function findPatientByEmail(email: string): Promise<PatientHit | null> {
  const normalized = email.trim().toLowerCase();
  const patients = await getFirestore()
    .collection('patients')
    .where('email', '==', normalized)
    .limit(1)
    .get();
  if (!patients.empty) {
    const doc = patients.docs[0];
    const data = doc.data();
    return {
      uid: doc.id,
      email: (data.email as string) ?? normalized,
      displayName: (data.name as string) ?? 'Patient',
      linkedClinicianId: data.linkedClinicianId as string | undefined,
    };
  }

  const users = await getFirestore()
    .collection('users')
    .where('email', '==', normalized)
    .limit(1)
    .get();
  if (users.empty) return null;
  const doc = users.docs[0];
  const data = doc.data();
  if (data.role === 'clinician') return null;
  return {
    uid: doc.id,
    email: (data.email as string) ?? normalized,
    displayName: (data.displayName as string) ?? (data.name as string) ?? 'Patient',
    linkedClinicianId: data.clinicianId as string | undefined,
  };
}

/**
 * Clinician → patient connection by email (Admin lookup; no broad client reads).
 */
export const sendClinicianConnectionRequest = onCall(
  { region: 'us-central1' },
  async (request) => {
    const clinicianId = request.auth?.uid;
    assertAuthed(clinicianId);
    await assertClinician(clinicianId);

    const patientEmail = String(request.data?.patientEmail ?? '').trim();
    if (!patientEmail || !patientEmail.includes('@')) {
      throw new HttpsError('invalid-argument', 'A valid patient email is required.');
    }

    const patient = await findPatientByEmail(patientEmail);
    if (!patient) {
      throw new HttpsError('not-found', 'No patient account found with that email.');
    }
    if (patient.uid === clinicianId) {
      throw new HttpsError('invalid-argument', 'You cannot connect to yourself.');
    }

    const db = getFirestore();
    const mirror = await db
      .collection('clinicians')
      .doc(clinicianId)
      .collection('linkedPatients')
      .doc(patient.uid)
      .get();

    const alreadyLinked = patient.linkedClinicianId === clinicianId || mirror.exists;

    if (alreadyLinked) {
      const clinicianDoc = await db.collection('users').doc(clinicianId).get();
      const clinicianName =
        (clinicianDoc.data()?.displayName as string) ||
        (clinicianDoc.data()?.name as string) ||
        'Clinician';
      await db
        .collection('clinicians')
        .doc(clinicianId)
        .collection('linkedPatients')
        .doc(patient.uid)
        .set(
          {
            patientId: patient.uid,
            patientName: patient.displayName,
            patientEmail: patient.email,
            linkedAt: new Date().toISOString(),
            patientStatus: 'active',
          },
          { merge: true },
        );
      await db
        .collection('users')
        .doc(clinicianId)
        .set({ linkedPatients: FieldValue.arrayUnion(patient.uid) }, { merge: true });
      return {
        alreadyLinked: true,
        patientId: patient.uid,
        clinicianId,
        clinicianName,
      };
    }

    if (patient.linkedClinicianId && patient.linkedClinicianId !== clinicianId) {
      throw new HttpsError(
        'failed-precondition',
        'This patient is already linked to another clinician.',
      );
    }

    const existing = await db
      .collection('patients')
      .doc(patient.uid)
      .collection('pendingClinicianRequests')
      .where('clinicianId', '==', clinicianId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new HttpsError('already-exists', 'A pending request already exists for this patient.');
    }

    const clinicianDoc = await db.collection('users').doc(clinicianId).get();
    const clinicianName =
      (clinicianDoc.data()?.displayName as string) ||
      (clinicianDoc.data()?.name as string) ||
      'Clinician';

    const requestId = `req_${Date.now()}`;
    const now = new Date().toISOString();
    const payload = {
      id: requestId,
      clinicianId,
      clinicianName,
      patientId: patient.uid,
      patientName: patient.displayName,
      patientEmail: patient.email,
      requestedAt: now,
      status: 'pending' as const,
    };

    await db
      .collection('patients')
      .doc(patient.uid)
      .collection('pendingClinicianRequests')
      .doc(requestId)
      .set(payload);
    await db
      .collection('clinicians')
      .doc(clinicianId)
      .collection('outgoingRequests')
      .doc(requestId)
      .set(payload);

    return { alreadyLinked: false, request: payload };
  },
);

/**
 * Persist subscription entitlement after a store purchase/restore.
 * Clients cannot write entitlements/{uid} directly.
 */
export const syncSubscriptionEntitlement = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);

    const productId = String(request.data?.productId ?? '');
    const platform = String(request.data?.platform ?? '');
    const transactionId = String(request.data?.transactionId ?? '');
    const clear = Boolean(request.data?.clear);

    const db = getFirestore();
    const ref = db.collection('entitlements').doc(uid);

    if (clear) {
      await ref.set(
        {
          tier: 'free',
          productId: null,
          platform: platform || null,
          updatedAt: new Date().toISOString(),
          source: 'client_store_sync',
        },
        { merge: true },
      );
      await db.collection('users').doc(uid).set({ subscriptionTier: 'free' }, { merge: true });
      return { tier: 'free' };
    }

    const tier = PRODUCT_TIERS[productId];
    if (!tier) {
      throw new HttpsError('invalid-argument', 'Unknown subscription product.');
    }
    if (platform !== 'ios' && platform !== 'android') {
      throw new HttpsError('invalid-argument', 'platform must be ios or android.');
    }

    await ref.set(
      {
        tier,
        productId,
        platform,
        transactionId: transactionId || null,
        updatedAt: new Date().toISOString(),
        source: 'client_store_sync',
        verified: false,
      },
      { merge: true },
    );
    await db.collection('users').doc(uid).set({ subscriptionTier: tier }, { merge: true });
    return { tier, productId };
  },
);

/**
 * Generate a branded verification email when SMTP is configured; otherwise
 * instruct the client to use Firebase Auth's default sendEmailVerification.
 */
export const sendBrandedVerificationEmail = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    assertAuthed(uid);

    const user = await getAuth().getUser(uid);
    if (!user.email) {
      throw new HttpsError('failed-precondition', 'Account has no email.');
    }
    if (user.emailVerified) {
      return { alreadyVerified: true, sent: false };
    }

    const continueUrl =
      String(request.data?.continueUrl ?? '') ||
      'https://wellnessshift-rn-ios.firebaseapp.com/email-verified.html';

    const link = await getAuth().generateEmailVerificationLink(user.email, {
      url: continueUrl,
      handleCodeInApp: false,
    });

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || 'Wellness Shift <noreply@wellnesshift.co.uk>';

    if (!smtpHost || !smtpUser || !smtpPass) {
      return { sent: false, useClientFallback: true, linkGenerated: true };
    }

    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });

    const html = brandedVerificationHtml(user.email, link);
    await transporter.sendMail({
      from,
      to: user.email,
      subject: 'Verify your email for Wellness Shift',
      html,
      text: `Hello,\n\nVerify your Wellness Shift email:\n${link}\n\nIf you didn't create an account, you can ignore this email.\n\nThanks,\nThe Wellness Shift team`,
    });

    return { sent: true, useClientFallback: false };
  },
);

function brandedVerificationHtml(email: string, link: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F0F2F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F0F2F8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#F24D80,#FF6699);padding:28px 24px;text-align:center;">
          <div style="color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">Wellness Shift</div>
          <div style="color:rgba(255,255,255,0.92);font-size:14px;margin-top:6px;">Confirm your email</div>
        </td></tr>
        <tr><td style="padding:28px 24px;color:#1C1C1E;">
          <p style="margin:0 0 12px;font-size:16px;">Hello,</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#6C6C70;">
            Thanks for joining Wellness Shift. Tap the button below to verify
            <strong style="color:#1C1C1E;">${email}</strong> and finish setting up your account.
          </p>
          <p style="text-align:center;margin:28px 0;">
            <a href="${link}" style="display:inline-block;background:#F24D80;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:999px;">Verify email</a>
          </p>
          <p style="margin:0 0 12px;font-size:13px;line-height:1.45;color:#AEAEB2;">
            If the button doesn’t work, copy and paste this link into your browser:<br/>
            <a href="${link}" style="color:#007AFF;word-break:break-all;">${link}</a>
          </p>
          <p style="margin:20px 0 0;font-size:13px;color:#AEAEB2;">If you didn’t create this account, you can ignore this email.</p>
          <p style="margin:16px 0 0;font-size:14px;color:#1C1C1E;">Thanks,<br/><strong>The Wellness Shift team</strong></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
