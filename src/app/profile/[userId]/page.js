import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function ProfilePage({ params }) {
  const headersList = headers();
  const userAgent = headersList.get('user-agent') || '';

  // Détection de la plateforme
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);

  // URLs des stores - À REMPLACER avec les vraies URLs
  const APP_STORE_URL = 'https://apps.apple.com/fr/app/winter-mate/id6752944989'; // Remplacer APP_ID
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.winteracademynew';

  // Redirection selon la plateforme
  if (isIOS) {
    redirect(APP_STORE_URL);
  } else if (isAndroid) {
    redirect(PLAY_STORE_URL);
  } else {
    // Par défaut, rediriger vers Play Store (ou afficher un choix)
    redirect(PLAY_STORE_URL);
  }
}
