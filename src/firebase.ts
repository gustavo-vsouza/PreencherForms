import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyApfQkKUyqAFbG1CDDHHRpYbskzFNN19hI",
  authDomain: "gestao-de-relatorios-af618.firebaseapp.com",
  projectId: "gestao-de-relatorios-af618",
  storageBucket: "gestao-de-relatorios-af618.firebasestorage.app",
  messagingSenderId: "128410309645",
  appId: "1:128410309645:web:1e3f943c0b3f85051d3144",
  measurementId: "G-V03KK1EZ4V"
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
