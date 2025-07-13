import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWRDU9WCvVjns7If96eLze75v6tIldOVQ",
  authDomain: "pooltogether-69b50.firebaseapp.com",
  projectId: "pooltogether-69b50",
  storageBucket: "pooltogether-69b50.appspot.com",
  messagingSenderId: "531393414453",
  appId: "1:531393414453:web:21a9de47373e35eb81787c"
};

let app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI();
  if (user) {
    getUserLocationAndListen();
    getMyRequests();
  } else {
    document.getElementById("myRequestList").innerHTML = "";
  }
});

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

loginBtn.onclick = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    updateAuthUI();
  } catch (err) {
    alert("Login failed");
    console.error(err);
  }
};

logoutBtn.onclick = async () => {
  await signOut(auth);
  currentUser = null;
  updateAuthUI();
};

function updateAuthUI() {
  if (currentUser) {
    userInfo.textContent = `👋 Hello, ${currentUser.displayName}`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
  } else {
    userInfo.textContent = "";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
  }
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI();
  if (user) {
    setTimeout(() => {
      onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI(); // this is already in your code
  if (user) {
    getUserLocationAndListen(); // 🔒 safe to run now
    getMyRequests();            // 🔒 safe to run now
  } else {
    document.getElementById("myRequestList").innerHTML = ""; // optional
  }
});

    }, 1000);
  } else {
    document.getElementById("myRequestList").innerHTML = "";
    document.getElementById("requestList").innerHTML = "";
  }
});

document.getElementById("orderForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!auth.currentUser) return alert("You must be logged in to submit a request.");

  const item = document.getElementById("item").value;
  const platform = document.getElementById("platform").value;
  const duration = parseInt(document.getElementById("duration").value);

  if (!navigator.geolocation) return alert("Geolocation not supported.");

navigator.geolocation.getCurrentPosition(
  async (position) => {
    const { latitude, longitude } = position.coords;
    const duration = parseInt(document.getElementById("duration").value);
    const deleteAt = new Date(Date.now() + duration * 60 * 1000);

    try {
      await addDoc(collection(db, "requests"), {
        item,
        platform,
        latitude,
        longitude,
        timestamp: serverTimestamp(),
        deleteAt,
        uid: auth.currentUser?.uid,
        name: auth.currentUser?.displayName
      });

      alert("✅ Request submitted successfully!");
      document.getElementById("orderForm").reset();
    } catch (err) {
      console.error("Firestore Error:", err);
      alert("❌ Failed to submit request.");
    }
  },
  (error) => {
    console.error("❌ Location Error:", error);
    alert("❌ Failed to get location. Please allow location access.");
  }
);


});

function getUserLocationAndListen() {
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    liveNearbyRequests(latitude, longitude);
  }, (err) => {
    console.error(err);
    alert("Location access denied.");
  });
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function liveNearbyRequests(currentLat, currentLng) {
  const listEl = document.getElementById("requestList");
  listEl.innerHTML = "Loading nearby requests...";

  onSnapshot(collection(db, "requests"), (snapshot) => {
    listEl.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const deleteTime = data.deleteAt?.toDate?.() ?? new Date(0);
      if (deleteTime < new Date()) return;

      const distance = getDistanceFromLatLonInKm(currentLat, currentLng, data.latitude, data.longitude);
      if (distance > 1) return;

      const li = document.createElement("li");

      const contentDiv = document.createElement("div");
      contentDiv.className = "msg-content";
      contentDiv.innerHTML = `
        <strong>🛒 ${data.item}</strong><br/>
        <span>Platform: ${data.platform}</span><br/>
        <span>📍 ${distance.toFixed(2)} km away</span>
      `;

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "msg-actions";

      const timerSpan = document.createElement("span");
      timerSpan.className = "timer";

      const joinBtn = document.createElement("button");
      joinBtn.style.marginRight = "8px";

      const chatBtn = document.createElement("button");
      chatBtn.textContent = "💬 Chat";
      chatBtn.style.display = "none";

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "❌ Delete";
      deleteBtn.style.display = (data.uid === currentUser?.uid) ? "inline-block" : "none";
      deleteBtn.onclick = async () => {
        await deleteDoc(doc(db, "requests", docSnap.id));
        li.remove();
      };

      const joinedUsersRef = collection(db, `requests/${docSnap.id}/joinedUsers`);

      onSnapshot(joinedUsersRef, (joinedSnap) => {
        const userDoc = joinedSnap.docs.find(doc => doc.data().name === currentUser.displayName);

        if (userDoc) {
          joinBtn.textContent = "🚪 Unjoin";
          joinBtn.style.backgroundColor = "#f44336";
          chatBtn.style.display = "inline-block";

          joinBtn.onclick = async () => {
            await deleteDoc(doc(db, `requests/${docSnap.id}/joinedUsers/${userDoc.id}`));
            joinBtn.textContent = "🤝 Join";
            joinBtn.style.backgroundColor = "";
            chatBtn.style.display = "none";
          };
        } else {
          joinBtn.textContent = "🤝 Join";
          joinBtn.style.backgroundColor = "";
          chatBtn.style.display = "none";

          joinBtn.onclick = async () => {
            await addDoc(joinedUsersRef, {
              name: currentUser.displayName,
              joinedAt: serverTimestamp()
            });
          };
        }
      });

      chatBtn.onclick = () => {
        const query = new URLSearchParams({
          requestId: docSnap.id,
          name: currentUser.displayName
        }).toString();
        window.location.href = `chat.html?${query}`;
      };

      actionsDiv.appendChild(joinBtn);
      actionsDiv.appendChild(chatBtn);
      actionsDiv.appendChild(timerSpan);
      actionsDiv.appendChild(deleteBtn);

      li.appendChild(contentDiv);
      li.appendChild(actionsDiv);
      listEl.appendChild(li);

      startCountdown(deleteTime, timerSpan, li, docSnap.id);
    });
  });
}

function startCountdown(deleteTime, displaySpan, listItem, docId) {
  function updateTimer() {
    const remaining = Math.floor((deleteTime - new Date()) / 1000);
    if (remaining <= 0) {
      displaySpan.textContent = "⏳ expired";
      deleteDoc(doc(db, "requests", docId));
      listItem.remove();
      return;
    }
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    displaySpan.textContent = `⏳ ${minutes}m ${seconds}s`;

    setTimeout(updateTimer, 1000);
  }
  updateTimer();
}

function getMyRequests() {
  const listEl = document.getElementById("myRequestList");
  listEl.innerHTML = "Loading your requests...";

  onSnapshot(collection(db, "requests"), (snapshot) => {
    listEl.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const deleteTime = data.deleteAt?.toDate?.() ?? new Date(0);
      if (deleteTime < new Date()) return;
      if (data.uid !== currentUser?.uid) return;

      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${data.item}</strong> (${data.platform})<br>
        🕒 Expires at: ${deleteTime.toLocaleTimeString()}
      `;
      listEl.appendChild(li);
    });
  });
}
