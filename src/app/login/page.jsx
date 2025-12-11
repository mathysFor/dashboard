"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../lib/firebase";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Afficher les erreurs depuis les paramètres URL
    if (errorParam === "no_user_doc") {
      setError("Document utilisateur introuvable dans Firestore.");
    } else if (errorParam === "unauthorized") {
      setError("Accès refusé. Vous n'avez pas les permissions nécessaires.");
    } else if (errorParam === "check_failed") {
      setError("Erreur lors de la vérification des permissions.");
    }
  }, [errorParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        // Création de compte
        await createUserWithEmailAndPassword(auth, email, password);
        // Après création, l'utilisateur doit avoir SUPER_USER ajouté manuellement
        setError(
          "Compte créé avec succès. Contactez l'administrateur pour activer l'accès SUPER_USER."
        );
        setIsSignUp(false);
      } else {
        // Connexion
        await signInWithEmailAndPassword(auth, email, password);
        // La redirection sera gérée par AuthGuard
        router.push(redirect);
      }
    } catch (err) {
      console.error("Erreur d'authentification:", err);
      let errorMessage = "Une erreur est survenue.";

      switch (err.code) {
        case "auth/invalid-email":
          errorMessage = "Email invalide.";
          break;
        case "auth/user-disabled":
          errorMessage = "Ce compte a été désactivé.";
          break;
        case "auth/user-not-found":
          errorMessage = "Aucun compte trouvé avec cet email.";
          break;
        case "auth/wrong-password":
          errorMessage = "Mot de passe incorrect.";
          break;
        case "auth/email-already-in-use":
          errorMessage = "Cet email est déjà utilisé.";
          break;
        case "auth/weak-password":
          errorMessage = "Le mot de passe est trop faible (minimum 6 caractères).";
          break;
        case "auth/operation-not-allowed":
          errorMessage = "Cette opération n'est pas autorisée.";
          break;
        default:
          errorMessage = err.message || "Erreur d'authentification.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-50">
            {isSignUp ? "Créer un compte" : "Connexion"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {isSignUp
              ? "Créez un compte pour accéder au backoffice"
              : "Connectez-vous pour accéder au backoffice"}
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              placeholder="votre@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading
              ? "Chargement..."
              : isSignUp
                ? "Créer le compte"
                : "Se connecter"}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="text-sm text-sky-400 hover:underline"
            disabled={loading}
          >
            {isSignUp
              ? "Déjà un compte ? Se connecter"
              : "Pas encore de compte ? Créer un compte"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-slate-50">Chargement...</h1>
          </div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
