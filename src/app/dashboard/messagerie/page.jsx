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
} from "firebase/firestore";
import { db } from "../../../../lib/firebase";
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

