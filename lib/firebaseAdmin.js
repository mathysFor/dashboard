/**
 * Firebase Admin SDK initialization
 * Used for server-side operations that require elevated privileges
 */

import admin from 'firebase-admin';
import serviceAccount from '../service-account.json';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
      }),
      // Specify the database region if needed (eur3)
      databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

export const adminDb = admin.firestore();
export default admin;

