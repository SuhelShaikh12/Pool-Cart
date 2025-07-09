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

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);

const auth = getAuth(app);

let currentUser = null;

// 👉 Auth UI Handling
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

loginBtn.onclick = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    console.log("User logged in:", currentUser);
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

// ✅ Auto login persistence
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  updateAuthUI();
  if (user) {
    getUserLocationAndListen();   // 👈 Load nearby requests
    getMyRequests();              // 🆕 Load MY requests
  } else {
    // Optional: Clear your request list when logged out
    document.getElementById("myRequestList").innerHTML = "";
  }
});

document.getElementById("orderForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  if (!auth.currentUser) {
    alert("You must be logged in to submit a request.");
    return;
  }

  const item = document.getElementById("item").value;
  const platform = document.getElementById("platform").value;

  if (!navigator.geolocation) {
    alert("Geolocation not supported by your browser");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
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
  });
});

function getUserLocationAndListen() {
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    liveNearbyRequests(latitude, longitude);
  });
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
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
        <strong>🛒 ${data.item}</strong><br />
        <span>Platform: ${data.platform}</span><br />
        <span>📍 ${distance.toFixed(2)} km away</span>
      `;

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "msg-actions";

      const timerSpan = document.createElement("span");
      timerSpan.className = "timer";

      const btn = document.createElement("button");
      btn.textContent = "❌ Delete";
      btn.onclick = async () => {
        await deleteDoc(doc(db, "requests", docSnap.id));
        li.remove();
      };

      const joinBtn = document.createElement("button");
      joinBtn.textContent = "🤝 Join";
      joinBtn.style.marginBottom = "6px";

      joinBtn.onclick = async () => {
        const user = currentUser.displayName;
        if (!user) return;

        joinBtn.disabled = true;
        joinBtn.textContent = `✅ Joined as ${user}`;
        joinBtn.style.backgroundColor = "#4caf50";

        const userRef = await addDoc(
          collection(db, `requests/${docSnap.id}/joinedUsers`),
          {
            name: user,
            joinedAt: serverTimestamp()
          }
        );

        const chatDiv = document.createElement("div");
        chatDiv.style.marginTop = "10px";
        chatDiv.innerHTML = `
          <div id="chat_${docSnap.id}" class="chat-box" style="max-height: 100px; overflow-y: auto; background: #f1f1f1; padding: 6px; margin-bottom: 6px; border-radius: 6px;"></div>
          <input id="input_${docSnap.id}" type="text" placeholder="Message..." style="width: 65%; padding: 6px;">
          <button id="send_${docSnap.id}" style="padding: 6px;">Send</button>
        `;

        li.appendChild(chatDiv);
        setupPerRequestChat(docSnap.id, user);

        const leaveBtn = document.createElement("button");
        leaveBtn.textContent = "🚪 Leave";
        leaveBtn.style.marginLeft = "10px";
        leaveBtn.onclick = async () => {
          await deleteDoc(userRef);
          chatDiv.remove();
          leaveBtn.remove();
          joinBtn.disabled = false;
          joinBtn.textContent = "🤝 Join";
          joinBtn.style.backgroundColor = "";
        };

        actionsDiv.appendChild(leaveBtn);
      };

      actionsDiv.appendChild(joinBtn);
      actionsDiv.appendChild(timerSpan);
      actionsDiv.appendChild(btn);

      li.appendChild(contentDiv);
      li.appendChild(actionsDiv);
      listEl.appendChild(li);

      startCountdown(deleteTime, timerSpan, li, docSnap.id);

      // 👥 Show Joined Users
      const joinedDiv = document.createElement("div");
      joinedDiv.style.fontSize = "13px";
      joinedDiv.style.marginTop = "6px";
      joinedDiv.style.color = "#555";
      joinedDiv.textContent = "👥 Joined: Loading...";
      li.appendChild(joinedDiv);

      onSnapshot(collection(db, `requests/${docSnap.id}/joinedUsers`), (snap) => {
        const names = snap.docs.map(d => d.data().name);
        joinedDiv.textContent = `👥 Joined: ${names.join(", ") || "None yet"}`;
      });
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

function setupPerRequestChat(requestId, username) {
  const chatBox = document.getElementById(`chat_${requestId}`);
  const input = document.getElementById(`input_${requestId}`);
  const sendBtn = document.getElementById(`send_${requestId}`);

  onSnapshot(collection(db, `requests/${requestId}/messages`), (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach((doc) => {
      const msg = doc.data();
      const div = document.createElement("div");
      div.innerHTML = `<strong>${msg.user}</strong>: ${msg.text}`;
      chatBox.appendChild(div);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  });

  sendBtn.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;

    await addDoc(collection(db, `requests/${requestId}/messages`), {
      user: username,
      text,
      timestamp: serverTimestamp()
    });
    input.value = "";
  };
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

      if (data.uid !== auth.currentUser?.uid) return;

      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${data.item}</strong> (${data.platform})<br>
        🕒 Expires at: ${deleteTime.toLocaleTimeString()}
      `;
      listEl.appendChild(li);
    });
  });
}
