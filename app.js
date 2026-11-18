/**
 * Direct Chat - Instant Realtime Messaging
 * Zero room codes, zero backend needed. Works instantly on Vercel & Netlify!
 */

// Unique channel identifier
const urlParams = new URLSearchParams(window.location.search);
const CHAT_TOPIC = urlParams.get('channel') 
  ? `directchat/custom/${urlParams.get('channel')}` 
  : 'directchat/aman_direct_2person_hub_v1';

// User State (Saved in LocalStorage)
let myUserId = localStorage.getItem('direct_chat_user_id');
if (!myUserId) {
  myUserId = 'user_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('direct_chat_user_id', myUserId);
}

let myName = localStorage.getItem('direct_chat_username');
if (!myName) {
  myName = 'User ' + Math.floor(100 + Math.random() * 900);
  localStorage.setItem('direct_chat_username', myName);
}

let soundEnabled = localStorage.getItem('direct_chat_sound') !== 'false';
let typingTimeout = null;

// DOM Elements
const connectionBadge = document.getElementById('connectionBadge');
const usernameInput = document.getElementById('usernameInput');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIcon = document.getElementById('soundIcon');
const clearChatBtn = document.getElementById('clearChatBtn');
const messagesContainer = document.getElementById('messagesContainer');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const imageInput = document.getElementById('imageInput');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// Initialize username input
usernameInput.value = myName;
usernameInput.addEventListener('change', () => {
  const newName = usernameInput.value.trim();
  if (newName) {
    myName = newName;
    localStorage.setItem('direct_chat_username', myName);
    showToast(`Name updated to "${myName}"`, '👤');
  } else {
    usernameInput.value = myName;
  }
});

// Sound button state
updateSoundIcon();
soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem('direct_chat_sound', soundEnabled);
  updateSoundIcon();
  showToast(soundEnabled ? 'Sound enabled' : 'Sound muted', soundEnabled ? '🔊' : '🔇');
});

function updateSoundIcon() {
  soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
}

// ----------------- SOUND SYNTHESIZER (Pure Web Audio API) -----------------
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
  if (!audioCtx && AudioContextClass) {
    audioCtx = new AudioContextClass();
  }
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'send') {
      // Gentle send pop
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'receive') {
      // Pleasant double chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(780, now + 0.07);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    }
  } catch (e) {
    console.warn('Audio error:', e);
  }
}

// ----------------- TOAST HELPER -----------------
let toastTimer = null;
function showToast(message, icon = '✨') {
  toastMessage.textContent = message;
  toastIcon.textContent = icon;
  toast.classList.remove('opacity-0', 'translate-y-24', 'pointer-events-none');
  toast.classList.add('opacity-100', 'translate-y-0');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-24', 'pointer-events-none');
    toast.classList.remove('opacity-100', 'translate-y-0');
  }, 2500);
}

// ----------------- REALTIME WEBSOCKET (MQTT) -----------------
const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt'
];

let currentBrokerIndex = 0;
let client = null;

function connectRealtime() {
  const brokerUrl = BROKERS[currentBrokerIndex];
  
  updateBadge('connecting');

  client = mqtt.connect(brokerUrl, {
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 2500,
    clientId: 'client_' + myUserId + '_' + Math.random().toString(16).substring(2, 6)
  });

  client.on('connect', () => {
    updateBadge('connected');
    showToast('Direct chat connected! Ready.', '🟢');
    
    // Subscribe to chat topic
    client.subscribe(CHAT_TOPIC, { qos: 0 }, (err) => {
      if (err) console.error('Subscription error:', err);
    });
  });

  client.on('reconnect', () => {
    updateBadge('connecting');
  });

  client.on('offline', () => {
    updateBadge('offline');
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
    updateBadge('offline');
    // Switch to fallback broker if error persists
    client.end(true);
    currentBrokerIndex = (currentBrokerIndex + 1) % BROKERS.length;
    setTimeout(connectRealtime, 2000);
  });

  // Listen for incoming messages
  client.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      handleIncomingPacket(payload);
    } catch (e) {
      console.warn('Failed to parse message:', e);
    }
  });
}

function updateBadge(status) {
  if (status === 'connected') {
    connectionBadge.className = 'flex items-center gap-1 text-[11px] text-emerald-400 font-medium';
    connectionBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Online';
  } else if (status === 'connecting') {
    connectionBadge.className = 'flex items-center gap-1 text-[11px] text-amber-400 font-medium';
    connectionBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> Connecting';
  } else {
    connectionBadge.className = 'flex items-center gap-1 text-[11px] text-rose-400 font-medium';
    connectionBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-400"></span> Offline';
  }
}

// ----------------- HANDLE INCOMING PACKETS -----------------
function handleIncomingPacket(data) {
  if (!data || !data.type) return;

  const isMe = (data.userId === myUserId);

  if (data.type === 'chat') {
    hideTypingIndicator();
    appendChatMessage({
      sender: data.name || 'Anonymous',
      text: data.text,
      time: data.time || getCurrentTime(),
      isMe: isMe
    });

    if (!isMe) {
      playSound('receive');
    }
  } else if (data.type === 'image') {
    hideTypingIndicator();
    appendImageMessage({
      sender: data.name || 'Anonymous',
      imageUrl: data.imageData,
      time: data.time || getCurrentTime(),
      isMe: isMe
    });

    if (!isMe) {
      playSound('receive');
    }
  } else if (data.type === 'typing') {
    if (!isMe) {
      if (data.isTyping) {
        showTypingIndicator(`${data.name || 'Someone'} is typing...`);
      } else {
        hideTypingIndicator();
      }
    }
  }
}

// ----------------- SENDING MESSAGES -----------------
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage();
});

sendBtn.addEventListener('click', (e) => {
  e.preventDefault();
  sendMessage();
});

function sendMessage() {
  initAudio();
  const text = messageInput.value.trim();
  if (!text) return;

  if (!client || !client.connected) {
    showToast('Connecting... Please wait a second', '⚠️');
    return;
  }

  const packet = {
    type: 'chat',
    userId: myUserId,
    name: myName,
    text: text,
    time: getCurrentTime(),
    timestamp: Date.now()
  };

  // Publish to topic
  client.publish(CHAT_TOPIC, JSON.stringify(packet), { qos: 0 });

  // Send typing false
  sendTypingStatus(false);

  playSound('send');
  messageInput.value = '';
  messageInput.focus();
}

// ----------------- IMAGE SENDING -----------------
imageInput.addEventListener('change', (e) => {
  initAudio();
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    showToast('Please select image under 2MB', '⚠️');
    imageInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64Data = event.target.result;
    const packet = {
      type: 'image',
      userId: myUserId,
      name: myName,
      imageData: base64Data,
      time: getCurrentTime(),
      timestamp: Date.now()
    };

    client.publish(CHAT_TOPIC, JSON.stringify(packet), { qos: 0 });
    playSound('send');
    imageInput.value = '';
  };
  reader.readAsDataURL(file);
});

// ----------------- TYPING BROADCAST -----------------
messageInput.addEventListener('input', () => {
  if (!client || !client.connected) return;
  sendTypingStatus(true);

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    sendTypingStatus(false);
  }, 1500);
});

function sendTypingStatus(isTyping) {
  if (client && client.connected) {
    const packet = {
      type: 'typing',
      userId: myUserId,
      name: myName,
      isTyping: isTyping
    };
    client.publish(CHAT_TOPIC, JSON.stringify(packet), { qos: 0 });
  }
}

function showTypingIndicator(text) {
  typingText.textContent = text;
  typingIndicator.classList.remove('hidden');
  scrollChatToBottom();
}

function hideTypingIndicator() {
  typingIndicator.classList.add('hidden');
}

// ----------------- QUICK EMOJIS -----------------
document.querySelectorAll('.quick-emoji').forEach((btn) => {
  btn.addEventListener('click', () => {
    const emoji = btn.getAttribute('data-emoji');
    messageInput.value += emoji;
    messageInput.focus();
  });
});

// ----------------- RENDER MESSAGE BUBBLES -----------------
function appendChatMessage({ sender, text, time, isMe }) {
  saveMessageToLocal({ sender, text, time, isMe, type: 'chat' });

  const msgWrapper = document.createElement('div');
  msgWrapper.className = `flex ${isMe ? 'justify-end' : 'justify-start'} msg-animate`;

  const safeText = escapeHtml(text);

  const bubble = document.createElement('div');
  bubble.className = `max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-md ${
    isMe
      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-xs'
      : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-bl-xs'
  }`;

  bubble.innerHTML = `
    ${!isMe ? `<div class="text-[11px] font-semibold text-emerald-400 mb-0.5">${escapeHtml(sender)}</div>` : ''}
    <div class="message-content text-sm leading-relaxed">${safeText}</div>
    <div class="flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-indigo-200' : 'text-slate-400'}">
      <span>${time}</span>
      ${isMe ? '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' : ''}
    </div>
  `;

  msgWrapper.appendChild(bubble);
  messagesContainer.appendChild(msgWrapper);
  scrollChatToBottom();
}

function appendImageMessage({ sender, imageUrl, time, isMe }) {
  saveMessageToLocal({ sender, imageUrl, time, isMe, type: 'image' });

  const msgWrapper = document.createElement('div');
  msgWrapper.className = `flex ${isMe ? 'justify-end' : 'justify-start'} msg-animate`;

  const bubble = document.createElement('div');
  bubble.className = `max-w-[85%] sm:max-w-[70%] rounded-2xl p-2 shadow-md ${
    isMe
      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-xs'
      : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-xs'
  }`;

  bubble.innerHTML = `
    ${!isMe ? `<div class="text-[11px] font-semibold text-emerald-400 mb-1 px-1">${escapeHtml(sender)}</div>` : ''}
    <div class="overflow-hidden rounded-xl max-h-72 bg-black/20">
      <img src="${imageUrl}" alt="Shared image" class="w-full h-auto object-cover hover:scale-105 transition-transform duration-200 cursor-pointer" onclick="window.open('${imageUrl}', '_blank')" />
    </div>
    <div class="flex items-center justify-end gap-1 mt-1 px-1 text-[10px] ${isMe ? 'text-indigo-200' : 'text-slate-400'}">
      <span>${time}</span>
      ${isMe ? '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' : ''}
    </div>
  `;

  msgWrapper.appendChild(bubble);
  messagesContainer.appendChild(msgWrapper);
  scrollChatToBottom();
}

function scrollChatToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ----------------- LOCAL HISTORY STORAGE -----------------
function saveMessageToLocal(msg) {
  try {
    const list = JSON.parse(localStorage.getItem('direct_chat_history') || '[]');
    list.push(msg);
    // Keep last 40 messages
    if (list.length > 40) list.shift();
    localStorage.setItem('direct_chat_history', JSON.stringify(list));
  } catch (e) {}
}

function loadSavedMessages() {
  try {
    const list = JSON.parse(localStorage.getItem('direct_chat_history') || '[]');
    list.forEach((msg) => {
      if (msg.type === 'chat') {
        renderStoredMessage(msg);
      }
    });
  } catch (e) {}
}

function renderStoredMessage({ sender, text, time, isMe }) {
  const msgWrapper = document.createElement('div');
  msgWrapper.className = `flex ${isMe ? 'justify-end' : 'justify-start'}`;

  const safeText = escapeHtml(text);
  const bubble = document.createElement('div');
  bubble.className = `max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-md ${
    isMe
      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-xs'
      : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-bl-xs'
  }`;

  bubble.innerHTML = `
    ${!isMe ? `<div class="text-[11px] font-semibold text-emerald-400 mb-0.5">${escapeHtml(sender)}</div>` : ''}
    <div class="message-content text-sm leading-relaxed">${safeText}</div>
    <div class="flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-indigo-200' : 'text-slate-400'}">
      <span>${time}</span>
      ${isMe ? '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' : ''}
    </div>
  `;

  msgWrapper.appendChild(bubble);
  messagesContainer.appendChild(msgWrapper);
}

// Clear Chat button
clearChatBtn.addEventListener('click', () => {
  if (confirm('Clear chat messages on your screen?')) {
    localStorage.removeItem('direct_chat_history');
    messagesContainer.innerHTML = '';
    showToast('Chat cleared', '🧹');
  }
});

// Mobile virtual keyboard focus scroll
messageInput.addEventListener('focus', () => {
  setTimeout(scrollChatToBottom, 300);
});

// ----------------- UTILITY FUNCTIONS -----------------
function getCurrentTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(string) {
  const div = document.createElement('div');
  div.innerText = string;
  return div.innerHTML;
}

// ----------------- AUTO-REMOVE NETLIFY BADGE / DRAWER -----------------
function removeNetlifyBadge() {
  const selectors = [
    '#nl-badge-frame',
    '#nl-hud-frame',
    '[id*="nl-badge"]',
    '[id*="nl-hud"]',
    'iframe[title*="Netlify"]',
    'iframe[title*="Powered by Netlify"]',
    'iframe[src*="netlify"]',
    'iframe[src*="hud"]',
    'netlify-badge',
    'netlify-drawer',
    '#netlify-drawer',
    '[id*="netlify"]',
    '[class*="netlify"]',
    'a[href*="netlify.com"]'
  ];

  selectors.forEach((sel) => {
    try {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    } catch (e) {}
  });

  // Target any element with text "Powered by Netlify"
  document.querySelectorAll('div, a, span, p, iframe').forEach((el) => {
    if (el.textContent && el.textContent.includes('Powered by Netlify') && !el.closest('#messagesContainer')) {
      try { el.remove(); } catch (e) {}
    }
  });
}

// Continuous observer to remove it immediately upon injection
const netlifyObserver = new MutationObserver(() => {
  removeNetlifyBadge();
});
netlifyObserver.observe(document.documentElement, { childList: true, subtree: true });

// ----------------- INITIALIZE ON LOAD -----------------
window.addEventListener('DOMContentLoaded', () => {
  removeNetlifyBadge();
  setTimeout(removeNetlifyBadge, 500);
  setTimeout(removeNetlifyBadge, 1500);
  setTimeout(removeNetlifyBadge, 3000);
  loadSavedMessages();
  scrollChatToBottom();
  connectRealtime();
});
