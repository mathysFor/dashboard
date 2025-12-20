"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getCountFromServer,
  query,
  updateDoc,
  where,
  limit,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import AuthGuard from "../../../lib/AuthGuard";

/**
 * Dashboard admin WinterAcademy
 *
 * Objectifs :
 *  - Vue globale : nb users, sessions, trips, trips avec > 1 membre
 *  - Recherche user (par email / id / nom)
 *  - Edition rapide des champs user (hors createdAt / id)
 *  - Liste des sorties d'un user + conversations associées
 *
 * ⚠️ IMPORTANT
 *  - Ce dashboard est pensé pour un usage ADMIN uniquement
 *  - Idéalement, protège la route via auth (middleware Next + rôle admin)
 *  - Certaines requêtes (tripMembers) peuvent coûter cher si la base grossit :
 *    si ça devient lourd, on déplacera les agrégations dans une Cloud Function.
 */

export default function DashboardPage() {
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({
    users: 0,
    trips: 0,
    tripMembers: 0,
    tripsWithAtLeastTwoMembers: 0,
    notificationsEnabledUsers: 0,
  });

  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [editedUser, setEditedUser] = useState({});
  const [savingUser, setSavingUser] = useState(false);

  const [userTripsCreated, setUserTripsCreated] = useState([]);
  const [userTripMemberships, setUserTripMemberships] = useState([]);
  const [userConversations, setUserConversations] = useState([]);
  const [userDataLoading, setUserDataLoading] = useState(false);

  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const [newFieldType, setNewFieldType] = useState("string"); // string, number, boolean

  // --------- GLOBAL STATS ---------

useEffect(() => {
  const fetchStats = async () => {
    try {
      setStatsLoading(true);

      const usersRef = collection(db, "users");

      const [usersSnap, tripsSnap, tripMembersSnap] =
        await Promise.all([
          getDocs(usersRef),
          getCountFromServer(collection(db, "trips")),
          getDocs(collection(db, "tripMembers")), // on a besoin du détail pour compter les trips avec >1 membre
        ]);

      const totalUsers = usersSnap.size;

      // ---- compteur users avec notifs ON (au moins un token) ----
      let notificationsEnabledUsers = 0;
      usersSnap.forEach((d) => {
        const data = d.data();
        const hasFcmTokens =
          Array.isArray(data.fcmTokens) && data.fcmTokens.length > 0;
        const hasDevicesByToken =
          data.devicesByToken &&
          typeof data.devicesByToken === "object" &&
          Object.keys(data.devicesByToken).length > 0;

        if (hasFcmTokens || hasDevicesByToken) {
          notificationsEnabledUsers += 1;
        }
      });

      // ---- trips avec >= 2 membres ----
      const perTrip = {};
      tripMembersSnap.forEach((d) => {
        const data = d.data();
        const tripId = data.tripId;
        if (!tripId) return;
        perTrip[tripId] = (perTrip[tripId] || 0) + 1;
      });

      const tripsWithAtLeastTwoMembers = Object.values(perTrip).filter(
        (count) => count > 1
      ).length;

      setStats({
        users: totalUsers,
        trips: tripsSnap.data().count,
        tripMembers: tripMembersSnap.size,
        tripsWithAtLeastTwoMembers,
        notificationsEnabledUsers,
      });
    } catch (err) {
      console.error("Erreur chargement stats", err);
    } finally {
      setStatsLoading(false);
    }
  };

  fetchStats();
}, []);
  // --------- SEARCH USER ---------

  const handleSearch = async (e) => {
    e?.preventDefault();
    setSearchError("");

    const trimmed = search.trim();
    if (!trimmed) return;

    setSearchLoading(true);
    setSelectedUser(null);
    setUserTripsCreated([]);
    setUserTripMemberships([]);
    setUserConversations([]);

    try {
      let userDoc = null;

      // 1. Si ça ressemble à un docId, on tente direct
      const directRef = doc(collection(db, "users"), trimmed);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        userDoc = { id: directSnap.id, ...directSnap.data() };
      } else {
        // 2. Sinon, on tente email / nameLowercase
        const usersRef = collection(db, "users");
        let q;

        if (trimmed.includes("@")) {
          q = query(
            usersRef,
            where("email", "==", trimmed.toLowerCase()),
            limit(5)
          );
        } else {
          const lower = trimmed.toLowerCase();
          // champ vu dans tes docs : nameLowercase
          q = query(
            usersRef,
            where("nameLowercase", ">=", lower),
            where("nameLowercase", "<=", lower + "\uf8ff"),
            limit(5)
          );
        }

        const snap = await getDocs(q);
        if (!snap.empty) {
          const first = snap.docs[0];
          userDoc = { id: first.id, ...first.data() };
        }
      }

      if (!userDoc) {
        setSearchError("Aucun utilisateur trouvé.");
        return;
      }

      setSelectedUser(userDoc);
      setEditedUser(stripNonEditableFields(userDoc));
      setNewFieldName("");
      setNewFieldValue("");
      setNewFieldType("string");
      await loadUserRelatedData(userDoc.id);
    } catch (err) {
      console.error("Erreur recherche user", err);
      setSearchError("Erreur pendant la recherche. Regarde la console.");
    } finally {
      setSearchLoading(false);
    }
  };

  // --------- LOAD USER RELATED DATA ---------

  const loadUserRelatedData = async (userId) => {
    try {
      setUserDataLoading(true);

      // 1. Sorties créées par l'user (champ à adapter selon ton schéma)
      const tripsCreatedQ = query(
        collection(db, "trips"),
        where("creatorId", "==", userId)
      );

      // 2. Sorties où l'user est membre
      const membershipsQ = query(
        collection(db, "tripMembers"),
        where("userId", "==", userId)
      );

      const [tripsCreatedSnap, membershipsSnap] = await Promise.all([
        getDocs(tripsCreatedQ),
        getDocs(membershipsQ),
      ]);

      const tripsCreated = tripsCreatedSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const memberships = membershipsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setUserTripsCreated(tripsCreated);
      setUserTripMemberships(memberships);

      // 3. Conversations associées aux sorties
      // Hypothèse : chaque trip possède un champ conversationId
      const conversationIds = new Set();
      tripsCreated.forEach((t) => {
        if (t.conversationId) conversationIds.add(t.conversationId);
      });

      // On peut aussi regarder les trips joints via memberships si on veut
      // (à activer plus tard si besoin)

      const convs = [];
      for (const convId of conversationIds) {
        const ref = doc(collection(db, "conversations"), convId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          convs.push({ id: snap.id, ...snap.data() });
        }
      }

      setUserConversations(convs);
    } catch (err) {
      console.error("Erreur chargement données user", err);
    } finally {
      setUserDataLoading(false);
    }
  };

  // --------- UPDATE USER ---------

  const handleUserFieldChange = (key, value) => {
    // Récupérer le type original du champ depuis selectedUser
    const originalValue = selectedUser?.[key];
    const originalType = originalValue !== undefined && originalValue !== null 
      ? typeof originalValue 
      : undefined;
    
    // Parser la valeur en tenant compte du type original
    const parsedValue = parseValue(value, originalType);
    
    setEditedUser((prev) => ({ ...prev, [key]: parsedValue }));
  };

  const handleAddField = () => {
    if (!newFieldName.trim()) {
      alert("Le nom du champ est obligatoire");
      return;
    }

    // Vérifier si le champ existe déjà
    if (editedUser.hasOwnProperty(newFieldName)) {
      alert("Ce champ existe déjà");
      return;
    }

    let parsedValue;
    if (newFieldType === "boolean") {
      parsedValue = newFieldValue === "true";
    } else if (newFieldType === "number") {
      const num = Number(newFieldValue);
      if (Number.isNaN(num)) {
        alert("La valeur doit être un nombre valide");
        return;
      }
      parsedValue = num;
    } else {
      parsedValue = newFieldValue;
    }

    setEditedUser((prev) => ({ ...prev, [newFieldName]: parsedValue }));
    setNewFieldName("");
    setNewFieldValue("");
    setNewFieldType("string");
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    try {
      setSavingUser(true);
      const ref = doc(collection(db, "users"), selectedUser.id);
      await updateDoc(ref, editedUser);
      setSelectedUser((prev) => (prev ? { ...prev, ...editedUser } : prev));
    } catch (err) {
      console.error("Erreur sauvegarde user", err);
      alert("Erreur lors de la sauvegarde du user (voir console)");
    } finally {
      setSavingUser(false);
    }
  };

  const totalUserTrips = useMemo(
    () => new Set(userTripMemberships.map((m) => m.tripId)).size,
    [userTripMemberships]
  );

  return (
    <AuthGuard>
      <div className="text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:px-8">
        {/* HEADER */}
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Stats & Users
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Vue globale de la base Firestore + contrôle fin d&apos;un user.
            </p>
          </div>
        </header>

        {/* GLOBAL STATS */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-black/40">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-lg font-medium">Vue d&apos;ensemble</h2>
            {statsLoading && (
              <span className="text-xs text-slate-400">Chargement…</span>
            )}
          </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
  <StatCard label="Utilisateurs" value={stats.users} />
  <StatCard label="Sorties (trips)" value={stats.trips} />
  <StatCard
    label="Trips avec ≥ 2 membres"
    value={stats.tripsWithAtLeastTwoMembers}
  />
  <StatCard
    label="Users notif ON"
    value={stats.notificationsEnabledUsers}
  />
</div>
        </section>

        {/* USER SEARCH + DETAILS */}
        <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* SEARCH PANEL */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-medium">Rechercher un utilisateur</h2>
            <p className="mt-1 text-xs text-slate-400">
              Par ID, email ou nom (nameLowercase).
            </p>

            <form onSubmit={handleSearch} className="mt-4 flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                placeholder="ID user, email, nom…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-400 disabled:opacity-60"
              >
                {searchLoading ? "Recherche…" : "Chercher"}
              </button>
            </form>

            {searchError && (
              <p className="mt-2 text-xs text-red-400">{searchError}</p>
            )}

            {/* USER RAW DATA */}
            {selectedUser && (
              <div className="mt-6 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">Profil</h3>
                  <button
                    onClick={handleSaveUser}
                    disabled={savingUser}
                    className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {savingUser ? "Sauvegarde…" : "Enregistrer les modifs"}
                  </button>
                </div>

                <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                  {Object.entries(editedUser).map(([key, value]) => {
                    // Détecter le type original du champ
                    const originalValue = selectedUser?.[key];
                    const isBoolean = originalValue !== undefined && originalValue !== null && typeof originalValue === "boolean";
                    
                    return (
                      <div
                        key={key}
                        className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2"
                      >
                        <div className="truncate font-mono text-[11px] text-slate-400">
                          {key}
                        </div>
                        {isBoolean ? (
                          <select
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-mono text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            value={String(value)}
                            onChange={(e) =>
                              handleUserFieldChange(key, e.target.value)
                            }
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-mono text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            value={stringifyValue(value)}
                            onChange={(e) =>
                              handleUserFieldChange(key, e.target.value)
                            }
                          />
                        )}
                      </div>
                    );
                  })}

                  {!Object.keys(editedUser).length && (
                    <p className="text-[11px] text-slate-500">
                      Aucun champ éditable détecté.
                    </p>
                  )}

                  {/* ADD NEW FIELD */}
                  <div className="mt-4 border-t border-slate-800 pt-3">
                    <div className="mb-2 text-[11px] font-semibold text-slate-300">
                      Ajouter un nouveau champ
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2">
                        <div className="text-[11px] text-slate-400">Nom:</div>
                        <input
                          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-mono text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                          placeholder="ex: premium"
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2">
                        <div className="text-[11px] text-slate-400">Type:</div>
                        <select
                          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-mono text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                          value={newFieldType}
                          onChange={(e) => {
                            setNewFieldType(e.target.value);
                            setNewFieldValue(""); // Reset value when type changes
                          }}
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-2">
                        <div className="text-[11px] text-slate-400">Valeur:</div>
                        {newFieldType === "boolean" ? (
                          <select
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-mono text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            value={newFieldValue}
                            onChange={(e) => setNewFieldValue(e.target.value)}
                          >
                            <option value="">-- Sélectionner --</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-mono text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            placeholder={newFieldType === "number" ? "ex: 42" : "ex: valeur"}
                            value={newFieldValue}
                            onChange={(e) => setNewFieldValue(e.target.value)}
                          />
                        )}
                      </div>
                      <button
                        onClick={handleAddField}
                        className="w-full rounded-md bg-sky-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-sky-400"
                      >
                        Ajouter le champ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* USER RELATED DATA */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">Données liées</h2>
                {selectedUser ? (
                  <p className="mt-1 text-xs text-slate-400">
                    User ID :
                    <span className="font-mono text-[11px] text-slate-300">
                      {" "}
                      {selectedUser.id}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    Recherche un utilisateur pour voir ses sorties.
                  </p>
                )}
              </div>
              {userDataLoading && (
                <span className="text-xs text-slate-400">Chargement…</span>
              )}
            </div>

            {selectedUser && (
              <div className="mt-4 space-y-4 text-xs">
                {/* TRIPS */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Sorties (trips)</h3>
                    <div className="flex gap-3 text-[11px] text-slate-400">
                      <span>Créées : {userTripsCreated.length}</span>
                      <span>Total (membre) : {totalUserTrips}</span>
                    </div>
                  </div>

                  <div className="max-h-40 overflow-y-auto rounded border border-slate-800 bg-slate-950/60 p-2">
                    {userTripsCreated.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        Aucune sortie créée par cet utilisateur.
                      </p>
                    ) : (
                      <table className="w-full border-separate border-spacing-y-1 text-[11px]">
                        <thead className="text-slate-400">
                          <tr>
                            <th className="text-left">ID</th>
                            <th className="text-left">Titre / station</th>
                            <th className="text-left">Date</th>
                            <th className="text-left">Conversation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userTripsCreated.map((trip) => (
                            <tr key={trip.id} className="align-top">
                              <td className="font-mono text-[10px] text-slate-400">
                                {trip.id}
                              </td>
                              <td>
                                {trip.title || trip.name || "(pas de titre)"}
                              </td>
                              <td>{trip.date ? formatDate(trip.date) : "–"}</td>
                              <td className="font-mono text-[10px] text-slate-400">
                                {trip.conversationId || "–"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* MEMBERSHIPS */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Participations</h3>
                    <span className="text-[11px] text-slate-400">
                      Docs tripMembers : {userTripMemberships.length}
                    </span>
                  </div>

                  <div className="max-h-32 overflow-y-auto rounded border border-slate-800 bg-slate-950/60 p-2">
                    {userTripMemberships.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        Cet utilisateur n&apos;est membre d&apos;aucune sortie
                        (via tripMembers).
                      </p>
                    ) : (
                      <table className="w-full border-separate border-spacing-y-1 text-[11px]">
                        <thead className="text-slate-400">
                          <tr>
                            <th className="text-left">tripId</th>
                            <th className="text-left">role</th>
                            <th className="text-left">joinedAt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userTripMemberships.map((m) => (
                            <tr key={m.id} className="align-top">
                              <td className="font-mono text-[10px] text-slate-400">
                                {m.tripId}
                              </td>
                              <td>{m.role || "–"}</td>
                              <td>
                                {m.joinedAt ? formatDate(m.joinedAt) : "–"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* CONVERSATIONS */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      Conversations liées
                    </h3>
                    <span className="text-[11px] text-slate-400">
                      {userConversations.length} conversation(s)
                    </span>
                  </div>

                  <div className="max-h-40 overflow-y-auto rounded border border-slate-800 bg-slate-950/60 p-2">
                    {userConversations.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        Aucune conversation trouvée via les trips créés.
                      </p>
                    ) : (
                      <table className="w-full border-separate border-spacing-y-1 text-[11px]">
                        <thead className="text-slate-400">
                          <tr>
                            <th className="text-left">ID</th>
                            <th className="text-left">Titre</th>
                            <th className="text-left">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userConversations.map((c) => (
                            <tr key={c.id} className="align-top">
                              <td className="font-mono text-[10px] text-slate-400">
                                {c.id}
                              </td>
                              <td>{c.title || c.name || "(sans titre)"}</td>
                              <td>{c.kind || c.type || "–"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
    </AuthGuard>
  );
}

// --------- UI HELPERS ---------

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </div>
    </div>
  );
}

// On enlève les champs qu&apos;on ne veut pas éditer à la main
function stripNonEditableFields(user) {
  if (!user) return {};
  const { id, createdAt, ...rest } = user; // adapte si besoin
  return rest;
}

function stringifyValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  // Firestore Timestamp / objets : on affiche du JSON
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseValue(raw, originalType) {
  const trimmed = raw.trim();
  if (trimmed === "") return "";

  // Si on connaît le type original, on l'utilise pour guider la conversion
  if (originalType !== undefined) {
    if (originalType === "boolean") {
      const lower = trimmed.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
      // Si ce n'est pas "true" ou "false", on retourne la valeur par défaut selon le type original
      return false;
    }
    if (originalType === "number") {
      const num = Number(trimmed);
      if (!Number.isNaN(num)) return num;
      return 0; // valeur par défaut pour un nombre
    }
  }

  // Détection des booléens (insensible à la casse)
  const lower = trimmed.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;

  // number
  if (!Number.isNaN(Number(trimmed)) && trimmed !== "") {
    return Number(trimmed);
  }

  // JSON
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed; // on laisse en string si JSON invalide
    }
  }

  return trimmed;
}

// Formatte les dates / timestamps Firestore
function formatDate(value) {
  try {
    // Firestore Timestamp (SDK web)
    if (value && typeof value.toDate === "function") {
      const d = value.toDate();
      return d.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // Date JS classique
    if (value instanceof Date) {
      return value.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return String(value);
  } catch {
    return String(value);
  }
}
