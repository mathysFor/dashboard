// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-librarie

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCwXeUSUifpzm8Ia8CkluidCWr4XviNMtM",
  authDomain: "winteracademynew.firebaseapp.com",
  projectId: "winteracademynew",
  storageBucket: "winteracademynew.firebasestorage.app",
  messagingSenderId: "445092743058",
  appId: "1:445092743058:web:a0f20a6eca0a9d985b234b"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);