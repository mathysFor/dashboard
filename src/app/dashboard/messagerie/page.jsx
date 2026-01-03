"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDocs,
  getDoc,
  limit,
} from "firebase/firestore";
import { db, auth } from "../../../../lib/firebase";
import AuthGuard from "../../../../lib/AuthGuard";

// Hardcoded admin user ID
const ADMIN_USER_ID = "bn0pM2tyf2ey42aZXHTHc4RL61i2";
const ADMIN_DISPLAY_NAME = "Mathys Fornasier";

export default function MessageriePage() {
  // Conversations
  const [conversations, setConversations] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState(null);

  // Messages
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Input
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);

  // Refs
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Mobile view state
  const [showChat, setShowChat] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Toast
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  // ============================================
  // Load conversations (real-time)
  // ============================================
  useEffect(() => {
    setConversationsLoading(true);

    const q = query(
      collection(db, "conversations"),
      where("memberIds", "array-contains", ADMIN_USER_ID),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const convs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setConversations(convs);
        setConversationsLoading(false);
      },
      (error) => {
        console.error("Error loading conversations:", error);
        showToast("Erreur lors du chargement des conversations", "error");
        setConversationsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ============================================
  // Load messages when conversation selected (real-time)
  // ============================================
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);

    const q = query(
      collection(db, "conversations", selectedConversation.id, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(msgs);
        setMessagesLoading(false);
      },
      (error) => {
        console.error("Error loading messages:", error);
        showToast("Erreur lors du chargement des messages", "error");
        setMessagesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedConversation?.id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when conversation selected
  useEffect(() => {
    if (selectedConversation) {
      inputRef.current?.focus();
    }
  }, [selectedConversation?.id]);

  // ============================================
  // Get other user from conversation
  // ============================================
  const getOtherUser = useCallback((conversation) => {
    if (!conversation) return null;

    // Try members array first
    if (Array.isArray(conversation.members)) {
      const other = conversation.members.find((m) => m?.id !== ADMIN_USER_ID);
      if (other) return other;
    }

    // Try participantsMap
    if (conversation.participantsMap) {
      const otherKey = Object.keys(conversation.participantsMap).find(
        (key) => key !== ADMIN_USER_ID
      );
      if (otherKey) {
        const p = conversation.participantsMap[otherKey];
        return { id: otherKey, name: p.name, imageURL: p.photoURL };
      }
    }

    // Fallback to memberIds
    if (Array.isArray(conversation.memberIds)) {
      const otherId = conversation.memberIds.find((id) => id !== ADMIN_USER_ID);
      if (otherId) return { id: otherId, name: "Utilisateur", imageURL: "" };
    }

    return { id: "unknown", name: "Utilisateur", imageURL: "" };
  }, []);

  // ============================================
  // Search users
  // ============================================
  const handleSearchUsers = useCallback(async (queryText) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearchLoading(true);
    setShowSearchResults(true);

    try {
      const searchLower = trimmed.toLowerCase();
      const usersRef = collection(db, "users");
      const usersMap = new Map();
      const conversationUserIds = new Set();

      // 1. Search in existing conversations first (to find users we already chat with)
      // This works even if users don't have nameLowercase/reverseNameLowercase
      conversations.forEach((conv) => {
        const other = getOtherUser(conv);
        if (other && other.id && other.id !== ADMIN_USER_ID) {
          const otherName = (other.name || "").toLowerCase();
          // Also check if search looks like an email
          const isEmailSearch = searchLower.includes("@");
          if (otherName.includes(searchLower) || isEmailSearch) {
            conversationUserIds.add(other.id);
            // Add user from conversation data (will be enriched later if found in users collection)
            const userData = {
              id: other.id,
              displayName: other.name,
              name: other.name,
              prenom: other.name?.split(" ")[0] || "",
              nom: other.name?.split(" ").slice(1).join(" ") || "",
              imageURL: other.imageURL || "",
              photoURL: other.imageURL || "",
            };
            usersMap.set(other.id, userData);
          }
        }
      });

      // 2. Try to search in users collection by nameLowercase (if field exists)
      let snap1 = { docs: [] };
      try {
        const q1 = query(
          usersRef,
          where("nameLowercase", ">=", searchLower),
          where("nameLowercase", "<=", searchLower + "\uf8ff"),
          limit(10)
        );
        snap1 = await getDocs(q1);
      } catch (error) {
        // Field might not be indexed, ignore
        console.log("nameLowercase search failed (might not be indexed):", error);
      }

      // 3. Try to search in users collection by reverseNameLowercase (if field exists)
      let snap2 = { docs: [] };
      try {
        const q2 = query(
          usersRef,
          where("reverseNameLowercase", ">=", searchLower),
          where("reverseNameLowercase", "<=", searchLower + "\uf8ff"),
          limit(10)
        );
        snap2 = await getDocs(q2);
      } catch (error) {
        // Field might not be indexed, ignore
        console.log("reverseNameLowercase search failed (might not be indexed):", error);
      }

      // 4. Search by email if the query looks like an email
      let snap3 = { docs: [] };
      if (searchLower.includes("@")) {
        try {
          const q3 = query(
            usersRef,
            where("email", "==", searchLower),
            limit(10)
          );
          snap3 = await getDocs(q3);
        } catch (error) {
          console.log("email search failed:", error);
        }
      }

      // Merge and deduplicate results from users collection
      [...snap1.docs, ...snap2.docs, ...snap3.docs].forEach((doc) => {
        const userData = { id: doc.id, ...doc.data() };
        // Skip admin user
        if (userData.id !== ADMIN_USER_ID) {
          usersMap.set(doc.id, userData);
        }
      });

      // 5. For users found in conversations, fetch their full data from users collection
      // This ensures we have complete user data even if they don't have nameLowercase fields
      const fetchPromises = Array.from(conversationUserIds).map(async (userId) => {
        try {
          const userDocRef = doc(usersRef, userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = { id: userDoc.id, ...userDoc.data() };
            // Merge with existing data from conversation
            const existing = usersMap.get(userId);
            if (existing) {
              // Keep conversation data but enrich with user doc data
              usersMap.set(userId, { ...existing, ...userData });
            } else {
              usersMap.set(userDoc.id, userData);
            }
          }
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error);
          // Keep the conversation data if fetch fails
        }
      });

      await Promise.all(fetchPromises);

      // 6. Additional fallback: if we have very few results, try to fetch more users
      // and filter client-side (for users without nameLowercase fields)
      if (usersMap.size < 5 && searchLower.length >= 3) {
        try {
          // Get a larger sample and filter client-side
          const allUsersSnap = await getDocs(query(usersRef, limit(100)));
          allUsersSnap.docs.forEach((doc) => {
            const userData = { id: doc.id, ...doc.data() };
            if (userData.id === ADMIN_USER_ID || usersMap.has(userData.id)) {
              return;
            }

            // Check if name matches (various fields) or email
            const displayName = (userData.displayName || "").toLowerCase();
            const prenom = (userData.prenom || "").toLowerCase();
            const nom = (userData.nom || "").toLowerCase();
            const fullName = `${prenom} ${nom}`.trim().toLowerCase();
            const email = (userData.email || "").toLowerCase();

            if (
              displayName.includes(searchLower) ||
              prenom.includes(searchLower) ||
              nom.includes(searchLower) ||
              fullName.includes(searchLower) ||
              email.includes(searchLower) ||
              email === searchLower
            ) {
              usersMap.set(userData.id, userData);
            }
          });
        } catch (error) {
          console.error("Error in fallback search:", error);
        }
      }

      const results = Array.from(usersMap.values());
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
      showToast("Erreur lors de la recherche", "error");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [conversations, getOtherUser]);

  // Handle search query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        handleSearchUsers(searchQuery);
      }, 300); // Debounce search

      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery, handleSearchUsers]);

  // ============================================
  // Send message
  // ============================================
  const handleSendMessage = async (e) => {
    e?.preventDefault();

    const text = messageInput.trim();
    if (!text || !selectedConversation || sending) return;

    setSending(true);
    setMessageInput("");

    try {
      const messageRef = collection(
        db,
        "conversations",
        selectedConversation.id,
        "messages"
      );
      const conversationRef = doc(db, "conversations", selectedConversation.id);

      // Add message
      await addDoc(messageRef, {
        text,
        senderId: ADMIN_USER_ID,
        createdAt: serverTimestamp(),
        seenBy: [ADMIN_USER_ID],
        type: "text",
        senderDisplayName: ADMIN_DISPLAY_NAME,
      });

      // Update conversation
      await updateDoc(conversationRef, {
        lastMessage: {
          lastMessage: text,
          lastMessageAt: serverTimestamp(),
          senderId: ADMIN_USER_ID,
          seenBy: [ADMIN_USER_ID],
          senderDisplayName: ADMIN_DISPLAY_NAME,
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      showToast("Erreur lors de l'envoi du message", "error");
      setMessageInput(text); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  // ============================================
  // Create chat (adapted from React Native)
  // ============================================
  const createChat = async (currentUser, otherUser) => {
    const uidA = currentUser?.id || currentUser?.uid;
    const uidB = otherUser?.id || otherUser?.uid;

    if (!uidA || !uidB) {
      throw new Error("createChat: missing user id");
    }
    if (uidA === uidB) {
      throw new Error("createChat: both users are the same");
    }

    // Stable pair key allows fast equality query & prevents duplicates
    const pair = [uidA, uidB].sort();
    const pairKey = `${pair[0]}__${pair[1]}`;

    const convsRef = collection(db, "conversations");

    // 1) Fast path: direct lookup by pairKey
    let q = query(convsRef, where("pairKey", "==", pairKey));
    let snap = await getDocs(q);
    let convId = null;

    if (!snap.empty) {
      convId = snap.docs[0].id;
    } else {
      // 2) Fallback: single array-contains then filter client-side (older docs)
      q = query(convsRef, where("participants", "array-contains", uidA));
      snap = await getDocs(q);
      const existing = snap.docs.find((d) => {
        const data = d.data();
        const participants = Array.isArray(data?.participants)
          ? data.participants
          : [];

        // Must be the same pair (both uids present)
        const hasBoth = participants.includes(uidA) && participants.includes(uidB);

        // Strong signals that this is a true 1-to-1
        const flaggedTwoPerson =
          data?.kind === "two_person" || data?.isTwoPeople === true;

        // Backward-compat: older schemas may not have flags
        const looksDirect = data?.type === "direct";

        // If a pairKey exists, enforce strict match
        const samePairKey =
          typeof data?.pairKey === "string" && data.pairKey === pairKey;

        return (
          hasBoth &&
          (flaggedTwoPerson || samePairKey || looksDirect)
        );
      });

      if (existing) {
        convId = existing.id;
      } else {
        // 3) Create a new conversation document
        const now = serverTimestamp();

        // Get user display names
        const currentUserName =
          currentUser.displayName ||
          `${currentUser.prenom || ""} ${currentUser.nom || ""}`.trim() ||
          "";
        const otherUserName =
          otherUser.displayName ||
          `${otherUser.prenom || ""} ${otherUser.nom || ""}`.trim() ||
          "";

        const participantsMap = {
          [uidA]: {
            uid: uidA,
            name: currentUserName,
            photoURL: currentUser.imageURL || currentUser.photoURL || "",
          },
          [uidB]: {
            uid: uidB,
            name: otherUserName,
            photoURL: otherUser.imageURL || otherUser.photoURL || "",
          },
        };

        const newData = {
          kind: "two_person",
          isTwoPeople: true,
          type: "direct",
          participants: pair,
          participantsMap,
          pairKey,
          createdAt: now,
          updatedAt: now,
          lastMessage: {
            text: null,
            createdAt: null,
            seenBy: [],
            senderId: null,
          },
          memberIds: [uidA, uidB],
          members: [
            {
              id: otherUser.id || otherUser.uid || uidB,
              frequence: otherUser.frequence || 0,
              name: otherUserName,
              imageURL: otherUser.imageURL || otherUser.photoURL || "",
            },
            {
              id: currentUser.id || currentUser.uid || uidA,
              frequence: currentUser.frequence || 0,
              name: currentUserName,
              imageURL: currentUser.imageURL || currentUser.photoURL || "",
            },
          ],
        };

        const newDocRef = await addDoc(convsRef, newData).catch((error) => {
          console.log("Error creating conversation:", error);
          throw error;
        });
        console.log("[createChat] Created conversation", newDocRef.id);
        convId = newDocRef.id;
      }
    }

    // Return conversation data
    const convRef = doc(db, "conversations", convId);
    const convSnap = await getDoc(convRef);
    const conversation = {
      id: convId,
      ...(convSnap.exists ? convSnap.data() : {}),
    };

    return { id: convId, conversation };
  };

  // ============================================
  // Handle selecting a searched user
  // ============================================
  const handleSelectSearchedUser = async (user) => {
    try {
      setSearchLoading(true);

      // Get current user data
      const currentUser = {
        id: ADMIN_USER_ID,
        uid: ADMIN_USER_ID,
        displayName: ADMIN_DISPLAY_NAME,
        prenom: "Mathys",
        nom: "Fornasier",
        imageURL: "",
        photoURL: "",
        frequence: 0,
      };

      // Create or find conversation
      const { conversation } = await createChat(currentUser, user);

      // Update selected conversation
      setSelectedConversation(conversation);
      setShowChat(true);
      setShowSearchResults(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      console.error("Error selecting user:", error);
      showToast("Erreur lors de la création de la conversation", "error");
    } finally {
      setSearchLoading(false);
    }
  };

  // ============================================
  // Format timestamp
  // ============================================
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        return date.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        });
      }

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return "Hier";
      }

      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // ============================================
  // Get initials
  // ============================================
  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  // ============================================
  // Select conversation
  // ============================================
  const selectConversation = (conv) => {
    setSelectedConversation(conv);
    setShowChat(true);
  };

  const goBackToList = () => {
    setShowChat(false);
    setSelectedConversation(null);
  };

  return (
    <AuthGuard>
      <div className="flex h-[calc(100vh-57px)] text-slate-50">
        {/* CONVERSATIONS LIST */}
        <div
          className={`flex w-full flex-col border-r border-slate-800 bg-slate-900/60 md:w-80 lg:w-96 ${
            showChat ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Header */}
          <div className="border-b border-slate-800 px-4 py-4">
            <h1 className="text-lg font-semibold">Messagerie</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Search bar */}
          <div className="relative border-b border-slate-800 px-4 py-3">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.trim()) {
                    setShowSearchResults(true);
                  }
                }}
                placeholder="Rechercher un utilisateur..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 py-2 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Search results */}
            {showSearchResults && (
              <div className="absolute left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-lg">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <SpinnerIcon className="h-5 w-5 animate-spin text-sky-500" />
                  </div>
                ) : searchResults.length === 0 && searchQuery.trim() ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-slate-400">Aucun utilisateur trouvé</p>
                  </div>
                ) : (
                  searchResults.map((user) => {
                    const userName =
                      user.displayName ||
                      `${user.prenom || ""} ${user.nom || ""}`.trim() ||
                      "Utilisateur";
                    const userImageURL = user.imageURL || user.photoURL || "";

                    // Check if conversation already exists (same logic as createChat)
                    const userId = user.id || user.uid;
                    const existingConv = conversations.find((conv) => {
                      // Check by pairKey first (most reliable)
                      const pair = [ADMIN_USER_ID, userId].sort();
                      const pairKey = `${pair[0]}__${pair[1]}`;
                      if (conv.pairKey === pairKey) {
                        return true;
                      }

                      // Check by memberIds (both users must be present)
                      if (Array.isArray(conv.memberIds)) {
                        const hasBoth =
                          conv.memberIds.includes(ADMIN_USER_ID) &&
                          conv.memberIds.includes(userId);
                        if (hasBoth) {
                          // Additional check: should be a two-person conversation
                          const isTwoPerson =
                            conv.kind === "two_person" ||
                            conv.isTwoPeople === true ||
                            conv.type === "direct";
                          if (isTwoPerson) {
                            return true;
                          }
                        }
                      }

                      // Check by participants array
                      if (Array.isArray(conv.participants)) {
                        const hasBoth =
                          conv.participants.includes(ADMIN_USER_ID) &&
                          conv.participants.includes(userId);
                        if (hasBoth) {
                          const isTwoPerson =
                            conv.kind === "two_person" ||
                            conv.isTwoPeople === true ||
                            conv.type === "direct";
                          if (isTwoPerson) {
                            return true;
                          }
                        }
                      }

                      return false;
                    });

                    return (
                      <button
                        key={user.id}
                        onClick={() => {
                          if (existingConv) {
                            selectConversation(existingConv);
                            setShowSearchResults(false);
                            setSearchQuery("");
                            setSearchResults([]);
                          } else {
                            handleSelectSearchedUser(user);
                          }
                        }}
                        className="flex w-full items-center gap-3 border-b border-slate-800/50 px-4 py-3 text-left transition-colors hover:bg-slate-800/50 last:border-b-0"
                      >
                        {/* Avatar */}
                        <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-700">
                          {userImageURL ? (
                            <img
                              src={userImageURL}
                              alt={userName}
                              className="h-full w-full rounded-full object-cover"
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <span
                            className={`text-xs font-semibold ${userImageURL ? "hidden" : ""}`}
                            style={{ display: userImageURL ? "none" : "flex" }}
                          >
                            {getInitials(userName)}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium text-slate-100">
                              {userName}
                            </span>
                            {existingConv && (
                              <span className="flex-shrink-0 text-[10px] text-sky-400">
                                Existe
                              </span>
                            )}
                          </div>
                          {user.email && (
                            <p className="mt-0.5 truncate text-xs text-slate-400">
                              {user.email}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <SpinnerIcon className="h-6 w-6 animate-spin text-sky-500" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageIcon className="mb-3 h-10 w-10 text-slate-600" />
                <p className="text-sm text-slate-400">Aucune conversation</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const other = getOtherUser(conv);
                const isSelected = selectedConversation?.id === conv.id;
                const lastMsg = conv.lastMessage?.lastMessage || "";
                const lastTime = conv.lastMessage?.lastMessageAt || conv.updatedAt;

                return (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`flex w-full items-center gap-3 border-b border-slate-800/50 px-4 py-3 text-left transition-colors hover:bg-slate-800/50 ${
                      isSelected ? "bg-slate-800" : ""
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-slate-700">
                      {other?.imageURL ? (
                        <img
                          src={other.imageURL}
                          alt={other.name}
                          className="h-full w-full rounded-full object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <span
                        className={`text-xs font-semibold ${other?.imageURL ? "hidden" : ""}`}
                        style={{ display: other?.imageURL ? "none" : "flex" }}
                      >
                        {getInitials(other?.name)}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-100">
                          {other?.name || "Utilisateur"}
                        </span>
                        <span className="flex-shrink-0 text-[10px] text-slate-500">
                          {formatTime(lastTime)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {lastMsg || "Aucun message"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CHAT VIEW */}
        <div
          className={`flex flex-1 flex-col bg-slate-950 ${
            showChat ? "flex" : "hidden md:flex"
          }`}
        >
          {!selectedConversation ? (
            // No conversation selected
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <MessageIcon className="mb-4 h-16 w-16 text-slate-700" />
              <p className="text-sm text-slate-500">
                Sélectionnez une conversation pour commencer
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
                {/* Back button (mobile) */}
                <button
                  onClick={goBackToList}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 md:hidden"
                >
                  <BackIcon className="h-5 w-5" />
                </button>

                {/* Avatar */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700">
                  {getOtherUser(selectedConversation)?.imageURL ? (
                    <img
                      src={getOtherUser(selectedConversation).imageURL}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold">
                      {getInitials(getOtherUser(selectedConversation)?.name)}
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-semibold">
                    {getOtherUser(selectedConversation)?.name || "Utilisateur"}
                  </h2>
                  <p className="text-[10px] text-slate-400">
                    ID: {getOtherUser(selectedConversation)?.id}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <SpinnerIcon className="h-6 w-6 animate-spin text-sky-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm text-slate-500">
                      Aucun message dans cette conversation
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isMe = msg.senderId === ADMIN_USER_ID;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                              isMe
                                ? "rounded-br-md bg-sky-500 text-white"
                                : "rounded-bl-md bg-slate-800 text-slate-100"
                            }`}
                          >
                            {!isMe && (
                              <p className="mb-1 text-[10px] font-medium text-slate-400">
                                {msg.senderDisplayName || "Utilisateur"}
                              </p>
                            )}
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {msg.text}
                            </p>
                            <p
                              className={`mt-1 text-right text-[10px] ${
                                isMe ? "text-sky-200" : "text-slate-500"
                              }`}
                            >
                              {formatMessageTime(msg.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message input */}
              <form
                onSubmit={handleSendMessage}
                className="flex items-center gap-3 border-t border-slate-800 px-4 py-3"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Écrire un message..."
                  disabled={sending}
                  className="flex-1 rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sending}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
                >
                  {sending ? (
                    <SpinnerIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <SendIcon className="h-5 w-5" />
                  )}
                </button>
              </form>
            </>
          )}
        </div>

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
    </AuthGuard>
  );
}

// ============================================
// Icons
// ============================================

function MessageIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SendIcon({ className }) {
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
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22,2 15,22 11,13 2,9" />
    </svg>
  );
}

function BackIcon({ className }) {
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
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

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

function SearchIcon({ className }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function CloseIcon({ className }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}




