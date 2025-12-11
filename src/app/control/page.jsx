"use client";

import { useEffect, useState } from "react";
// Options pour les niveaux de difficulté
const DIFFICULTY_OPTIONS = [
  { value: "debutant", label: "Débutant" },
  { value: "intermediaire", label: "Intermédiaire" },
  { value: "avance", label: "Expert" },
  { value: "freestyle", label: "Freestyle" },
  { value: "freeride", label: "Freeride" },
];

// Options pour les tags d'exercice
const TAG_OPTIONS = [
  // Objectifs techniques
  { value: "equilibre", label: "Équilibre" },
  { value: "appuis", label: "Appuis" },
  { value: "carving", label: "Carving" },
  { value: "position_corps", label: "Position du corps" },
  { value: "gestion_vitesse", label: "Gestion de la vitesse" },
  { value: "transfert_appuis", label: "Transfert d’appuis" },
  { value: "prise_de_carres", label: "Prise de carres" },

  // Terrain
  { value: "piste", label: "Piste" },
  { value: "bord_de_piste", label: "Bord de piste" },
  { value: "poudreuse", label: "Poudreuse" },
  { value: "bosse", label: "Bosses" },
  { value: "freeride_steep", label: "Pente raide" },

  // Erreurs fréquentes
  { value: "assiette_arriere", label: "Assiette arrière" },
  { value: "epaules_ouvertes", label: "Épaules ouvertes" },
  { value: "pieds_colles", label: "Pieds collés" },

  // Type d’exercice
  { value: "echauffement", label: "Échauffement" },
  { value: "exercice_pedagogique", label: "Exercice pédagogique" },
  { value: "jeu", label: "Jeu" },
  { value: "challenge", label: "Challenge" },

   // Fondamentaux
  { value: "centrage", label: "Centrage" },
  { value: "charge", label: "Charge" },
  { value: "angle", label: "Angle" },
  { value: "pivotement", label: "Pivotement" },
  {value : 'independance_de_jambe', label : 'Indépendance de jambe'},


  //D2FI
  {value:"defi" ,label:"Défi"},
];
import { useSearchParams, useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  doc,
  addDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import AuthGuard from "../../../lib/AuthGuard";

export default function ControlPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");

  const [session, setSession] = useState(null);
  const [level, setLevel] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDifficulty, setNewDifficulty] = useState("debutant");
  const [newTags, setNewTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // State for editing an exercise
  const [editingExo, setEditingExo] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editOrder, setEditOrder] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("debutant");
  const [editTags, setEditTags] = useState([]);
  const [editVideoFile, setEditVideoFile] = useState(null);
  const [editUploadError, setEditUploadError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setError("Aucune séance sélectionnée (sessionId manquant).");
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 1) Récupère la séance
        const sessionRef = doc(db, "seances", sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (!sessionSnap.exists()) {
          setError("Séance introuvable.");
          setLoading(false);
          return;
        }

        const sessionData = { id: sessionSnap.id, ...sessionSnap.data() };
        setSession(sessionData);

        // 2) Récupère le niveau associé (optionnel mais pratique pour le contexte)
        if (sessionData.levelId) {
          const levelRef = doc(db, "levels", sessionData.levelId);
          const levelSnap = await getDoc(levelRef);
          if (levelSnap.exists()) {
            setLevel({ id: levelSnap.id, ...levelSnap.data() });
          }
        }

        // 3) Récupère les exercices de cette séance
        let exoData = [];

        // Cas 1 : on a déjà un tableau d'IDs d'exos dans la séance (ancien système ou nouveau)
        if (
          Array.isArray(sessionData.seanceExercises) &&
          sessionData.seanceExercises.length > 0
        ) {
          const ids = sessionData.seanceExercises;

          const promises = ids.map(async (exoId, index) => {
            try {
              const exoRef = doc(db, "exercises", exoId);
              const exoSnap = await getDoc(exoRef);
              if (!exoSnap.exists()) return null;

              return {
                id: exoSnap.id,
                _seanceIndex: index, // pour garder l'ordre du tableau
                ...exoSnap.data(),
              };
            } catch (e) {
              console.error("[ControlPage] Error fetching exercise by id", e);
              return null;
            }
          });

          const resolved = await Promise.all(promises);
          exoData = resolved.filter(Boolean);

          // on tri d'abord par la position dans le tableau de la séance,
          // puis par le champ "order" s'il existe
          exoData.sort((a, b) => {
            const ai = a._seanceIndex ?? 0;
            const bi = b._seanceIndex ?? 0;
            if (ai !== bi) return ai - bi;
            return (a.order ?? 0) - (b.order ?? 0);
          });
        } else {
          // Cas 2 : fallback sur l'ancien système basé sur le champ sessionId
          const exercisesRef = collection(db, "exercises");
          const qExo = query(
            exercisesRef,
            where("sessionId", "==", sessionId),
            orderBy("order", "asc")
          );
          const exoSnap = await getDocs(qExo);

          exoData = exoSnap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
        }

        setExercises(exoData);
      } catch (err) {
        console.error("[ControlPage] Error loading data", err);
        setError(err?.message || "Erreur inattendue");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [sessionId]);

  async function handleCreateExercise(e) {
    e.preventDefault();
    setSaveError(null);
    setUploadError(null);

    if (!sessionId) {
      setSaveError("Séance introuvable (sessionId manquant).");
      return;
    }

    if (!newTitle.trim()) {
      setSaveError("Le titre est obligatoire.");
      return;
    }

    const parsedOrder = Number(newOrder);
    if (Number.isNaN(parsedOrder)) {
      setSaveError("L’ordre doit être un nombre (ex: 1, 2, 3…).");
      return;
    }

    try {
      setSaving(true);

      let videoId = null;
      let videoUrl = null;
      let thumbnail = null;

      // 1) Si une vidéo est sélectionnée, on prépare un upload direct Cloudflare
      if (videoFile) {
        const res = await fetch("/api/cloudflare-direct-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: videoFile.name,
            size: videoFile.size,
            type: videoFile.type,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("[ControlPage] Error preparing upload:", text);
          setUploadError("Erreur lors de la préparation de l’upload vidéo.");
          setSaving(false);
          return;
        }

        const payload = await res.json();
        const uploadURL = payload?.uploadURL;
        videoId = payload?.uid || null;
        videoUrl = payload?.playback?.hls || null;
        thumbnail = payload?.thumbnail || null;

        if (!uploadURL || !videoId) {
          setUploadError("Réponse Cloudflare invalide.");
          setSaving(false);
          return;
        }

        console.log("[ControlPage] Uploading to Cloudflare:", uploadURL);

        const formData = new FormData();
        // Cloudflare attend généralement un champ 'file' en multipart/form-data
        formData.append("file", videoFile);

        const uploadRes = await fetch(uploadURL, {
          method: "POST",
          body: formData,
        });

        console.log(
          "[ControlPage] Upload response:",
          uploadRes.status,
          uploadRes.statusText
        );

        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => "");
          console.error("[ControlPage] Upload failed body:", errText);
          setUploadError("Upload vidéo échoué.");
          setSaving(false);
          return;
        }
      }

      // 2) Création du doc Firestore une fois l’upload (si présent) terminé
      const exercisesRef = collection(db, "exercises");
      const docRef = await addDoc(exercisesRef, {
        sessionId,
        levelId: session?.levelId || null,
        titre: newTitle.trim(),
        order: parsedOrder,
        description: newDescription.trim(),
        difficulty: newDifficulty,
        tags: newTags,
        durationSeconds: null,
        likesCount: 0,
        commentsCount: 0,
        isPublished: false,
        videoId: videoId,
        videoUrl: videoUrl,
        urlvideo: videoUrl,
        thumbnail: thumbnail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2bis) Ajoute l'ID de l'exercice dans le tableau seanceExercises de la séance
      try {
        const seanceRef = doc(db, "seances", sessionId);
        await updateDoc(seanceRef, {
          seanceExercises: arrayUnion(docRef.id),
        });
      } catch (err) {
        console.error("[ControlPage] Error updating seanceExercises", err);
        // On n'empêche pas la création de l'exercice si cette mise à jour échoue
      }

      // Ajout optimiste dans la liste locale
      setExercises((prev) =>
        [
          ...prev,
          {
            id: docRef.id,
            sessionId,
            levelId: session?.levelId || null,
            titre: newTitle.trim(),
            order: parsedOrder,
            description: newDescription.trim(),
            difficulty: newDifficulty,
            tags: newTags,
            durationSeconds: null,
            likesCount: 0,
            commentsCount: 0,
            isPublished: false,
            videoId,
            videoUrl,
            urlvideo: videoUrl,
            thumbnail,
          },
        ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      );

      setNewTitle("");
      setNewOrder("");
      setNewDescription("");
      setNewDifficulty("debutant");
      setNewTags([]);
      setVideoFile(null);
      setFormOpen(false);
    } catch (err) {
      console.error("[ControlPage] Error creating exercise", err);
      setSaveError(err?.message || "Erreur lors de la création de l’exercice.");
    } finally {
      setSaving(false);
    }
  }

  function handleBackToLevel() {
    if (session?.levelId) {
      router.push(`/levels/${session.levelId}`);
    } else {
      router.push("/levels");
    }
  }

  return (
    <AuthGuard>
      <main className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBackToLevel}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            ← Retour
          </button>
          <div>
            <h2 className="text-lg font-semibold">
              {session ? session.title : "Séance"}
            </h2>
            <p className="text-xs text-slate-400">
              {level ? `Niveau : ${level.title}` : "Séance de coaching"}
            </p>
          </div>
        </div>

        {!loading && !error && (
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium hover:bg-slate-800"
          >
            {formOpen ? "Annuler" : "+ Nouvel exercice"}
          </button>
        )}
      </div>

      {formOpen && !loading && !error && (
        <form
          onSubmit={handleCreateExercise}
          className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4"
        >
          <h3 className="text-sm font-medium text-slate-100">
            Ajouter un nouvel exercice
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-slate-400">Titre</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
                placeholder="Ex: Exercice 1 – Appuis extérieurs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Ordre</label>
              <input
                type="number"
                value={newOrder}
                onChange={(e) => setNewOrder(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
                placeholder="Ex: 1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Niveau</label>
              <select
                value={newDifficulty}
                onChange={(e) => setNewDifficulty(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
              >
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Description (optionnel)</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
              placeholder="Objectifs, consignes, erreurs fréquentes…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Tags (optionnel)</label>
            <p className="text-[11px] text-slate-500">
              Sélectionne quelques tags pour faciliter la recherche (objectif, terrain, type d&apos;exercice…)
            </p>
            <div className="mt-1 grid max-h-40 grid-cols-2 gap-1 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-2 text-[11px] sm:grid-cols-3">
              {TAG_OPTIONS.map((tag) => {
                const checked = newTags.includes(tag.value);
                return (
                  <label
                    key={tag.value}
                    className="flex cursor-pointer items-center gap-1 text-slate-300"
                  >
                    <input
                      type="checkbox"
                      className="h-3 w-3 accent-sky-500"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewTags((prev) =>
                            prev.includes(tag.value)
                              ? prev
                              : [...prev, tag.value]
                          );
                        } else {
                          setNewTags((prev) =>
                            prev.filter((t) => t !== tag.value)
                          );
                        }
                      }}
                    />
                    <span>{tag.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">
              Vidéo (optionnel pour l’instant)
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file =
                  e.target.files && e.target.files[0] ? e.target.files[0] : null;
                setVideoFile(file);
              }}
              className="w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-50 hover:file:bg-slate-700"
            />
            {videoFile && (
              <p className="text-[11px] text-slate-500">
                Fichier sélectionné : {videoFile.name}
              </p>
            )}
          </div>

          {saveError && (
            <p className="text-xs text-red-400">{saveError}</p>
          )}
          {uploadError && (
            <p className="text-xs text-red-400">{uploadError}</p>
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
              {saving ? "Enregistrement..." : "Créer l'exercice"}
            </button>
          </div>
        </form>
      )}

      {loading && (
        <p className="text-sm text-slate-400">Chargement des exercices…</p>
      )}

      {error && (
        <p className="text-sm text-red-400">Erreur : {error}</p>
      )}

      {!loading && !error && exercises.length === 0 && (
        <p className="text-sm text-slate-400">
          Aucun exercice pour cette séance pour l&apos;instant.
        </p>
      )}

      {!loading && !error && exercises.length > 0 && (
        <div className="space-y-3">
          {exercises.map((exo) => (
            <div
              key={exo.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    Exercice {exo.order ?? ""}
                  </p>
                  <h3 className="text-sm font-semibold text-slate-50">
                    {exo.titre || "Exercice sans titre"}
                  </h3>
                  {exo.difficulty && (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Niveau :{" "}
                      {
                        (DIFFICULTY_OPTIONS.find(
                          (opt) => opt.value === exo.difficulty
                        ) || { label: exo.difficulty }
                      ).label
                      }
                    </p>
                  )}
                  {Array.isArray(exo.tags) && exo.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {exo.tags.map((tag) => {
                        const meta =
                          TAG_OPTIONS.find((t) => t.value === tag) || null;
                        return (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-200"
                          >
                            {meta ? meta.label : tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {exo.durationSeconds && (
                  <span className="text-[11px] text-slate-400">
                    {(exo.durationSeconds / 60).toFixed(1)} min
                  </span>
                )}
              </div>

              {exo.description && (
                <p className="text-xs text-slate-400 whitespace-pre-line">
                  {exo.description}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-slate-500">
                  {exo.likesCount ?? 0} likes · {exo.commentsCount ?? 0} coms
                </div>

                <button
                  type="button"
                  className="text-[11px] font-medium text-sky-400 hover:underline"
                  onClick={() => {
                    setEditError(null);
                    setEditUploadError(null);
                    setEditingExo(exo);
                    setEditTitle(exo.titre || "");
                    setEditOrder(
                      typeof exo.order === "number" ? String(exo.order) : ""
                    );
                    setEditDescription(exo.description || "");
                    setEditDifficulty(exo.difficulty || "debutant");
                    setEditTags(
                      Array.isArray(exo.tags) ? exo.tags : []
                    );
                    setEditVideoFile(null);
                  }}
                >
                  Éditer l&apos;exercice
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingExo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-50">
              Éditer l&apos;exercice
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              ID : <span className="font-mono text-[10px]">{editingExo.id}</span>
            </p>

            <form
              className="mt-3 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setEditError(null);

                if (!editTitle.trim()) {
                  setEditError("Le titre est obligatoire.");
                  return;
                }

                const parsedOrder = Number(editOrder);
                if (Number.isNaN(parsedOrder)) {
                  setEditError("L’ordre doit être un nombre (ex: 1, 2, 3…).");
                  return;
                }

                try {
                  setEditing(true);
                  setEditUploadError(null);

                  let videoId = editingExo.videoId ?? null;
                  let videoUrl =
                    editingExo.videoUrl ?? editingExo.urlvideo ?? null;
                  let thumbnail = editingExo.thumbnail ?? null;

                  // Si un nouveau fichier vidéo est sélectionné, on remplace la vidéo existante
                  if (editVideoFile) {
                    const res = await fetch("/api/cloudflare-direct-upload", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        filename: editVideoFile.name,
                        size: editVideoFile.size,
                        type: editVideoFile.type,
                      }),
                    });

                    if (!res.ok) {
                      const text = await res.text().catch(() => "");
                      console.error("[ControlPage] Error preparing edit upload:", text);
                      setEditUploadError(
                        "Erreur lors de la préparation de l’upload vidéo."
                      );
                      setEditing(false);
                      return;
                    }

                    const payload = await res.json();
                    const uploadURL = payload?.uploadURL;
                    videoId = payload?.uid || null;
                    videoUrl = payload?.playback?.hls || null;
                    thumbnail = payload?.thumbnail || null;

                    if (!uploadURL || !videoId) {
                      setEditUploadError("Réponse Cloudflare invalide.");
                      setEditing(false);
                      return;
                    }

                    console.log("[ControlPage] Uploading edited video to Cloudflare:", uploadURL);

                    const formData = new FormData();
                    formData.append("file", editVideoFile);

                    const uploadRes = await fetch(uploadURL, {
                      method: "POST",
                      body: formData,
                    });

                    console.log(
                      "[ControlPage] Edit upload response:",
                      uploadRes.status,
                      uploadRes.statusText
                    );

                    if (!uploadRes.ok) {
                      const errText = await uploadRes.text().catch(() => "");
                      console.error("[ControlPage] Edit upload failed body:", errText);
                      setEditUploadError("Upload vidéo échoué.");
                      setEditing(false);
                      return;
                    }
                  }

                  const exoRef = doc(db, "exercises", editingExo.id);
                  await updateDoc(exoRef, {
                    titre: editTitle.trim(),
                    order: parsedOrder,
                    description: editDescription.trim(),
                    difficulty: editDifficulty,
                    tags: editTags,
                    videoId: videoId,
                    videoUrl: videoUrl,
                    urlvideo: videoUrl,
                    thumbnail: thumbnail,
                    updatedAt: serverTimestamp(),
                  });

                  // mettre à jour la liste locale
                  setExercises((prev) =>
                    prev
                      .map((exo) =>
                        exo.id === editingExo.id
                          ? {
                              ...exo,
                              titre: editTitle.trim(),
                              order: parsedOrder,
                              description: editDescription.trim(),
                              difficulty: editDifficulty,
                              tags: editTags,
                              videoId,
                              videoUrl,
                              urlvideo: videoUrl,
                              thumbnail,
                            }
                          : exo
                      )
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  );

                  setEditVideoFile(null);
                  setEditingExo(null);
                } catch (err) {
                  console.error("[ControlPage] Error updating exercise", err);
                  setEditError(
                    err?.message || "Erreur lors de la mise à jour de l’exercice."
                  );
                } finally {
                  setEditing(false);
                }
              }}
            >
              <div className="space-y-1">
                <label className="text-xs text-slate-400">
                  Remplacer la vidéo (optionnel)
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file =
                      e.target.files && e.target.files[0]
                        ? e.target.files[0]
                        : null;
                    setEditVideoFile(file);
                  }}
                  className="w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-50 hover:file:bg-slate-700"
                />
                {editVideoFile && (
                  <p className="text-[11px] text-slate-500">
                    Nouvelle vidéo sélectionnée : {editVideoFile.name}
                  </p>
                )}
                {(editingExo.videoUrl || editingExo.urlvideo) && !editVideoFile && (
                  <p className="text-[11px] text-slate-500">
                    Une vidéo est déjà associée à cet exercice. Si tu sélectionnes
                    un fichier ci-dessus, elle sera remplacée.
                  </p>
                )}
              </div>

              {editUploadError && (
                <p className="text-xs text-red-400">{editUploadError}</p>
              )}
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Titre</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Ordre</label>
                <input
                  type="number"
                  value={editOrder}
                  onChange={(e) => setEditOrder(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Niveau</label>
                <select
                  value={editDifficulty}
                  onChange={(e) => setEditDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
                >
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Tags</label>
                <p className="text-[11px] text-slate-500">
                  Mets à jour les tags associés à cet exercice.
                </p>
                <div className="mt-1 grid max-h-40 grid-cols-2 gap-1 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-2 text-[11px] sm:grid-cols-3">
                  {TAG_OPTIONS.map((tag) => {
                    const checked = editTags.includes(tag.value);
                    return (
                      <label
                        key={tag.value}
                        className="flex cursor-pointer items-center gap-1 text-slate-300"
                      >
                        <input
                          type="checkbox"
                          className="h-3 w-3 accent-sky-500"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditTags((prev) =>
                                prev.includes(tag.value)
                                  ? prev
                                  : [...prev, tag.value]
                              );
                            } else {
                              setEditTags((prev) =>
                                prev.filter((t) => t !== tag.value)
                              );
                            }
                          }}
                        />
                        <span>{tag.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {editError && (
                <p className="text-xs text-red-400">{editError}</p>
              )}

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  onClick={() => {
                    setEditingExo(null);
                    setEditError(null);
                  }}
                  disabled={editing}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-60"
                >
                  {editing ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
    </AuthGuard>
  );
}
