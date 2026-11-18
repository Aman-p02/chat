/**
 * 2Chat - Private Realtime 1-on-1 Chat Application
 * Built with PeerJS (WebRTC) for zero-backend serverless hosting on Vercel.
 */

// Application State
let peer = null;
let conn = null;
let myName = 'Me';
let partnerName = 'Friend';
let currentRoom = '';
let isHost = false;
let soundEnabled = true;
let typingTimeout = null;
const chatHistory = [];

// DOM Elements
const lobbyScreen = document.getElementById('lobbyScreen');
const chatScreen = document.getElementById('chatScreen');
const usernameInput = document.getElementById('usernameInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomInput = document.getElementById('joinRoomInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const waitingCard = document.getElementById('waitingCard');
const shareLinkInput = document.getElementById('shareLinkInput');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const inviteBanner = document.getElementById('inviteBanner');
const inviteRoomDisplay = document.getElementById('inviteRoomDisplay');
const acceptInviteBtn = document.getElementById('acceptInviteBtn');

// Chat DOM Elements
const partnerAvatar = document.getElementById('partnerAvatar');
const partnerNameDisplay = document.getElementById('partnerNameDisplay');
const partnerStatusSub = document.getElementById('partnerStatusSub');
const partnerStatusIndicator = document.getElementById('partnerStatusIndicator');
const connectionBadge = document.getElementById('connectionBadge');
const activeRoomCode = document.getElementById('activeRoomCode');
const roomCodeBadge = document.getElementById('roomCodeBadge');
const messagesContainer = document.getElementById('messagesContainer');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const imageInput = document.getElementById('imageInput');
const downloadChatBtn = document.getElementById('downloadChatBtn');
const leaveChatBtn = document.getElementById('leaveChatBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIcon = document.getElementById('soundIcon');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const toastIcon = document.getElementById('toastIcon');

// ----------------- SOUND SYNTHESIZER (Web Audio API) -----------------
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
      // Soft high blip
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'receive') {
      // Double pleasant chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(780, now + 0.07);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (type === 'connect') {
      // Uplifting chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(660, now + 0.1);
      osc.frequency.setValueAtTime(880, now + 0.2);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'disconnect') {
      // Descending tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.linearRampToValueAtTime(260, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  } catch (e) {
    console.warn('Audio play error:', e);
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
  }, 2800);
}

// ----------------- GENERATE ROOM CODE -----------------
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getFullPeerId(code) {
  return `2chat-room-${code.trim().toUpperCase()}`;
}

// ----------------- ROOM CREATION & JOINING -----------------
function getUserName() {
  const name = usernameInput.value.trim();
  return name.length > 0 ? name : 'User_' + Math.floor(100 + Math.random() * 900);
}

// Host creates room
createRoomBtn.addEventListener('click', () => {
  initAudio();
  myName = getUserName();
  const roomCode = generateRoomCode();
  currentRoom = roomCode;
  isHost = true;

  const fullId = getFullPeerId(roomCode);
  createRoomBtn.disabled = true;
  createRoomBtn.innerHTML = `
    <svg class="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg>
    Connecting...
  `;

  if (peer) peer.destroy();
  peer = new Peer(fullId, { debug: 1 });

  peer.on('open', (id) => {
    createRoomBtn.disabled = false;
    createRoomBtn.innerHTML = `Create New Chat Room`;
    
    // Generate share link
    const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    shareLinkInput.value = inviteUrl;
    waitingCard.classList.remove('hidden');
    showToast('Room created! Share link with partner.', '🎉');
  });

  peer.on('connection', (connection) => {
    conn = connection;
    setupConnectionListeners();
  });

  peer.on('error', (err) => {
    console.error('Peer error:', err);
    createRoomBtn.disabled = false;
    createRoomBtn.innerHTML = `Create New Chat Room`;
    if (err.type === 'unavailable-id') {
      showToast('Room code conflict. Generating another...', '⚠️');
      // Retry with new code
      createRoomBtn.click();
    } else {
      showToast('Connection error: ' + err.type, '❌');
    }
  });
});

// Join Room from Code
joinRoomBtn.addEventListener('click', () => {
  const code = joinRoomInput.value.trim().toUpperCase();
  if (!code) {
    showToast('Please enter room code', '⚠️');
    joinRoomInput.focus();
    return;
  }
  joinExistingRoom(code);
});

// Accept Invite from URL
acceptInviteBtn.addEventListener('click', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('room');
  if (code) {
    joinExistingRoom(code);
  }
});

function joinExistingRoom(roomCode) {
  initAudio();
  myName = getUserName();
  currentRoom = roomCode.toUpperCase();
  isHost = false;

  joinRoomBtn.disabled = true;
  joinRoomBtn.textContent = 'Joining...';

  if (peer) peer.destroy();
  // Guest uses random peer ID
  peer = new Peer({ debug: 1 });

  peer.on('open', (myPeerId) => {
    const targetPeerId = getFullPeerId(currentRoom);
    conn = peer.connect(targetPeerId, { reliable: true });
    setupConnectionListeners();
  });

  peer.on('error', (err) => {
    console.error('Join error:', err);
    joinRoomBtn.disabled = false;
    joinRoomBtn.textContent = 'Join';
    if (err.type === 'peer-unavailable') {
      showToast('Room not found! Creator might have closed the tab.', '❌');
    } else {
      showToast('Error joining room: ' + err.type, '⚠️');
    }
  });
}

// ----------------- CONNECTION LISTENERS -----------------
function setupConnectionListeners() {
  if (!conn) return;

  conn.on('open', () => {
    // Send initial handshake with my username
    conn.send({
      type: 'handshake',
      name: myName
    });

    transitionToChatScreen();
    playSound('connect');
    showToast('Connected with partner!', '🤝');
  });

  conn.on('data', (data) => {
    handleIncomingData(data);
  });

  conn.on('close', () => {
    handlePartnerDisconnected();
  });

  conn.on('error', (err) => {
    console.error('Data connection error:', err);
  });
}

// ----------------- INCOMING DATA ROUTER -----------------
function handleIncomingData(data) {
  if (!data || !data.type) return;

  switch (data.type) {
    case 'handshake':
      partnerName = data.name || 'Friend';
      updatePartnerUI();
      // If host, reply back with handshake
      if (isHost) {
        conn.send({
          type: 'handshake-ack',
          name: myName
        });
      }
      appendSystemMessage(`${partnerName} joined the room! Say hello.`);
      break;

    case 'handshake-ack':
      partnerName = data.name || 'Friend';
      updatePartnerUI();
      appendSystemMessage(`Connected to ${partnerName}'s room!`);
      break;

    case 'chat':
      hideTypingIndicator();
      appendChatMessage({
        sender: partnerName,
        text: data.text,
        time: data.time || getCurrentTime(),
        isMe: false
      });
      playSound('receive');
      break;

    case 'image':
      hideTypingIndicator();
      appendImageMessage({
        sender: partnerName,
        imageUrl: data.imageData,
        caption: data.caption || '',
        time: data.time || getCurrentTime(),
        isMe: false
      });
      playSound('receive');
      break;

    case 'typing':
      if (data.isTyping) {
        showTypingIndicator(`${partnerName} is typing...`);
      } else {
        hideTypingIndicator();
      }
      break;

    case 'leave':
      handlePartnerDisconnected();
      break;
  }
}

// ----------------- UI SCREEN TRANSITIONS -----------------
function transitionToChatScreen() {
  lobbyScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');

  activeRoomCode.textContent = currentRoom;
  updatePartnerUI();
  messageInput.focus();
}

function updatePartnerUI() {
  partnerNameDisplay.textContent = partnerName;
  partnerAvatar.textContent = partnerName.charAt(0).toUpperCase();
  partnerStatusIndicator.className = 'absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-800';
  partnerStatusSub.textContent = '🟢 Online & Ready';
  connectionBadge.textContent = 'Connected';
  connectionBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20';
}

function handlePartnerDisconnected() {
  partnerStatusIndicator.className = 'absolute bottom-0 right-0 w-3 h-3 rounded-full bg-rose-500 ring-2 ring-slate-800';
  partnerStatusSub.textContent = '🔴 Disconnected';
  connectionBadge.textContent = 'Offline';
  connectionBadge.className = 'text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-medium border border-rose-500/20';
  appendSystemMessage(`${partnerName} left the chat or connection was lost.`);
  playSound('disconnect');
  showToast('Partner disconnected', '🔌');
}

// ----------------- MESSAGE SENDING -----------------
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage();
});

sendBtn.addEventListener('click', (e) => {
  e.preventDefault();
  sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  if (!conn || !conn.open) {
    showToast('Cannot send: partner is not connected yet!', '⚠️');
    return;
  }

  const timeStr = getCurrentTime();

  // Send over peer connection
  conn.send({
    type: 'chat',
    text: text,
    time: timeStr
  });

  // Notify stopped typing
  sendTypingStatus(false);

  // Render on my own screen
  appendChatMessage({
    sender: myName,
    text: text,
    time: timeStr,
    isMe: true
  });

  playSound('send');
  messageInput.value = '';
  messageInput.focus();
}

// ----------------- IMAGE SENDING -----------------
imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!conn || !conn.open) {
    showToast('Cannot send: partner is not connected!', '⚠️');
    imageInput.value = '';
    return;
  }

  // File size guard (max ~2MB for snappy P2P)
  if (file.size > 2.5 * 1024 * 1024) {
    showToast('Please select image under 2.5MB', '⚠️');
    imageInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64Data = event.target.result;
    const timeStr = getCurrentTime();

    conn.send({
      type: 'image',
      imageData: base64Data,
      time: timeStr
    });

    appendImageMessage({
      sender: myName,
      imageUrl: base64Data,
      time: timeStr,
      isMe: true
    });

    playSound('send');
    imageInput.value = '';
  };
  reader.readAsDataURL(file);
});

// ----------------- TYPING INDICATOR -----------------
messageInput.addEventListener('input', () => {
  if (!conn || !conn.open) return;
  sendTypingStatus(true);

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    sendTypingStatus(false);
  }, 1500);
});

function sendTypingStatus(isTyping) {
  if (conn && conn.open) {
    conn.send({
      type: 'typing',
      isTyping: isTyping
    });
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
  chatHistory.push({ sender, text, time, isMe });

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
  chatHistory.push({ sender, text: '[Image]', time, isMe });

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

function appendSystemMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex justify-center msg-animate my-2';
  wrapper.innerHTML = `
    <div class="bg-slate-800/60 border border-slate-700/50 rounded-full px-3.5 py-1 text-xs text-slate-400 text-center flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
      ${escapeHtml(text)}
    </div>
  `;
  messagesContainer.appendChild(wrapper);
  scrollChatToBottom();
}

function scrollChatToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ----------------- COPY LINK / SHARE -----------------
copyLinkBtn.addEventListener('click', () => {
  copyTextToClipboard(shareLinkInput.value);
});

roomCodeBadge.addEventListener('click', () => {
  const url = `${window.location.origin}${window.location.pathname}?room=${currentRoom}`;
  copyTextToClipboard(url);
});

function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Invite link copied to clipboard!', '📋');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('Invite link copied!', '📋');
  } catch (err) {
    showToast('Failed to copy link', '❌');
  }
  document.body.removeChild(textArea);
}

// ----------------- DOWNLOAD CHAT HISTORY -----------------
downloadChatBtn.addEventListener('click', () => {
  if (chatHistory.length === 0) {
    showToast('No messages to save yet!', 'ℹ️');
    return;
  }

  let fileContent = `=== 2Chat Conversation ===\nRoom: ${currentRoom}\nDate: ${new Date().toLocaleDateString()}\n\n`;
  chatHistory.forEach((msg) => {
    fileContent += `[${msg.time}] ${msg.sender}: ${msg.text}\n`;
  });

  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `chat-${currentRoom}-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
  showToast('Chat history downloaded!', '💾');
});

// ----------------- LEAVE CHAT -----------------
leaveChatBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to leave this chat room?')) {
    if (conn && conn.open) {
      conn.send({ type: 'leave' });
      conn.close();
    }
    if (peer) {
      peer.destroy();
    }
    window.location.href = window.location.pathname;
  }
});

// ----------------- SOUND TOGGLE -----------------
soundToggleBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
  showToast(soundEnabled ? 'Sounds enabled' : 'Sounds muted', soundEnabled ? '🔊' : '🔇');
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

// ----------------- URL QUERY PARAM CHECK (INVITE DETECTION) -----------------
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');

  if (roomParam) {
    const cleanedCode = roomParam.trim().toUpperCase();
    joinRoomInput.value = cleanedCode;
    inviteRoomDisplay.textContent = cleanedCode;
    inviteBanner.classList.remove('hidden');
    // Pre-fill friendly random name suggestion if blank
    if (!usernameInput.value) {
      usernameInput.placeholder = 'e.g. Rahul / Guest';
    }
  }
});
