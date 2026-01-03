"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  where,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "../../../../lib/firebase";
import AuthGuard from "../../../../lib/AuthGuard";

const GENERATE_MP4_URL = "https://generatemp4download-mzjdnoxk2q-uc.a.run.app";
const DELETE_VIDEO_URL = "https://deletevideo-mzjdnoxk2q-uc.a.run.app";

export default function VideosPage() {
  // Challenge selection
  const [challenges, setChallenges] = useState([]);
  const [challengesLoading, setChallengesLoading] = useState(true);
  const [selectedChallengeId, setSelectedChallengeId] = useState("");
  const [selectedChallenge, setSelectedChallenge] = useState(null);

  // Posts
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, participants: 0, ready: 0 });

  // Player modal
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerUrl, setPlayerUrl] = useState("");
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Toast
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Loading states for actions
  const [downloadingId, setDownloadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [exportingAll, setExportingAll] = useState(false);

  // Sort mode
  const [sortBy, setSortBy] = useState("date"); // "date" or "likes"

  // ============================================
  // Filter challenges: active + last finished
  // ============================================
  const filterRelevantChallenges = (challengesList) => {
    const now = new Date();
    
    // Separate active and finished challenges
    const activeChallenges = challengesList.filter(
      (challenge) => challenge.status === "active"
    );
    
    const finishedChallenges = challengesList
      .filter((challenge) => {
        // Check if challenge is finished (deadline < now)
        if (!challenge.deadline) return false;
        
        const deadlineDate = challenge.deadline.toDate
          ? challenge.deadline.toDate()
          : new Date(challenge.deadline);
        
        return deadlineDate < now;
      })
      .sort((a, b) => {
        // Sort by deadline descending (most recent first)
        const deadlineA = a.deadline.toDate
          ? a.deadline.toDate()
          : new Date(a.deadline);
        const deadlineB = b.deadline.toDate
          ? b.deadline.toDate()
          : new Date(b.deadline);
        return deadlineB.getTime() - deadlineA.getTime();
      });
    
    // Get the most recent finished challenge (first in sorted array)
    const lastFinishedChallenge =
      finishedChallenges.length > 0 ? [finishedChallenges[0]] : [];
    
    // Combine active challenges + last finished challenge
    const relevantChallenges = [...activeChallenges, ...lastFinishedChallenge];
    
    // Remove duplicates (in case a challenge is both active and the last finished)
    const uniqueChallenges = relevantChallenges.filter(
      (challenge, index, self) =>
        index === self.findIndex((c) => c.id === challenge.id)
    );
    
    return uniqueChallenges;
  };

  // ============================================
  // Load all challenges on mount
  // ============================================
  useEffect(() => {
    const loadChallenges = async () => {
      try {
        setChallengesLoading(true);
        const challengesSnap = await getDocs(
          query(collection(db, "challenges"), orderBy("createdAt", "desc"))
        );
        const challengesList = challengesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // Filter to show only active challenges + last finished challenge
        const filteredChallenges = filterRelevantChallenges(challengesList);
        setChallenges(filteredChallenges);
      } catch (error) {
        console.error("Error loading challenges:", error);
        showToast("Erreur lors du chargement des challenges", "error");
      } finally {
        setChallengesLoading(false);
      }
    };

    loadChallenges();
  }, []);

  // ============================================
  // Load posts when challenge is selected
  // ============================================
  const loadPosts = useCallback(async (challengeId) => {
    if (!challengeId) {
      setPosts([]);
      setStats({ total: 0, participants: 0, ready: 0 });
      return;
    }

    try {
      setPostsLoading(true);
      const postsSnap = await getDocs(
        query(
          collection(db, "challenges", challengeId, "posts"),
          orderBy("createdAt", "desc")
        )
      );

      let postsList = postsSnap.docs
        .map((doc) => ({ id: doc.id, challengeId, ...doc.data() }))
        .filter((post) => post.type === "video");

      // Apply sorting based on sortBy mode
      if (sortBy === "likes") {
        postsList = [...postsList].sort((a, b) => {
          const likesA = a.likesCount || 0;
          const likesB = b.likesCount || 0;
          return likesB - likesA; // Descending order (most likes first)
        });
      } else {
        // Default: sort by date (already sorted by createdAt desc from query)
        postsList = [...postsList].sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
        });
      }

      setPosts(postsList);

      // Update stats
      const uniqueAuthors = new Set(postsList.map((p) => p.authorId)).size;
      const readyCount = postsList.filter((p) => p.uploadStatus === "ready").length;
      setStats({ total: postsList.length, participants: uniqueAuthors, ready: readyCount });
    } catch (error) {
      console.error("Error loading posts:", error);
      showToast("Erreur lors du chargement des vidéos", "error");
    } finally {
      setPostsLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    if (selectedChallengeId) {
      const challenge = challenges.find((c) => c.id === selectedChallengeId);
      setSelectedChallenge(challenge || null);
      loadPosts(selectedChallengeId);
    } else {
      setSelectedChallenge(null);
      setPosts([]);
      setStats({ total: 0, participants: 0, ready: 0 });
    }
  }, [selectedChallengeId, challenges, loadPosts, sortBy]);

  // ============================================
  // Toast helper
  // ============================================
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  // ============================================
  // Get playback URL (HLS)
  // ============================================
  const getPlaybackUrl = (post) => {
    const streamId = post.streamId;
    const hlsUrl = post.hlsUrl || post.mainMediaUrl || "";

    if (streamId) {
      return `https://customer-u3x9n6q7oawrn63f.cloudflarestream.com/${streamId}/manifest/video.m3u8`;
    }

    if (hlsUrl && hlsUrl.includes("bunnycdn.com")) {
      return hlsUrl;
    }

    if (hlsUrl && hlsUrl.includes("videodelivery.net")) {
      return hlsUrl;
    }

    return hlsUrl || "";
  };

  // ============================================
  // Play video in modal
  // ============================================
  const playVideo = (post) => {
    if (post.uploadStatus !== "ready") {
      showToast("Vidéo non prête", "error");
      return;
    }

    const url = getPlaybackUrl(post);
    if (!url) {
      showToast("Lien de lecture indisponible", "error");
      return;
    }

    setPlayerUrl(url);
    setPlayerOpen(true);
  };

  // Initialize HLS player when modal opens
  useEffect(() => {
    if (!playerOpen || !playerUrl || !videoRef.current) return;

    const isHls = playerUrl.endsWith(".m3u8");

    const initPlayer = async () => {
      if (isHls && typeof window !== "undefined") {
        const Hls = (await import("hls.js")).default;
        if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(playerUrl);
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            videoRef.current?.play().catch(() => {});
          });
        } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
          videoRef.current.src = playerUrl;
          videoRef.current.play().catch(() => {});
        }
      } else {
        videoRef.current.src = playerUrl;
        videoRef.current.play().catch(() => {});
      }
    };

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playerOpen, playerUrl]);

  const closePlayer = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
    }
    setPlayerOpen(false);
    setPlayerUrl("");
  };

  // ============================================
  // Download video
  // ============================================
  const downloadVideo = async (post) => {
    if (post.uploadStatus !== "ready") {
      showToast("Vidéo non prête", "error");
      return;
    }

    // Open window immediately to avoid popup blocker
    const downloadWindow = window.open("about:blank", "_blank");
    setDownloadingId(post.id);

    try {
      let downloadUrl = null;
      const streamId = post.streamId;
      const url = post.hlsUrl || post.mainMediaUrl;

      if (streamId) {
        const idToken = await auth.currentUser?.getIdToken(true);
        if (!idToken) throw new Error("Not authenticated");

        const response = await fetch(GENERATE_MP4_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ streamId }),
        });

        if (!response.ok) throw new Error("Failed to generate MP4");

        const data = await response.json();
        downloadUrl =
          data.downloadUrl ||
          `https://customer-u3x9n6q7oawrn63f.cloudflarestream.com/${streamId}/downloads/default.mp4`;
      } else if (url && url.includes("bunnycdn.com")) {
        downloadUrl = url.replace("playlist.m3u8", "play_720p.mp4");
      } else if (url && url.includes("videodelivery.net")) {
        const matches = url.match(/videodelivery\.net\/([^\/]+)\//);
        const extractedStreamId = matches ? matches[1] : null;

        if (extractedStreamId) {
          const idToken = await auth.currentUser?.getIdToken(true);
          if (idToken) {
            await fetch(GENERATE_MP4_URL, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ streamId: extractedStreamId }),
            });
            downloadUrl = `https://customer-u3x9n6q7oawrn63f.cloudflarestream.com/${extractedStreamId}/downloads/default.mp4`;
          }
        }
      }

      if (!downloadUrl) {
        downloadWindow?.close();
        throw new Error("Impossible de générer le lien de téléchargement");
      }

      if (downloadWindow) {
        downloadWindow.location.href = downloadUrl;
      }

      showToast("Téléchargement lancé !", "success");
    } catch (error) {
      console.error("Download error:", error);
      downloadWindow?.close();
      showToast("Erreur lors du téléchargement", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  // ============================================
  // Delete post
  // ============================================
  const deletePost = async (post) => {
    const confirmed = window.confirm("Supprimer cette vidéo ?");
    if (!confirmed) return;

    const challengeId = post.challengeId || selectedChallengeId;
    const authorId = post.authorId || post.author_id || post.uid;

    if (!challengeId || !authorId) {
      showToast("Données manquantes pour supprimer", "error");
      return;
    }

    setDeletingId(post.id);

    try {
      const idToken = await auth.currentUser?.getIdToken(true);

      // Delete video on Cloudflare if needed
      if (post.streamId && idToken) {
        try {
          await fetch(DELETE_VIDEO_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ streamId: post.streamId }),
          });
        } catch (e) {
          console.error("[deletePost] Cloudflare deletion failed", e);
        }
      }

      // Delete post document
      await deleteDoc(doc(db, "challenges", challengeId, "posts", post.id));

      // Batch delete reactions/comments/index
      const batch = writeBatch(db);

      const reactionsSnap = await getDocs(
        query(collection(db, "postReactions"), where("postId", "==", post.id))
      );
      reactionsSnap.forEach((docSnap) => batch.delete(docSnap.ref));

      const commentsSnap = await getDocs(
        query(collection(db, "postComments"), where("postId", "==", post.id))
      );
      commentsSnap.forEach((docSnap) => batch.delete(docSnap.ref));

      const userIndexRef = doc(db, "users", authorId, "postsIndex", post.id);
      batch.delete(userIndexRef);

      await batch.commit();

      // Check if author still has posts in challenge
      const otherPostsSnap = await getDocs(
        query(
          collection(db, "challenges", challengeId, "posts"),
          where("authorId", "==", authorId)
        )
      );

      if (otherPostsSnap.empty) {
        await updateDoc(doc(db, "challenges", challengeId), {
          participantsCount: increment(-1),
        });

        try {
          await deleteDoc(doc(db, "challengeMembers", `${challengeId}_${authorId}`));
        } catch {}
      }

      // Decrement user posts count
      await updateDoc(doc(db, "users", authorId), {
        postsCount: increment(-1),
      });

      // Update UI
      const newPosts = posts.filter((p) => p.id !== post.id);
      setPosts(newPosts);

      const uniqueAuthors = new Set(newPosts.map((p) => p.authorId)).size;
      const readyCount = newPosts.filter((p) => p.uploadStatus === "ready").length;
      setStats({ total: newPosts.length, participants: uniqueAuthors, ready: readyCount });

      showToast("Vidéo supprimée", "success");
    } catch (error) {
      console.error("Delete post error:", error);
      showToast("Erreur lors de la suppression", "error");
    } finally {
      setDeletingId(null);
    }
  };

  // ============================================
  // Export all links as CSV
  // ============================================
  const downloadAllLinks = async () => {
    const readyPosts = posts.filter((p) => p.uploadStatus === "ready");

    if (readyPosts.length === 0) {
      showToast("Aucune vidéo prête à télécharger", "error");
      return;
    }

    setExportingAll(true);
    showToast("Génération des liens en cours...", "success");

    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const links = [];

      for (const post of readyPosts) {
        let downloadUrl = "";

        if (post.streamId) {
          try {
            if (idToken) {
              await fetch(GENERATE_MP4_URL, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${idToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ streamId: post.streamId }),
              });
            }
            downloadUrl = `https://customer-u3x9n6q7oawrn63f.cloudflarestream.com/${post.streamId}/downloads/default.mp4`;
          } catch {
            downloadUrl = "Erreur génération";
          }
        } else if (post.hlsUrl && post.hlsUrl.includes("bunnycdn.com")) {
          downloadUrl = post.hlsUrl.replace("playlist.m3u8", "play_720p.mp4");
        }

        links.push({
          author: post.authorName || "Anonyme",
          date: post.createdAt?.toDate?.()?.toISOString?.() || "",
          text: (post.text || "").replace(/"/g, '""'),
          url: downloadUrl,
        });
      }

      // Generate CSV
      const csvHeader = "Auteur,Date,Description,Lien de téléchargement\n";
      const csvContent = links
        .map((l) => `"${l.author}","${l.date}","${l.text}","${l.url}"`)
        .join("\n");

      const csv = csvHeader + csvContent;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `wintermate_videos_${selectedChallengeId}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`${links.length} liens exportés !`, "success");
    } catch (error) {
      console.error("Export error:", error);
      showToast("Erreur lors de l'export", "error");
    } finally {
      setExportingAll(false);
    }
  };

  // ============================================
  // Helpers
  // ============================================
  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const getStatusLabel = (status) => {
    const labels = {
      ready: "Prête",
      created: "En cours",
      processing: "Traitement",
      error: "Erreur",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      ready: "bg-emerald-500/20 text-emerald-400",
      created: "bg-amber-500/20 text-amber-400",
      processing: "bg-sky-500/20 text-sky-400",
      error: "bg-red-500/20 text-red-400",
    };
    return colors[status] || "bg-slate-500/20 text-slate-400";
  };

  // Check if challenge is finished
  const isChallengeFinished = (challenge) => {
    if (!challenge.deadline) return false;
    const now = new Date();
    const deadlineDate = challenge.deadline.toDate
      ? challenge.deadline.toDate()
      : new Date(challenge.deadline);
    return deadlineDate < now;
  };

  // Format deadline date
  const formatDeadlineDate = (challenge) => {
    if (!challenge.deadline) return "";
    const deadlineDate = challenge.deadline.toDate
      ? challenge.deadline.toDate()
      : new Date(challenge.deadline);
    return deadlineDate.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Get challenge display text with badge and date
  const getChallengeDisplayText = (challenge) => {
    const title = challenge.title || challenge.name || challenge.id;
    const isFinished = isChallengeFinished(challenge);
    const dateStr = formatDeadlineDate(challenge);
    const badge = isFinished ? " [Terminé]" : " [En cours]";
    const dateInfo = dateStr ? ` - ${dateStr}` : "";
    return `${title}${badge}${dateInfo}`;
  };

  return (
    <AuthGuard>
      <div className="text-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
          {/* HEADER */}
          <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Gestion des Vidéos
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Visualiser, télécharger et supprimer les vidéos des challenges.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy(sortBy === "date" ? "likes" : "date")}
                disabled={!selectedChallengeId || postsLoading}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  sortBy === "likes"
                    ? "border-sky-500 bg-sky-500/20 text-sky-400 hover:bg-sky-500/30"
                    : "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                }`}
              >
                {sortBy === "likes" ? (
                  <>
                    <HeartIcon className="h-4 w-4" />
                    Tri par likes
                  </>
                ) : (
                  <>
                    <CalendarIcon className="h-4 w-4" />
                    Tri par date
                  </>
                )}
              </button>
              <button
                onClick={() => loadPosts(selectedChallengeId)}
                disabled={!selectedChallengeId || postsLoading}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                <RefreshIcon className="h-4 w-4" />
                Actualiser
              </button>
              <button
                onClick={downloadAllLinks}
                disabled={!selectedChallengeId || posts.length === 0 || exportingAll}
                className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
              >
                {exportingAll ? (
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <DownloadIcon className="h-4 w-4" />
                )}
                Exporter CSV
              </button>
            </div>
          </header>

          {/* CHALLENGE SELECTOR */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Sélectionner un Challenge
            </label>
            <select
              value={selectedChallengeId}
              onChange={(e) => setSelectedChallengeId(e.target.value)}
              disabled={challengesLoading}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-50"
            >
              <option value="">
                {challengesLoading ? "Chargement..." : "-- Choisir un challenge --"}
              </option>
              {challenges.map((challenge) => (
                <option key={challenge.id} value={challenge.id}>
                  {getChallengeDisplayText(challenge)}
                </option>
              ))}
            </select>
          </section>

          {/* STATS */}
          {selectedChallengeId && (
            <section className="grid grid-cols-3 gap-4">
              <StatCard label="Total vidéos" value={stats.total} />
              <StatCard label="Participants" value={stats.participants} />
              <StatCard label="Prêtes" value={stats.ready} />
            </section>
          )}

          {/* CONTENT */}
          {!selectedChallengeId ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 py-16 text-center">
              <VideoIcon className="mb-4 h-12 w-12 text-slate-600" />
              <p className="text-sm text-slate-400">
                Sélectionnez un challenge pour voir les vidéos
              </p>
            </div>
          ) : postsLoading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 py-16">
              <SpinnerIcon className="h-8 w-8 animate-spin text-sky-500" />
              <p className="mt-4 text-sm text-slate-400">Chargement des vidéos...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 py-16 text-center">
              <VideoIcon className="mb-4 h-12 w-12 text-slate-600" />
              <p className="text-sm text-slate-400">
                Aucune vidéo dans ce challenge
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {posts.map((post) => (
                <VideoCard
                  key={post.id}
                  post={post}
                  onPlay={() => playVideo(post)}
                  onDownload={() => downloadVideo(post)}
                  onDelete={() => deletePost(post)}
                  isDownloading={downloadingId === post.id}
                  isDeleting={deletingId === post.id}
                  getInitials={getInitials}
                  getStatusLabel={getStatusLabel}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>
          )}
        </div>

        {/* VIDEO PLAYER MODAL */}
        {playerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={closePlayer}
          >
            <div
              className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closePlayer}
                className="absolute right-4 top-4 z-10 rounded-full bg-slate-800/80 p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
              <video
                ref={videoRef}
                controls
                playsInline
                className="aspect-video w-full bg-black"
              />
            </div>
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
    </AuthGuard>
  );
}

// ============================================
// Components
// ============================================

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </div>
    </div>
  );
}

function VideoCard({
  post,
  onPlay,
  onDownload,
  onDelete,
  isDownloading,
  isDeleting,
  getInitials,
  getStatusLabel,
  getStatusColor,
}) {
  const isReady = post.uploadStatus === "ready";
  const authorName = post.authorName || "Anonyme";
  const thumbnail = post.thumbnailUrl || "";

  return (
    <div className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 transition-colors hover:border-slate-700">
      {/* Thumbnail */}
      <div
        className="relative aspect-video cursor-pointer bg-slate-800"
        onClick={onPlay}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt="Thumbnail"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <VideoIcon className="h-12 w-12 text-slate-600" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
          <div className="rounded-full bg-white/20 p-3 backdrop-blur">
            <PlayIcon className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Status badge */}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${getStatusColor(post.uploadStatus)}`}
        >
          {getStatusLabel(post.uploadStatus)}
        </span>

        {/* Likes badge */}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 backdrop-blur-sm">
          <HeartIcon className="h-3 w-3 text-white" />
          <span className="text-[10px] font-semibold text-white">
            {post.likesCount || 0}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold">
            {post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={authorName}
                className="h-full w-full rounded-full object-cover"
                onError={(e) => {
                  e.target.parentElement.textContent = getInitials(authorName);
                }}
              />
            ) : (
              getInitials(authorName)
            )}
          </div>
          <span className="truncate text-xs font-medium text-slate-200">
            {authorName}
          </span>
        </div>

        {post.text && (
          <p className="mt-2 line-clamp-2 text-xs text-slate-400">{post.text}</p>
        )}

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={!isReady || isDeleting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {isDeleting ? (
              <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <TrashIcon className="h-3.5 w-3.5" />
            )}
            {isDeleting ? "..." : "Supprimer"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            disabled={!isReady || isDownloading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
          >
            {isDownloading ? (
              <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <DownloadIcon className="h-3.5 w-3.5" />
            )}
            {isDownloading ? "..." : "Télécharger"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function VideoIcon({ className }) {
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
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function PlayIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function DownloadIcon({ className }) {
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
      <path d="M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V15" />
      <polyline points="7,10 12,15 17,10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon({ className }) {
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
      <path d="M3 6H5H21" />
      <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6" />
      <path d="M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6" />
      <path d="M10 11V17" />
      <path d="M14 11V17" />
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

function HeartIcon({ className }) {
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
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CalendarIcon({ className }) {
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
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

