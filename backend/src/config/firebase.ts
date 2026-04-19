import admin from 'firebase-admin';

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

const getCredential = (): admin.credential.Credential | undefined => {
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    return admin.credential.cert(serviceAccount);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  return undefined;
};

const credential = getCredential();

export const firebaseAdmin = admin.apps.length
  ? admin.app()
  : admin.initializeApp({
      ...(credential ? { credential } : {}),
      ...(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : {}),
    });

export const firebaseAuth = firebaseAdmin.auth();
