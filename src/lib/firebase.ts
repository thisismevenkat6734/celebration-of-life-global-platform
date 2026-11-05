import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCm2ZwhbLg6SSY2qwAiOdfrMDx1i8sJjIQ",
  authDomain: "celebration-of-life-d3dfa.firebaseapp.com",
  projectId: "celebration-of-life-d3dfa",
  storageBucket: "celebration-of-life-d3dfa.firebasestorage.app",
  messagingSenderId: "808280368245",
  appId: "1:808280368245:web:a92fec777882dbf61a043c",
};

const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

export const db = getFirestore(firebaseApp);

export const authPersistence = setPersistence(
  auth,
  browserLocalPersistence
);

export default firebaseApp;
