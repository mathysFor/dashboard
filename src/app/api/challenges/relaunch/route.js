import { NextResponse } from "next/server";
import { adminDb } from "../../../../../lib/firebaseAdmin";
import { getNextSundayInTwoWeeks } from "../../../../../lib/challengeUtils";
import admin from "firebase-admin";

/**
 * API Route to detect finished challenges and create relaunch copies
 * 
 * POST /api/challenges/relaunch
 * 
 * This endpoint:
 * 1. Finds challenges with deadline < now, archived != true, kind != 'station'
 * 2. Archives them (archived: true)
 * 3. Creates a copy with new deadline (Sunday in 2 weeks)
 * 4. Sets new challenge status to "non_active" for validation
 */
export async function POST(request) {
  try {
    // Optional: Verify authentication for admin access
    // You can add token verification here if needed
    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        await admin.auth().verifyIdToken(token);
      } catch (authError) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const now = new Date();
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

    // Query challenges that are finished
    // Note: We filter archived status in code because != doesn't handle missing fields well
    const challengesRef = adminDb.collection("challenges");
    const finishedChallengesQuery = challengesRef.where("deadline", "<", nowTimestamp);

    const snapshot = await finishedChallengesQuery.get();

    if (snapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No finished challenges to process",
        processed: 0,
      });
    }

    const results = [];
    const batch = adminDb.batch();

    // Calculate the new deadline (Sunday in 2 weeks)
    const newDeadline = getNextSundayInTwoWeeks();
    const newDeadlineTimestamp = admin.firestore.Timestamp.fromDate(newDeadline);

    for (const docSnap of snapshot.docs) {
      const challengeData = docSnap.data();
      const challengeId = docSnap.id;

      // Skip if already archived
      if (challengeData.archived === true) {
        continue;
      }

      // Skip challenges with kind === 'station'
      if (challengeData.kind === "station") {
        continue;
      }

      // 1. Archive the finished challenge
      const challengeRef = challengesRef.doc(challengeId);
      batch.update(challengeRef, {
        archived: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 2. Create a copy for relaunch
      // Prepare the new challenge data
      const {
        participantsCount,
        createdAt,
        updatedAt,
        deadline,
        archived,
        id,
        ...challengeDataToCopy
      } = challengeData;

      const newChallengeData = {
        ...challengeDataToCopy,
        participantsCount: 0,
        status: "non_active",
        archived: false,
        deadline: newDeadlineTimestamp,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        originalChallengeId: challengeId, // Track the original challenge
      };

      // Create new challenge document
      const newChallengeRef = challengesRef.doc();
      batch.set(newChallengeRef, newChallengeData);

      results.push({
        originalId: challengeId,
        newId: newChallengeRef.id,
        title: challengeData.title || challengeData.name || challengeId,
        newDeadline: newDeadline.toISOString(),
      });
    }

    // Commit all changes in a single batch
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} challenge(s)`,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in challenge relaunch webhook:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}

