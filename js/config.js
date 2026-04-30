// config.js - Configuração e inicialização do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCTxuAncGHfdMjLs6bo8Wk3pT2sVpuNtjg",
    authDomain: "vidacor-vendedor-pro-8ce28.firebaseapp.com",
    projectId: "vidacor-vendedor-pro-8ce28",
    storageBucket: "vidacor-vendedor-pro-8ce28.firebasestorage.app",
    messagingSenderId: "634300515733",
    appId: "1:634300515733:web:0a5c71d7349f065703629c",
    measurementId: "G-1S26Z1MWQH"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();