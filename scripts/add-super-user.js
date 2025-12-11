/**
 * Script pour ajouter SUPER_USER: true à un utilisateur spécifique dans Firestore
 * 
 * Usage:
 *   node scripts/add-super-user.js
 * 
 * Ce script ajoute le champ SUPER_USER: true au document Firestore
 * de l'utilisateur avec l'ID: bn0pM2tyf2ey42aZXHTHc4RL61i2
 */

const admin = require("firebase-admin");
const path = require("path");

// Chemin vers le fichier service-account.json
const serviceAccountPath = path.join(__dirname, "..", "service-account.json");
const serviceAccount = require(serviceAccountPath);

// ID de l'utilisateur à promouvoir en SUPER_USER
const USER_ID = "bn0pM2tyf2ey42aZXHTHc4RL61i2";

// Initialiser Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const db = admin.firestore();

async function addSuperUser() {
  try {
    console.log(`Ajout de SUPER_USER: true à l'utilisateur ${USER_ID}...`);

    const userRef = db.collection("users").doc(USER_ID);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error(`❌ Erreur: Le document utilisateur avec l'ID ${USER_ID} n'existe pas dans Firestore.`);
      console.log("💡 Vérifiez que l'ID utilisateur est correct et que le document existe dans la collection 'users'.");
      process.exit(1);
    }

    const currentData = userDoc.data();
    console.log(`📄 Document actuel:`, JSON.stringify(currentData, null, 2));

    // Vérifier si SUPER_USER existe déjà
    if (currentData.SUPER_USER === true) {
      console.log(`✅ L'utilisateur ${USER_ID} a déjà SUPER_USER: true. Aucune modification nécessaire.`);
      process.exit(0);
    }

    // Ajouter ou mettre à jour SUPER_USER: true
    await userRef.update({
      SUPER_USER: true,
    });

    console.log(`✅ Succès! SUPER_USER: true a été ajouté à l'utilisateur ${USER_ID}.`);

    // Vérifier la mise à jour
    const updatedDoc = await userRef.get();
    const updatedData = updatedDoc.data();
    console.log(`📄 Document mis à jour:`, JSON.stringify(updatedData, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de SUPER_USER:", error);
    process.exit(1);
  }
}

// Exécuter le script
addSuperUser();
