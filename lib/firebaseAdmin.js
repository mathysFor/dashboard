/**
 * Firebase Admin SDK initialization
 * Used for server-side operations that require elevated privileges
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 
                     process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 
                     'winteracademynew';

    // Check if we have the required environment variables
    if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      console.error('Firebase Admin: Missing required environment variables (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
      throw new Error('Firebase Admin credentials not found in environment variables');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      // Specify the database region if needed (eur3)
      databaseURL: `https://${projectId}.firebaseio.com`,
    });
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

export const adminDb = admin.firestore();
export default admin;

