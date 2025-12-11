"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import AuthGuard from "../../../lib/AuthGuard";

export default function LevelsPage() {
  const router = useRouter();
  const [seances, setSeances] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSeances() {
      try {
        setLoading(true);
        setError(null);

        const ref = collection(db, "seances");
        const snap = await getDocs(ref);

        const data = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Tri simple par titre pour avoir quelque chose de stable
        data.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

        setSeances(data);
      } catch (err) {
        console.error("[Seances] Error fetching seances", err);
        setError(err?.message || "Erreur inattendue");
      } finally {
        setLoading(false);
      }
    }

    fetchSeances();
  }, []);

  function handleOpenSeance(seanceId) {
    router.push(`/control?sessionId=${seanceId}`);
  }

  async function handleRenameSeance(seance) {
    const currentTitle = seance.title || "";
    const newName = window.prompt("Nouveau titre de la séance :", currentTitle);
    if (!newName || !newName.trim() || newName.trim() === currentTitle) {
      return;
    }

    try {
      const ref = doc(db, "seances", seance.id);
      await updateDoc(ref, { title: newName.trim() });

      setSeances((prev) =>
        prev.map((s) =>
          s.id === seance.id ? { ...s, title: newName.trim() } : s
        )
      );
    } catch (err) {
      console.error("[Seances] Error renaming seance", err);
      alert("Erreur lors du renommage de la séance.");
    }
  }

  async function handleCreateSeance(e) {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError("Le titre de la séance est obligatoire.");
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);

      const ref = collection(db, "seances");
      const docRef = await addDoc(ref, {
        title: newTitle.trim(),
        seanceExercises: [],
      });

      setSeances((prev) =>
        [...prev, { id: docRef.id, title: newTitle.trim(), seanceExercises: [] }].sort(
          (a, b) => (a.title || "").localeCompare(b.title || "")
        )
      );
      setNewTitle("");
    } catch (err) {
      console.error("[Seances] Error creating seance", err);
      setCreateError(err?.message || "Erreur lors de la création de la séance.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <AuthGuard>
      <main className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Gérer les séances</h2>
        <p className="text-xs text-slate-400">
          Cette page liste toutes les séances disponibles dans Firestore.
        </p>
      </div>

      <form
        onSubmit={handleCreateSeance}
        className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:flex-row sm:items-center"
      >
        <div className="flex-1 space-y-1">
          <label className="text-xs text-slate-400">Nouvelle séance</label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
            placeholder="Ex: Déb 1 – Premiers virages"
          />
        </div>
        <button
          type="submit"
          disabled={creating}
          className="mt-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-60 sm:mt-6"
        >
          {creating ? "Création..." : "Créer la séance"}
        </button>
      </form>

      {createError && (
        <p className="text-xs text-red-400">{createError}</p>
      )}

      {loading && (
        <p className="text-sm text-slate-400">Chargement des niveaux…</p>
      )}

      {error && (
        <p className="text-sm text-red-400">Erreur : {error}</p>
      )}

      {!loading && !error && seances.length === 0 && (
        <p className="text-sm text-slate-400">
          Aucune séance pour l&apos;instant. Crée-en une ci-dessus ou ajoute des
          documents dans la collection
          <span className="font-mono"> seances </span>
          via la console Firebase.
        </p>
      )}

      {!loading && !error && seances.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {seances.map((seance) => (
            <div
              key={seance.id}
              className="flex flex-col items-start rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-left shadow-sm"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div>
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    Séance
                  </span>
                  <h3 className="mt-1 text-sm font-semibold text-slate-50">
                    {seance.title || "Séance sans titre"}
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {Array.isArray(seance.seanceExercises)
                      ? `${seance.seanceExercises.length} exercice(s)`
                      : "0 exercice"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenSeance(seance.id)}
                    className="rounded-lg border border-slate-600 px-3 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Ouvrir
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRenameSeance(seance)}
                    className="text-[10px] text-sky-400 hover:underline"
                  >
                    Renommer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
    </AuthGuard>
  );
}