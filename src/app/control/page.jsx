"use client";

import { useEffect, useState, Suspense } from "react";
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

function ControlPageContent() {
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
  const [newPosition, setNewPosition] = useState("end"); // "start", "end", ou un ID d'exercice
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

          // On trie par le champ "order" - les exercices sans ordre restent à leur position d'origine
          // On utilise Infinity pour les exercices sans ordre afin qu'ils soient à la fin
          exoData.sort((a, b) => {
            const orderA = typeof a.order === "number" ? a.order : Infinity;
            const orderB = typeof b.order === "number" ? b.order : Infinity;
            if (orderA !== orderB) return orderA - orderB;
            // Si les deux n'ont pas d'ordre, on garde l'ordre du tableau seanceExercises
            return (a._seanceIndex ?? 0) - (b._seanceIndex ?? 0);
          });
          
          console.log("📋 Exercices triés:", exoData.map(e => ({ titre: e.titre, order: e.order })));
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

  // Calcule l'ordre en fonction de la position choisie
  function computeOrderFromPosition(position) {
    if (exercises.length === 0) {
      return 1;
    }

    // On assigne un ordre temporaire aux exercices qui n'en ont pas
    // basé sur leur index dans le tableau actuel (multiplié par 10 pour laisser de la place)
    const exercisesWithOrder = exercises.map((exo, idx) => ({
      ...exo,
      order: typeof exo.order === "number" ? exo.order : (idx + 1) * 10
    }));
    
    const sortedExercises = [...exercisesWithOrder].sort((a, b) => a.order - b.order);
    
    if (position === "start") {
      // Avant le premier exercice
      const firstOrder = sortedExercises[0]?.order ?? 10;
      return firstOrder - 10; // Utiliser -10, -20, etc. pour être sûr d'être avant
    }
    
    if (position === "end") {
      // Après le dernier exercice
      const lastOrder = sortedExercises[sortedExercises.length - 1]?.order ?? 0;
      return lastOrder + 10; // Ajouter 10 pour laisser de la marge
    }
    
    // Après un exercice spécifique
    const afterExoIndex = sortedExercises.findIndex((exo) => exo.id === position);
    if (afterExoIndex === -1) {
      // Fallback à la fin
      const lastOrder = sortedExercises[sortedExercises.length - 1]?.order ?? 0;
      return lastOrder + 10;
    }
    
    const afterExo = sortedExercises[afterExoIndex];
    const nextExo = sortedExercises[afterExoIndex + 1];
    
    if (!nextExo) {
      // Pas d'exercice après, on ajoute +10
      return afterExo.order + 10;
    }
    
    // Moyenne entre les deux
    return (afterExo.order + nextExo.order) / 2;
  }

  async function handleCreateExercise(e) {
    e.preventDefault();
    console.log("🚀 [handleCreateExercise] FONCTION APPELÉE !");
    
    setSaveError(null);
    setUploadError(null);

    if (!sessionId) {
      console.log("❌ sessionId manquant");
      setSaveError("Séance introuvable (sessionId manquant).");
      return;
    }

    if (!newTitle.trim()) {
      console.log("❌ titre vide");
      setSaveError("Le titre est obligatoire.");
      return;
    }

    // Calculer l'ordre automatiquement si pas de valeur manuelle
    let parsedOrder;
    if (newOrder.trim() !== "") {
      parsedOrder = Number(newOrder);
      if (Number.isNaN(parsedOrder)) {
        console.log("❌ ordre invalide");
        setSaveError("L'ordre doit être un nombre (ex: 1, 2, 3…).");
        return;
      }
    } else {
      parsedOrder = computeOrderFromPosition(newPosition);
    }
    
    console.log("✅ [ControlPage] Création exercice avec ordre:", parsedOrder, "position:", newPosition);

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

      // 2) Création du doc Firestore une fois l'upload (si présent) terminé
      const exercisesRef = collection(db, "exercises");
      const newExerciseData = {
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
      };
      
      console.log("📝 [ControlPage] Données à sauvegarder:", JSON.stringify(newExerciseData, null, 2));
      console.log("📝 [ControlPage] ORDRE =", parsedOrder, "TYPE =", typeof parsedOrder);
      
      const docRef = await addDoc(exercisesRef, newExerciseData);
      
      console.log("✅✅✅ [ControlPage] EXERCICE CRÉÉ AVEC SUCCÈS !");
      console.log("✅ ID:", docRef.id);
      console.log("✅ ORDRE SAUVEGARDÉ:", parsedOrder);
      alert("Exercice créé avec ordre: " + parsedOrder);

      // 2bis) Ajoute l'ID de l'exercice dans le tableau seanceExercises à la bonne position
      try {
        const seanceRef = doc(db, "seances", sessionId);
        const seanceSnap = await getDoc(seanceRef);
        const currentExercises = seanceSnap.data()?.seanceExercises || [];
        
        // Créer une liste d'exercices avec leur ordre pour trier
        const allExercisesWithOrder = [
          ...exercises.map(e => ({ id: e.id, order: typeof e.order === "number" ? e.order : Infinity })),
          { id: docRef.id, order: parsedOrder }
        ];
        
        // Trier par ordre
        allExercisesWithOrder.sort((a, b) => a.order - b.order);
        
        // Extraire juste les IDs dans le bon ordre
        const sortedIds = allExercisesWithOrder.map(e => e.id);
        
        console.log("📋 Nouveau tableau seanceExercises trié:", sortedIds);
        
        await updateDoc(seanceRef, {
          seanceExercises: sortedIds,
        });
        
        console.log("✅ seanceExercises mis à jour !");
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
      console.error("❌❌❌ [ControlPage] ERREUR lors de la création:", err);
      alert("ERREUR: " + (err?.message || "Erreur inconnue"));
      setSaveError(err?.message || "Erreur lors de la création de l'exercice.");
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

          <div className="space-y-1">
            <label className="text-xs text-slate-400">Titre</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
              placeholder="Ex: Exercice 1 – Appuis extérieurs"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">Position dans la séance</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewPosition("start");
                  setNewOrder("");
                }}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  newPosition === "start"
                    ? "bg-sky-500 text-slate-950"
                    : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                🔼 Au début
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewPosition("end");
                  setNewOrder("");
                }}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  newPosition === "end"
                    ? "bg-sky-500 text-slate-950"
                    : "border border-slate-700 text-slate-300 hover:bg-slate-800"
                }`}
              >
                🔽 À la fin
              </button>
              {exercises.length > 0 && (
                <select
                  value={newPosition !== "start" && newPosition !== "end" ? newPosition : ""}
                  onChange={(e) => {
                    if (e.target.value) {
                      setNewPosition(e.target.value);
                      setNewOrder("");
                    }
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                    newPosition !== "start" && newPosition !== "end" && newPosition !== ""
                      ? "bg-sky-500 text-slate-950"
                      : "border border-slate-700 bg-slate-950 text-slate-300"
                  }`}
                >
                  <option value="">↳ Après un exercice…</option>
                  {[...exercises].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((exo) => (
                    <option key={exo.id} value={exo.id}>
                      Après : {exo.ordre ?? exo.order} – {exo.titre || "Sans titre"}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {newPosition === "start" && "L'exercice sera placé avant tous les autres."}
              {newPosition === "end" && "L'exercice sera placé après le dernier."}
              {newPosition !== "start" && newPosition !== "end" && newPosition && (
                <>L&apos;exercice sera inséré après l&apos;exercice sélectionné.</>
              )}
              {!newPosition && "Choisis où placer l'exercice dans la séance."}
            </p>
            
            {/* Option avancée : ordre manuel */}
            <details className="pt-1">
              <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-400">
                ⚙️ Définir un ordre personnalisé (avancé)
              </summary>
              <div className="mt-2 space-y-1">
                <input
                  type="number"
                  step="0.1"
                  value={newOrder}
                  onChange={(e) => setNewOrder(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
                  placeholder="Ex: 1.5 pour insérer entre 1 et 2"
                />
                <p className="text-[10px] text-slate-600">
                  Si renseigné, cette valeur remplace la position automatique.
                </p>
              </div>
            </details>
            
            {/* Aperçu de l'ordre calculé */}
            <div className="mt-2 rounded-lg bg-sky-500/10 border border-sky-500/20 px-3 py-2">
              <p className="text-xs text-sky-400">
                📍 Ordre qui sera utilisé : <strong className="font-mono">{
                  newOrder.trim() !== "" 
                    ? Number(newOrder) 
                    : computeOrderFromPosition(newPosition)
                }</strong>
                {newOrder.trim() !== "" && " (personnalisé)"}
              </p>
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
        <div className="space-y-2">
          {/* En-tête de liste */}
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="text-xs text-slate-500">
              {exercises.length} exercice{exercises.length > 1 ? "s" : ""} dans cette séance
            </p>
          </div>

          {exercises.map((exo, index) => {
            const sortedExercises = [...exercises].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const currentIndex = sortedExercises.findIndex((e) => e.id === exo.id);
            const isFirst = currentIndex === 0;
            const isLast = currentIndex === sortedExercises.length - 1;

            return (
              <div
                key={exo.id}
                className="group flex gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 transition-all hover:border-slate-700 hover:bg-slate-900/80"
              >
                {/* Numéro d'ordre + contrôles */}
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500/20 to-sky-600/10 text-lg font-bold text-sky-400">
                    {currentIndex + 1}
                  </div>
                  <div className="flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={async () => {
                        if (isFirst) return;
                        const prevExo = sortedExercises[currentIndex - 1];
                        const newOrder = (typeof prevExo.order === "number" ? prevExo.order : currentIndex * 10) - 5;
                        try {
                          const exoRef = doc(db, "exercises", exo.id);
                          await updateDoc(exoRef, { order: newOrder, updatedAt: serverTimestamp() });
                          
                          // Mettre à jour la liste locale
                          const updatedList = exercises
                            .map((e) => (e.id === exo.id ? { ...e, order: newOrder } : e))
                            .sort((a, b) => {
                              const orderA = typeof a.order === "number" ? a.order : Infinity;
                              const orderB = typeof b.order === "number" ? b.order : Infinity;
                              return orderA - orderB;
                            });
                          
                          setExercises(updatedList);
                          
                          // Mettre à jour seanceExercises dans Firestore
                          const sortedIds = updatedList.map(e => e.id);
                          const seanceRef = doc(db, "seances", sessionId);
                          await updateDoc(seanceRef, { seanceExercises: sortedIds });
                          console.log("✅ Monté - seanceExercises mis à jour:", sortedIds);
                        } catch (err) {
                          console.error("Erreur lors du déplacement", err);
                        }
                      }}
                      className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
                      title="Monter"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={async () => {
                        if (isLast) return;
                        const nextExo = sortedExercises[currentIndex + 1];
                        const newOrder = (typeof nextExo.order === "number" ? nextExo.order : (currentIndex + 2) * 10) + 5;
                        try {
                          const exoRef = doc(db, "exercises", exo.id);
                          await updateDoc(exoRef, { order: newOrder, updatedAt: serverTimestamp() });
                          
                          // Mettre à jour la liste locale
                          const updatedList = exercises
                            .map((e) => (e.id === exo.id ? { ...e, order: newOrder } : e))
                            .sort((a, b) => {
                              const orderA = typeof a.order === "number" ? a.order : Infinity;
                              const orderB = typeof b.order === "number" ? b.order : Infinity;
                              return orderA - orderB;
                            });
                          
                          setExercises(updatedList);
                          
                          // Mettre à jour seanceExercises dans Firestore
                          const sortedIds = updatedList.map(e => e.id);
                          const seanceRef = doc(db, "seances", sessionId);
                          await updateDoc(seanceRef, { seanceExercises: sortedIds });
                          console.log("✅ Descendu - seanceExercises mis à jour:", sortedIds);
                        } catch (err) {
                          console.error("Erreur lors du déplacement", err);
                        }
                      }}
                      className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-30"
                      title="Descendre"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Contenu principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-slate-50">
                        {exo.titre || "Exercice sans titre"}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {exo.difficulty && (
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${
                            exo.difficulty === "debutant" ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                            exo.difficulty === "intermediaire" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
                            exo.difficulty === "avance" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                            "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          }`}>
                            {(DIFFICULTY_OPTIONS.find((opt) => opt.value === exo.difficulty) || { label: exo.difficulty }).label}
                          </span>
                        )}
                        {exo.videoUrl || exo.urlvideo ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                            Vidéo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-600">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Sans vidéo
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-400"
                      onClick={() => {
                        setEditError(null);
                        setEditUploadError(null);
                        setEditingExo(exo);
                        setEditTitle(exo.titre || "");
                        setEditOrder(typeof exo.order === "number" ? String(exo.order) : "");
                        setEditDescription(exo.description || "");
                        setEditDifficulty(exo.difficulty || "debutant");
                        setEditTags(Array.isArray(exo.tags) ? exo.tags : []);
                        setEditVideoFile(null);
                      }}
                    >
                      Éditer
                    </button>
                  </div>

                  {/* Tags */}
                  {Array.isArray(exo.tags) && exo.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {exo.tags.slice(0, 4).map((tag) => {
                        const meta = TAG_OPTIONS.find((t) => t.value === tag) || null;
                        return (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400"
                          >
                            {meta ? meta.label : tag}
                          </span>
                        );
                      })}
                      {exo.tags.length > 4 && (
                        <span className="rounded-full bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-500">
                          +{exo.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Description (tronquée) */}
                  {exo.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                      {exo.description}
                    </p>
                  )}

                  {/* Footer stats */}
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-600">
                    <span>❤️ {exo.likesCount ?? 0}</span>
                    <span>💬 {exo.commentsCount ?? 0}</span>
                    {exo.durationSeconds && (
                      <span>⏱️ {Math.round(exo.durationSeconds / 60)} min</span>
                    )}
                    <span className="ml-auto font-mono text-slate-700">
                      ordre: {exo.order ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
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

                  // Mettre à jour le tableau seanceExercises avec le nouvel ordre
                  try {
                    const updatedExercises = exercises.map((exo) =>
                      exo.id === editingExo.id
                        ? { ...exo, order: parsedOrder }
                        : exo
                    );
                    
                    // Trier par ordre
                    updatedExercises.sort((a, b) => {
                      const orderA = typeof a.order === "number" ? a.order : Infinity;
                      const orderB = typeof b.order === "number" ? b.order : Infinity;
                      return orderA - orderB;
                    });
                    
                    const sortedIds = updatedExercises.map(e => e.id);
                    
                    const seanceRef = doc(db, "seances", sessionId);
                    await updateDoc(seanceRef, {
                      seanceExercises: sortedIds,
                    });
                    console.log("✅ seanceExercises réordonné après édition:", sortedIds);
                  } catch (err) {
                    console.error("Erreur lors de la réorganisation de seanceExercises:", err);
                  }

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
                      .sort((a, b) => {
                        const orderA = typeof a.order === "number" ? a.order : Infinity;
                        const orderB = typeof b.order === "number" ? b.order : Infinity;
                        return orderA - orderB;
                      })
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

              <div className="space-y-2">
                <label className="text-xs text-slate-400">Position / Ordre</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const sorted = [...exercises].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                      const firstOrder = sorted[0]?.order ?? 1;
                      setEditOrder(String(firstOrder - 1));
                    }}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"
                  >
                    🔼 Mettre au début
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const sorted = [...exercises].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                      const lastOrder = sorted[sorted.length - 1]?.order ?? 0;
                      setEditOrder(String(lastOrder + 1));
                    }}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"
                  >
                    🔽 Mettre à la fin
                  </button>
                </div>
                <input
                  type="number"
                  step="0.1"
                  value={editOrder}
                  onChange={(e) => setEditOrder(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none focus:border-sky-500"
                  placeholder="Ordre numérique (ex: 1, 2, 1.5…)"
                />
                <p className="text-[10px] text-slate-600">
                  Tu peux utiliser des décimales (ex: 1.5) pour insérer entre deux exercices.
                </p>
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

export default function ControlPage() {
  return (
    <Suspense fallback={
      <AuthGuard>
        <main className="space-y-4">
          <p className="text-sm text-slate-400">Chargement…</p>
        </main>
      </AuthGuard>
    }>
      <ControlPageContent />
    </Suspense>
  );
}
