"use client";

import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "../../../../../lib/firebase";
import AuthGuard from "../../../../../lib/AuthGuard";

export default function ChallengeRelaunchPage() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [editing, setEditing] = useState(null);
  const [editedData, setEditedData] = useState({});
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Load pending relaunch challenges
  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      setLoading(true);
      const challengesRef = collection(db, "challenges");
      
      // Find challenges that are non_active, not archived, and have an originalChallengeId
      // Note: We filter originalChallengeId in code since Firestore doesn't support != null well
      const q = query(
        challengesRef,
        where("status", "==", "non_active"),
        where("archived", "==", false),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      const challengesList = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        // Filter to only include challenges with originalChallengeId (pending relaunches)
        .filter((challenge) => challenge.originalChallengeId != null);

      setChallenges(challengesList);
    } catch (error) {
      console.error("Error loading challenges:", error);
      showToast("Erreur lors du chargement des challenges", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const handleEdit = (challenge) => {
    setEditing(challenge.id);
    setEditedData({
      title: challenge.title || "",
      subtitle: challenge.subtitle || "",
      prize: challenge.prize || "",
      goal: challenge.goal || "",
    });
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditedData({});
  };

  const handleFieldChange = (field, value) => {
    setEditedData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (challengeId) => {
    try {
      setSaving(true);
      const challengeRef = doc(db, "challenges", challengeId);
      await updateDoc(challengeRef, {
        ...editedData,
        updatedAt: new Date(),
      });

      // Update local state
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challengeId ? { ...c, ...editedData } : c
        )
      );

      setEditing(null);
      setEditedData({});
      showToast("Challenge modifié avec succès", "success");
    } catch (error) {
      console.error("Error saving challenge:", error);
      showToast("Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async (challengeId) => {
    const confirmed = window.confirm(
      "Valider ce relancement ? Le challenge sera activé."
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      const challengeRef = doc(db, "challenges", challengeId);
      await updateDoc(challengeRef, {
        status: "active",
        updatedAt: new Date(),
      });

      // Remove from list (it's now active)
      setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
      showToast("Challenge validé et activé", "success");
    } catch (error) {
      console.error("Error validating challenge:", error);
      showToast("Erreur lors de la validation", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (challengeId) => {
    const confirmed = window.confirm(
      "Supprimer ce relancement ? Cette action est irréversible."
    );
    if (!confirmed) return;

    try {
      setDeleting((prev) => ({ ...prev, [challengeId]: true }));
      const challengeRef = doc(db, "challenges", challengeId);
      await deleteDoc(challengeRef);

      // Remove from list
      setChallenges((prev) => prev.filter((c) => c.id !== challengeId));
      showToast("Relancement supprimé", "success");
    } catch (error) {
      console.error("Error deleting challenge:", error);
      showToast("Erreur lors de la suppression", "error");
    } finally {
      setDeleting((prev) => ({ ...prev, [challengeId]: false }));
    }
  };

  const handleTriggerRelaunch = async () => {
    try {
      setSaving(true);
      const idToken = await auth.currentUser?.getIdToken(true);
      if (!idToken) {
        showToast("Vous devez être authentifié", "error");
        return;
      }

      const response = await fetch("/api/challenges/relaunch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors du déclenchement");
      }

      showToast(
        `${data.processed} challenge(s) traité(s) avec succès`,
        "success"
      );

      // Reload challenges
      await loadChallenges();
    } catch (error) {
      console.error("Error triggering relaunch:", error);
      showToast(error.message || "Erreur lors du déclenchement", "error");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AuthGuard>
      <div className="text-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
          {/* HEADER */}
          <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Relancement des Challenges
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Valider et modifier les challenges en attente de relancement.
              </p>
            </div>

            <button
              onClick={handleTriggerRelaunch}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
            >
              {saving ? (
                <SpinnerIcon className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshIcon className="h-4 w-4" />
              )}
              Déclencher la relance
            </button>
          </header>

          {/* CONTENT */}
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 py-16">
              <SpinnerIcon className="h-8 w-8 animate-spin text-sky-500" />
              <p className="mt-4 text-sm text-slate-400">
                Chargement des challenges...
              </p>
            </div>
          ) : challenges.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 py-16 text-center">
              <CheckIcon className="mb-4 h-12 w-12 text-slate-600" />
              <p className="text-sm text-slate-400">
                Aucun challenge en attente de relancement
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
                >
                  {editing === challenge.id ? (
                    // EDIT MODE
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">
                            Titre
                          </label>
                          <input
                            type="text"
                            value={editedData.title || ""}
                            onChange={(e) =>
                              handleFieldChange("title", e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">
                            Sous-titre
                          </label>
                          <input
                            type="text"
                            value={editedData.subtitle || ""}
                            onChange={(e) =>
                              handleFieldChange("subtitle", e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">
                            Prix
                          </label>
                          <input
                            type="text"
                            value={editedData.prize || ""}
                            onChange={(e) =>
                              handleFieldChange("prize", e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-400">
                            Objectif
                          </label>
                          <input
                            type="text"
                            value={editedData.goal || ""}
                            onChange={(e) =>
                              handleFieldChange("goal", e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSave(challenge.id)}
                          disabled={saving}
                          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
                        >
                          {saving ? "..." : "Enregistrer"}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    // VIEW MODE
                    <>
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-100">
                            {challenge.title || "Sans titre"}
                          </h3>
                          {challenge.subtitle && (
                            <p className="mt-1 text-sm text-slate-400">
                              {challenge.subtitle}
                            </p>
                          )}
                        </div>
                        <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-400">
                          En attente
                        </span>
                      </div>

                      <div className="mb-4 grid gap-4 md:grid-cols-3">
                        <div>
                          <span className="text-xs text-slate-400">Prix</span>
                          <p className="text-sm font-medium text-slate-200">
                            {challenge.prize || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400">Objectif</span>
                          <p className="text-sm font-medium text-slate-200">
                            {challenge.goal || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-slate-400">Deadline</span>
                          <p className="text-sm font-medium text-slate-200">
                            {formatDate(challenge.deadline)}
                          </p>
                        </div>
                      </div>

                      {challenge.originalChallengeId && (
                        <div className="mb-4 text-xs text-slate-500">
                          Challenge original: {challenge.originalChallengeId}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(challenge)}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleValidate(challenge.id)}
                          disabled={saving}
                          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-400 disabled:opacity-50"
                        >
                          {saving ? "..." : "Valider"}
                        </button>
                        <button
                          onClick={() => handleDelete(challenge.id)}
                          disabled={deleting[challenge.id]}
                          className="rounded-lg border border-red-700 bg-red-900/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/40 disabled:opacity-50"
                        >
                          {deleting[challenge.id] ? "..." : "Supprimer"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TOAST */}
          {toast.show && (
            <div
              className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-6 py-3 text-sm font-medium shadow-lg ${
                toast.type === "error"
                  ? "bg-red-500 text-white"
                  : "bg-emerald-500 text-white"
              }`}
            >
              {toast.message}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}

// Icons
function SpinnerIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function RefreshIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 4V10H17" />
      <path d="M1 20V14H7" />
      <path d="M3.51 9A9 9 0 0 1 20.49 4.61L23 7" />
      <path d="M20.49 15A9 9 0 0 1 3.51 19.39L1 17" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

