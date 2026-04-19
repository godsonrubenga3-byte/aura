# Aura Tracker
### AI-Powered Hand & Eye Controlled Media Interface

Aura is an experimental media controller that uses computer vision to allow hands-free interaction with your computer's media playback and system volume.

## 🚀 Features

- **Presence Confirmation**: Uses MediaPipe Face Landmarker to detect if a person is in front of the screen.
- **Retina Tracking & Gaze Detection**: 
  - Automatically pauses media when you look away or close your eyes.
  - Automatically resumes when you look back.
  - Can be toggled on/off via the "Presence Auto-Pause" feature.
- **Hand Gesture Controls**:
  - ✋ **Open Palm**: Play
  - ✊ **Closed Fist**: Pause
  - ☝️ **Pointing Up**: Next Track
  - ✌️ **Victory/Peace**: Previous Track
- **Volume Gestures**:
  - 👍 **Thumb Up**: Volume Up
  - 👎 **Thumb Down**: Volume Down
- **System Integration**: 
  - Includes a Node.js bridge to control system-wide media and volume on Linux (via `playerctl`, `dbus`, and `amixer`).
  - Supports "Master Volume" mode to control computer volume instead of just the player.

## 🛠️ Tech Stack

- **Frontend**: Vue 3, TypeScript, Vite
- **AI Models**: Google MediaPipe (Gesture Recognizer, Face Landmarker)
- **Bridge Server**: Node.js (Standard library)
- **Styling**: Vanilla CSS with a modern dark aesthetic

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd aura
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Start the System Bridge** (Linux users):
   ```bash
   npm run bridge
   ```

## 🎮 How to Use

1. Open the web interface in your browser.
2. Click **"Click to Enable Local Control"** to allow audio playback.
3. Ensure your camera is well-lit.
4. Use the toggles to enable **System Media Bridge** if you want to control apps like Spotify or VLC.
5. Use the **Presence Auto-Pause** toggle to enable/disable eye-tracking based control.

## 📜 License

This project is licensed under the **GLWTPL (Good Luck With That Public License)** - see the [LICENSE](LICENSE) file for details.

*"When I wrote this, only God and I understood what I was doing. Now, only God knows."*
