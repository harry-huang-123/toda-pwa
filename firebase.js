// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxdU_EWbzW5QFrxmpWyR7eSBGupVgxzU",
  authDomain: "todo-reminder-1f382.firebaseapp.com",
  projectId: "todo-reminder-1f382",
  storageBucket: "todo-reminder-1f382.appspot.com",
  messagingSenderId: "267299790273",
  appId: "1:267299790273:web:822c2b0e6f4ab6c0c06340"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔥 關鍵：掛到 window，讓 app.js 用得到
window.db = db;
window.fs = {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
};
