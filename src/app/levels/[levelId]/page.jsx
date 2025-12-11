// app/levels/[levelId]/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  addDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../../lib/firebase";

export default function LevelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const levelId = params.levelId;

  const [level, setLevel] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // state formulaire création
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [order, setOrder] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Charge le niveau + ses séances
  useEffect(() => {
    if (!levelId) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Niveau
        const levelRef = doc(db, "levels", levelId);
        const levelSnap = await getDoc(levelRef);
        if (!levelSnap.exists()) {
          setError("Niveau introuvable.");
          setLoading(false);
          return;
        }
        setLevel({ id: levelSnap.id, ...levelSnap.data() });

        // Séances de ce niveau
        const sessionsRef = collection(db, "sessions");
        const q = query(
          sessionsRef,
          where("levelId", "==", levelId),
          orderBy("order", "asc")
        );
        const snap = await getDocs(q);

        const data = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setSessions(data);
      } catch (err) {
        console.error("[LevelDetail] Error", err);
        setError(err?.message || "Erreur inattendue");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [levelId]);

  async function handleCreateSession(e) {
    e.preventDefault();
    setSaveError(null);

    if (!title.trim()) {
      setSaveError("Titre obligatoire.");
      return;
    }

    const parsedOrder = Number(order);
    if (Number.isNaN(parsedOrder)) {
      setSaveError("L’ordre doit être un nombre (ex: 1, 2, 3…).");
      return;
    }

    try {
      setSaving(true);

      const sessionsRef = collection(db, "sessions");
      const docRef = await addDoc(sessionsRef, {
        levelId,
        title: title.trim(),
        order: parsedOrder,
        shortDescription: "",
        thumbnailUrl: "",
        isPublished: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Optimiste : on rajoute direct dans la liste
      setSessions((prev) => [
        ...prev,
        {
          id: docRef.id,
          levelId,
          title: title.trim(),
          order: parsedOrder,
          shortDescription: "",
          thumbnailUrl: "",
          isPublished: false,
        },
      ].sort((a, b) => a.order - b.order));

      setTitle("");
      setOrder("");
      setFormOpen(false);
    } catch (err) {
      console.error("[CreateSession] Error", err);
      setSaveError(err?.message || "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-4">
      {/* Header + breadcrumb simple */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/levels")}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            ← Retour aux niveaux
          </button>
          <div>
            <h2 className="text-lg font-semibold">
              {level ? level.title : "Niveau"}
            </h2>
            {level && (
              <p className="text-xs text-slate-400">
                Ordre {level.order} · {level.isPublished ? "Publié" : "Brouillon"}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-800"
          onClick={() => setFormOpen((v) => !v)}
        >
          {formOpen ? "Annuler" : "+ Nouvelle séance"}
        </button>
      </div>

      {loading && (
        <p className="text-sm text-slate-400">Chargement des séances…</p>
      )}

      {error && (
        <p className="text-sm text-red-400">
          Erreur : {error}
        </p>
      )}

      {/* Formulaire création séance */}
      {formOpen && !loading && !error && (
        <form
          onSubmit={handleCreateSession}
          className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
        >
          <h3 className="text-sm font-medium text-slate-100">
            Ajouter une nouvelle séance
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Titre</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
                placeholder="Ex: Contrôle de la vitesse"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Ordre</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
                placeholder="Ex: 1"
              />
            </div>
          </div>

          {saveError && (
            <p className="text-xs text-red-400">{saveError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setSaveError(null);
              }}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-60"
            >
              {saving ? "Enregistrement..." : "Créer la séance"}
            </button>
          </div>
        </form>
      )}

      {/* Liste des séances */}
      {!loading && !error && sessions.length === 0 && (
        <p className="text-sm text-slate-400">
          Aucune séance pour l’instant. Crée ta première séance avec le bouton ci-dessus.
        </p>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-slate-900/60">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-400">
                  Ordre
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-400">
                  Titre
                </th>
                <th className="px-4 py-2 text-left font-medium text-slate-400">
                  Statut
                </th>
                <th className="px-4 py-2 text-right font-medium text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr
                  key={session.id}
                  className="border-t border-slate-800 hover:bg-slate-900/40"
                >
                  <td className="px-4 py-2 align-middle text-slate-200">
                    {session.order ?? "—"}
                  </td>
                  <td className="px-4 py-2 align-middle text-slate-50">
                    {session.title}
                  </td>
                  <td className="px-4 py-2 align-middle">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        session.isPublished
                          ? "bg-green-500/10 text-green-400 border border-green-500/30"
                          : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                      }`}
                    >
                      {session.isPublished ? "Publié" : "Brouillon"}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-middle text-right">
                    <button
                      type="button"
                      className="text-xs font-medium text-sky-400 hover:underline"
                      onClick={() => {
                        router.push(`/control?sessionId=${session.id}`);
                      }}
                    >
                      Ouvrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}