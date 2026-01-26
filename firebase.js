// firebase.js（瀏覽器 CDN 版，GitHub Pages 專用）
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
  apiKey: "AIzaSyDxud_UEWbzW5QFrxmpWyR7eSBGupVgxzU",
  authDomain: "todo-reminder-1f382.firebaseapp.com",
  projectId: "todo-reminder-1f382",
  storageBucket: "todo-reminder-1f382.appspot.com", // ✅ 修正
  messagingSenderId: "267299790273",
  appId: "1:267299790273:web:822c2b0e6f4ab6c0c06340"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🔥 讓 app.js 使用
window.db = db;
window.fs = {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
};
