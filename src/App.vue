<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useTracker, type Action, type ActionSource } from './composables/useTracker';

const { isLoaded, gesture, isLookingAtScreen, isPersonPresent, init, startTracking, onAction } = useTracker();

const videoElement = ref<HTMLVideoElement | null>(null);
const audioElement = ref<HTMLAudioElement | null>(null);
const isPlaying = ref(false);
const currentTrackIndex = ref(0);
const systemControl = ref(false);
const masterVolumeEnabled = ref(true);
const presenceControlEnabled = ref(true);
const hasInteracted = ref(false);
const bridgeError = ref<string | null>(null);
const volumeLevel = ref(1);

// Using ultra-reliable sources that definitely support CORS
const tracks = [
  { 
    title: 'Electronic Pulse', 
    artist: 'SoundHelix', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    cover: 'https://picsum.photos/seed/cyber1/200/200'
  },
  { 
    title: 'Ambient Flow', 
    artist: 'SoundHelix', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
    cover: 'https://picsum.photos/seed/synth2/200/200'
  },
  { 
    title: 'Lo-Fi Study', 
    artist: 'SoundHelix', 
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    cover: 'https://picsum.photos/seed/lofi3/200/200'
  },
];

const callBridge = async (action: string) => {
  if (!systemControl.value) return;
  try {
    const res = await fetch(`http://localhost:3001/${action}`, { method: 'POST' });
    const data = await res.json();
    if (data.status === 'warning') {
      bridgeError.value = data.message;
      setTimeout(() => bridgeError.value = null, 3000);
    } else {
      bridgeError.value = null;
    }
  } catch (err) {
    bridgeError.value = 'Bridge server offline';
  }
};

const updateMediaSession = () => {
  if ('mediaSession' in navigator) {
    const track = tracks[currentTrackIndex.value];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: [{ src: track.cover, sizes: '200x200', type: 'image/png' }]
    });
    navigator.mediaSession.playbackState = isPlaying.value ? 'playing' : 'paused';
  }
};

const playAudio = async () => {
  if (!audioElement.value) return;
  try {
    await audioElement.value.play();
    isPlaying.value = true;
  } catch (err) {
    console.warn('Playback failed:', err);
    isPlaying.value = false;
  }
};

const handleAction = async (action: Action, source: ActionSource = 'manual') => {
  console.log('Action triggered:', action, 'from', source);
  
  if (source === 'presence' && !presenceControlEnabled.value) {
    return;
  }

  if (systemControl.value) {
    let bridgeAction: string = action;
    if (action === 'volumeUp') {
      bridgeAction = masterVolumeEnabled.value ? 'master-volume-up' : 'volume-up';
    }
    if (action === 'volumeDown') {
      bridgeAction = masterVolumeEnabled.value ? 'master-volume-down' : 'volume-down';
    }
    callBridge(bridgeAction);
  }

  if (!audioElement.value) return;
  
  // Only handle local audio if we have interacted
  if (!hasInteracted.value && (action === 'play' || action === 'volumeUp' || action === 'volumeDown') && !systemControl.value) return;

  if (action === 'play') {
    await playAudio();
  } else if (action === 'pause') {
    audioElement.value.pause();
    isPlaying.value = false;
  } else if (action === 'next') {
    currentTrackIndex.value = (currentTrackIndex.value + 1) % tracks.length;
    if (isPlaying.value) {
      setTimeout(playAudio, 100);
    }
  } else if (action === 'prev') {
    currentTrackIndex.value = (currentTrackIndex.value - 1 + tracks.length) % tracks.length;
    if (isPlaying.value) {
      setTimeout(playAudio, 100);
    }
  } else if (action === 'volumeUp') {
    volumeLevel.value = Math.min(1, volumeLevel.value + 0.05);
    audioElement.value.volume = volumeLevel.value;
  } else if (action === 'volumeDown') {
    volumeLevel.value = Math.max(0, volumeLevel.value - 0.05);
    audioElement.value.volume = volumeLevel.value;
  }
  updateMediaSession();
};

onMounted(async () => {
  onAction.value = (action, source) => handleAction(action, source);
  
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => handleAction('play', 'manual'));
    navigator.mediaSession.setActionHandler('pause', () => handleAction('pause', 'manual'));
    navigator.mediaSession.setActionHandler('nexttrack', () => handleAction('next', 'manual'));
    navigator.mediaSession.setActionHandler('previoustrack', () => handleAction('prev', 'manual'));
  }

  await init();
  if (videoElement.value) {
    await startTracking(videoElement.value);
  }
});

watch(currentTrackIndex, () => {
  updateMediaSession();
});

const getGestureLabel = (g: string | null) => {
  switch (g) {
    case 'Open_Palm': return '✋ Play';
    case 'Closed_Fist': return '✊ Pause';
    case 'Pointing_Up': return '☝️ Next';
    case 'Victory': return '✌️ Prev';
    case 'Thumb_Up': return '👍 Vol +';
    case 'Thumb_Down': return '👎 Vol -';
    default: return 'No gesture detected';
  }
};

const startApp = () => {
  hasInteracted.value = true;
  handleAction('play', 'manual');
};
</script>

<template>
  <div class="container">
    <header>
      <h1>Aura Tracker</h1>
      <p class="subtitle">Hand & Eye Controlled Media</p>
    </header>

    <main>
      <div class="camera-section">
        <div class="video-wrapper">
          <video ref="videoElement" autoplay playsinline muted></video>
          <div v-if="!isLoaded" class="loader-overlay">
            <div class="loader"></div>
            <span>Loading AI Models...</span>
          </div>
          <div class="overlay" v-if="isLoaded">
            <div class="badge" :class="{ 'badge-active': isPersonPresent }">
              {{ isPersonPresent ? '👤 Person Present' : '🚫 No Person' }}
            </div>
            <div class="badge" :class="{ 'badge-active': isLookingAtScreen }">
              {{ isLookingAtScreen ? '👁️ Eyes on screen' : '🙈 Looking away' }}
            </div>
            <div class="badge" v-if="gesture">
              {{ getGestureLabel(gesture) }}
            </div>
          </div>
        </div>
        
        <button v-if="isLoaded && !hasInteracted" @click="startApp" class="start-btn">
          Click to Enable Local Control
        </button>

        <div v-if="isLoaded" class="bridge-toggle-group">
          <div class="bridge-toggle">
            <label class="switch">
              <input type="checkbox" v-model="systemControl">
              <span class="slider round"></span>
            </label>
            <div class="bridge-info">
              <span class="bridge-label">System Media Bridge</span>
              <span class="bridge-status" :class="{ 'error-text': bridgeError }">
                {{ bridgeError || (systemControl ? 'Connected' : 'Disconnected') }}
              </span>
            </div>
          </div>

          <div class="bridge-toggle">
            <label class="switch">
              <input type="checkbox" v-model="presenceControlEnabled">
              <span class="slider round"></span>
            </label>
            <div class="bridge-info">
              <span class="bridge-label">Presence Auto-Pause</span>
              <span class="bridge-status">
                {{ presenceControlEnabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
          </div>

          <div v-if="systemControl" class="bridge-toggle">
            <label class="switch">
              <input type="checkbox" v-model="masterVolumeEnabled">
              <span class="slider round"></span>
            </label>
            <div class="bridge-info">
              <span class="bridge-label">System Volume Mode</span>
              <span class="bridge-status">
                {{ masterVolumeEnabled ? 'Master Volume' : 'Player Volume' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="player-section">
        <div class="player-card">
          <audio 
            ref="audioElement" 
            :src="tracks[currentTrackIndex].url" 
            @ended="handleAction('next', 'manual')"
            crossorigin="anonymous"
          ></audio>
          
          <div class="album-art" :class="{ 'pulse': isPlaying }">
            <img :src="tracks[currentTrackIndex].cover" alt="Cover" class="cover-img" />
          </div>
          
          <div class="track-info">
            <h2>{{ tracks[currentTrackIndex].title }}</h2>
            <p>{{ tracks[currentTrackIndex].artist }}</p>
            <div class="volume-bar">
              <div class="volume-fill" :style="{ width: (volumeLevel * 100) + '%' }"></div>
            </div>
          </div>
          
          <div class="controls">
            <button @click="handleAction('prev', 'manual')" class="btn-secondary">⏮</button>
            <button @click="handleAction(isPlaying ? 'pause' : 'play', 'manual')" class="btn-primary">
              {{ isPlaying ? '⏸' : '▶' }}
            </button>
            <button @click="handleAction('next', 'manual')" class="btn-secondary">⏭</button>
          </div>
          
          <div class="status-bar">
            <span v-if="isPlaying" class="playing-status">Currently Playing</span>
            <span v-else class="paused-status">Paused</span>
          </div>
        </div>
      </div>
    </main>

    <section class="instructions">
      <h3>Control System</h3>
      <p>Aura uses hand gestures and eye tracking to control your media. You can toggle "Presence Auto-Pause" to decide if the music should stop when you look away or leave. When System Media Bridge is active, use "System Volume Mode" to switch between controlling the app player or the entire OS master volume.</p>
      <div class="instruction-grid">
        <div class="item"><span>✋ Palm</span> ➔ Play</div>
        <div class="item"><span>✊ Fist</span> ➔ Pause</div>
        <div class="item"><span>☝️ Index</span> ➔ Next</div>
        <div class="item"><span>✌️ Peace</span> ➔ Prev</div>
        <div class="item"><span>👍 Thumb Up</span> ➔ Volume +</div>
        <div class="item"><span>👎 Thumb Down</span> ➔ Volume -</div>
        <div class="item"><span>🙈 Look Away</span> ➔ Pause</div>
        <div class="item"><span>👁️ Look Back</span> ➔ Play</div>
      </div>
    </section>
  </div>
</template>

<style>
:root {
  --bg-color: #0f172a;
  --card-bg: #1e293b;
  --accent-color: #38bdf8;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --success: #22c55e;
  --error: #ef4444;
}

body {
  margin: 0;
  padding: 0;
  background-color: var(--bg-color);
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, sans-serif;
}

.container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

header {
  text-align: center;
  margin-bottom: 2rem;
}

h1 {
  font-size: 3rem;
  margin: 0;
  background: linear-gradient(45deg, var(--accent-color), #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 1.1rem;
}

main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 3rem;
}

@media (max-width: 768px) {
  main {
    grid-template-columns: 1fr;
  }
}

.camera-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.video-wrapper {
  position: relative;
  border-radius: 1rem;
  overflow: hidden;
  background: #000;
  aspect-ratio: 4/3;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
}

video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.start-btn {
  background: var(--accent-color);
  color: #000;
  padding: 1rem;
  border-radius: 0.5rem;
  font-weight: bold;
  border: none;
  cursor: pointer;
  z-index: 10;
}

.bridge-toggle-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.bridge-toggle {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--card-bg);
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.volume-bar {
  width: 100%;
  height: 4px;
  background: #334155;
  border-radius: 2px;
  margin-top: 1rem;
  overflow: hidden;
}

.volume-fill {
  height: 100%;
  background: var(--accent-color);
  transition: width 0.2s ease;
}

.bridge-info {
  display: flex;
  flex-direction: column;
}

.bridge-label {
  font-weight: 600;
  font-size: 0.9rem;
}

.bridge-status {
  font-size: 0.75rem;
  color: var(--text-secondary);
  transition: color 0.3s;
}

.error-text {
  color: var(--error) !important;
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #334155;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
}

input:checked + .slider {
  background-color: var(--accent-color);
}

input:checked + .slider:before {
  transform: translateX(26px);
}

.slider.round {
  border-radius: 24px;
}

.slider.round:before {
  border-radius: 50%;
}

.loader-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.loader {
  width: 48px;
  height: 48px;
  border: 5px solid var(--accent-color);
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.overlay {
  position: absolute;
  top: 1rem;
  left: 1rem;
  right: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.badge {
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  padding: 0.5rem 1rem;
  border-radius: 2rem;
  font-size: 0.9rem;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.badge-active {
  border-color: var(--success);
  color: var(--success);
}

.player-section {
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-card {
  background: var(--card-bg);
  padding: 2.5rem;
  border-radius: 1.5rem;
  width: 100%;
  max-width: 320px;
  text-align: center;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.album-art {
  width: 180px;
  height: 180px;
  margin: 0 auto 2rem;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
  transition: transform 0.3s ease;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-art.pulse {
  animation: pulse 2s infinite;
  transform: scale(1.05);
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.4); }
  70% { box-shadow: 0 0 0 20px rgba(56, 189, 248, 0); }
  100% { box-shadow: 0 0 0 0 rgba(56, 189, 248, 0); }
}

.track-info h2 {
  margin: 0;
  font-size: 1.5rem;
}

.track-info p {
  color: var(--text-secondary);
  margin: 0.5rem 0 1.5rem;
}

.controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

button {
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-primary {
  width: 64px;
  height: 64px;
  background: var(--accent-color);
  color: #000;
  border-radius: 50%;
  font-size: 1.5rem;
}

.btn-primary:hover {
  transform: scale(1.1);
  filter: brightness(1.1);
}

.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  font-size: 1.5rem;
}

.btn-secondary:hover {
  color: var(--accent-color);
}

.status-bar {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.playing-status {
  color: var(--success);
}

.paused-status {
  color: var(--error);
}

.instructions {
  background: rgba(30, 41, 59, 0.5);
  padding: 2rem;
  border-radius: 1rem;
}

.instructions h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.instructions p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
}

.instruction-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.item span {
  background: #334155;
  padding: 0.2rem 0.5rem;
  border-radius: 0.4rem;
  min-width: 60px;
  text-align: center;
}
</style>