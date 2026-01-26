// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDxud_UEWbzW5QFrxmpWyR7eSBGupVgxzU",
  authDomain: "todo-reminder-1f382.firebaseapp.com",
  projectId: "todo-reminder-1f382",
  storageBucket: "todo-reminder-1f382.firebasestorage.app",
  messagingSenderId: "267299790273",
  appId: "1:267299790273:web:822c2b0e6f4ab6c0c06340",
  measurementId: "G-WCVPJCTKDW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);