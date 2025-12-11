"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Non authentifié, rediriger vers login
        setLoading(false);
        setIsAuthorized(false);
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        // Vérifier si l'utilisateur a SUPER_USER: true dans Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          // Document utilisateur n'existe pas
          console.error("Document utilisateur introuvable dans Firestore");
          setLoading(false);
          setIsAuthorized(false);
          router.push(`/login?redirect=${encodeURIComponent(pathname)}&error=no_user_doc`);
          return;
        }

        const userData = userDocSnap.data();
        if (userData.SUPER_USER !== true) {
          // Pas de permission SUPER_USER
          console.error("Accès refusé : SUPER_USER requis");
          setLoading(false);
          setIsAuthorized(false);
          router.push(`/login?redirect=${encodeURIComponent(pathname)}&error=unauthorized`);
          return;
        }

        // Utilisateur autorisé
        setLoading(false);
        setIsAuthorized(true);
      } catch (error) {
        console.error("Erreur lors de la vérification des permissions:", error);
        setLoading(false);
        setIsAuthorized(false);
        router.push(`/login?redirect=${encodeURIComponent(pathname)}&error=check_failed`);
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-500 border-r-transparent"></div>
          <p className="text-sm text-slate-400">Vérification de l'authentification...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
