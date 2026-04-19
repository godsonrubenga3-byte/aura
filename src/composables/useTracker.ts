import { ref, onUnmounted } from 'vue';
import {
  GestureRecognizer,
  FaceLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';

export type Action = 'play' | 'pause' | 'next' | 'prev' | 'volumeUp' | 'volumeDown';
export type ActionSource = 'gesture' | 'presence' | 'manual';

export function useTracker() {
  const isLoaded = ref(false);
  const gesture = ref<string | null>(null);
  const isLookingAtScreen = ref(true);
  const isPersonPresent = ref(false);
  const videoRef = ref<HTMLVideoElement | null>(null);

  let gestureRecognizer: GestureRecognizer;
  let faceLandmarker: FaceLandmarker;
  let lastVideoTime = -1;
  let requestRef: number;
  
  let lastGesture: string | null = null;
  let lastActionTime = 0;
  const ACTION_COOLDOWN = 1000;
  const VOLUME_COOLDOWN = 200;

  const onAction = ref<(action: Action, source: ActionSource) => void>();

  const init = async () => {
    try {
      console.log('Initializing MediaPipe Tasks...');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
      );

      gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });

      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        },
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
      });

      isLoaded.value = true;
      console.log('MediaPipe Models Loaded.');
    } catch (err) {
      console.error('Failed to initialize MediaPipe:', err);
    }
  };

  const startTracking = async (video: HTMLVideoElement) => {
    videoRef.value = video;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      video.srcObject = stream;
      video.addEventListener('loadeddata', () => {
        predict();
      });
    } catch (err) {
      console.error('Camera access failed:', err);
    }
  };

  const predict = async () => {
    if (!videoRef.value || !gestureRecognizer || !faceLandmarker) return;

    if (videoRef.value.videoWidth === 0 || videoRef.value.videoHeight === 0) {
      requestRef = window.requestAnimationFrame(predict);
      return;
    }

    const startTimeMs = performance.now();
    if (videoRef.value.currentTime !== lastVideoTime) {
      lastVideoTime = videoRef.value.currentTime;

      try {
        // 1. Hand Gesture Recognition
        const gestureResults = gestureRecognizer.recognizeForVideo(videoRef.value, startTimeMs);
        if (gestureResults && gestureResults.gestures && gestureResults.gestures.length > 0 && gestureResults.gestures[0].length > 0) {
          const categoryName = gestureResults.gestures[0][0].categoryName;
          const score = gestureResults.gestures[0][0].score;
          gesture.value = categoryName;

          const now = Date.now();
          // Allow Thumb_Up/Down with lower threshold or more frequency
          const isVolumeGesture = categoryName === 'Thumb_Up' || categoryName === 'Thumb_Down';
          const threshold = isVolumeGesture ? 0.4 : 0.6; // Lower threshold for volume gestures

          if (score > threshold) {
            if (categoryName !== lastGesture || isVolumeGesture) {
              const cooldown = isVolumeGesture ? VOLUME_COOLDOWN : ACTION_COOLDOWN;
              
              if (now - lastActionTime > cooldown) {
                if (categoryName === 'Open_Palm') onAction.value?.('play', 'gesture');
                else if (categoryName === 'Closed_Fist') onAction.value?.('pause', 'gesture');
                else if (categoryName === 'Pointing_Up') onAction.value?.('next', 'gesture');
                else if (categoryName === 'Victory') onAction.value?.('prev', 'gesture');
                else if (categoryName === 'Thumb_Up') onAction.value?.('volumeUp', 'gesture');
                else if (categoryName === 'Thumb_Down') onAction.value?.('volumeDown', 'gesture');
                
                lastActionTime = now;
                lastGesture = categoryName;
              }
            }
          } else {
            gesture.value = null;
            lastGesture = null;
          }
        } else {
          gesture.value = null;
          lastGesture = null;
        }

        // 2. Head Pose & Presence
        const faceResults = faceLandmarker.detectForVideo(videoRef.value, startTimeMs);
        
        if (faceResults && faceResults.facialTransformationMatrixes && faceResults.facialTransformationMatrixes.length > 0) {
          isPersonPresent.value = true;
          const matrix = faceResults.facialTransformationMatrixes[0].data;
          const yaw = Math.atan2(matrix[8], matrix[10]) * (180 / Math.PI);
          const pitch = Math.asin(-matrix[9]) * (180 / Math.PI);

          // Check for eye blinking/closed (Retina/Eye check)
          let eyesClosed = false;
          if (faceResults.faceBlendshapes && faceResults.faceBlendshapes.length > 0) {
            const shapes = faceResults.faceBlendshapes[0].categories;
            const eyeBlinkLeft = shapes.find(s => s.categoryName === 'eyeBlinkLeft')?.score || 0;
            const eyeBlinkRight = shapes.find(s => s.categoryName === 'eyeBlinkRight')?.score || 0;
            if (eyeBlinkLeft > 0.6 && eyeBlinkRight > 0.6) {
              eyesClosed = true;
            }
          }

          const yawThreshold = 25;
          const pitchThreshold = 20;
          const isLookingAway = Math.abs(yaw) > yawThreshold || Math.abs(pitch) > pitchThreshold || eyesClosed;
          
          if (isLookingAtScreen.value && isLookingAway) {
            isLookingAtScreen.value = false;
            onAction.value?.('pause', 'presence');
          } else if (!isLookingAtScreen.value && !isLookingAway) {
            isLookingAtScreen.value = true;
            onAction.value?.('play', 'presence');
          }
        } else {
          if (isPersonPresent.value) {
            isPersonPresent.value = false;
            isLookingAtScreen.value = false;
            onAction.value?.('pause', 'presence');
          }
        }
      } catch (err) {
        // Silently skip frames with minor errors
      }
    }

    requestRef = window.requestAnimationFrame(predict);
  };

  onUnmounted(() => {
    if (requestRef) window.cancelAnimationFrame(requestRef);
    if (videoRef.value?.srcObject) {
      const stream = videoRef.value.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  });

  return {
    isLoaded,
    gesture,
    isLookingAtScreen,
    isPersonPresent,
    init,
    startTracking,
    onAction,
  };
}
