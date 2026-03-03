import cv2
import time
import numpy as np
import pandas as pd
from datetime import datetime
from threading import Lock
from collections import deque

# Placeholder for YOLO and MediaPipe - imports will be actual in final
from ultralytics import YOLO
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

class FaceDetector:
    def __init__(self, model_path="yolo26n.pt"):
        # Try to load requested model, fallback to standard YOLOv8n if missing
        try:
            self.model = YOLO(model_path)
            print(f"Loaded {model_path}")
        except Exception as e:
            print(f"Error loading {model_path}: {e}")
            print("Falling back to yolov8n.pt...")
            self.model = YOLO("yolov8n.pt")
    
    def detect(self, frame):
        """
        Detects faces in the frame.
        Returns the bounding box of the largest face found (or None).
        Format: (x1, y1, x2, y2)
        """
        results = self.model(frame, verbose=False, conf=0.5)
        boxes = []
        for result in results:
            for box in result.boxes:
                # Class 0 is usually 'person' in standard COCO. 
                # If using a face-specific model, check class ID if needed.
                # Assuming yolo26n.pt behaves like standard YOLO or is face specific 
                # we'll just take the box.
                xyxy = box.xyxy[0].cpu().numpy()
                boxes.append(xyxy)
        
        if not boxes:
            return None
            
        # Return the largest box (assuming it's the main user)
        # Area = (x2-x1) * (y2-y1)
        largest_box = max(boxes, key=lambda b: (b[2]-b[0]) * (b[3]-b[1]))
        return largest_box

class LandmarkProcessor:
    def __init__(self):
        self.base_options = python.BaseOptions(model_asset_path='face_landmarker.task')
        self.options = vision.FaceLandmarkerOptions(
            base_options=self.base_options,
            output_face_blendshapes=True,
            num_faces=1)
        self.detector = vision.FaceLandmarker.create_from_options(self.options)

    def process(self, frame_crop):
        """
        Extracts landmarks and blendshapes from a cropped face image.
        """
        # MediaPipe expects RGB
        rgb_image = cv2.cvtColor(frame_crop, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)
        
        detection_result = self.detector.detect(mp_image)
        return detection_result

    def close(self):
        """
        Explicitly close the MediaPipe detector.
        """
        if hasattr(self, 'detector'):
            self.detector.close()

from src.emotion_model import EmotionModel

class StressCalculator:
    def __init__(self):
        self.history = []
        self.history_limit = 150 # ~5 seconds at 30fps
        # Load Keras Model
        self.emotion_model = EmotionModel()
        
        # New: Temporal Smoothing Buffer (1 second window)
        self.score_buffer = deque(maxlen=30)
        
        # New: Frame Skipping
        self.frame_count = 0
        self.skip_frames = 5 # Run Keras every 5th frame
        self.last_emotions = None
        
        # New: Blink Detection (Liveness)
        self.last_blink_time = time.time()
        self.blink_detected = False
        self.EAR_THRESHOLD = 0.25 # Tune based on testing, usually 0.2-0.3
        
        # New: Calibration State
        self.calibration_active = False
        self.baseline_ratio = 1.0
        self.baseline_bs = {}
        
    def calibrate(self, landmarks, blendshapes):
        """
        Captures the current state as the 'resting' baseline.
        """
        if not landmarks or not blendshapes: return
        
        # 1. Head Pose Baseline
        try:
            nose = landmarks[1]
            left_eye = landmarks[33]
            right_eye = landmarks[263]
            dist_left = np.sqrt((nose.x - left_eye.x)**2 + (nose.y - left_eye.y)**2)
            dist_right = np.sqrt((nose.x - right_eye.x)**2 + (nose.y - right_eye.y)**2)
            if dist_right > 0:
                self.baseline_ratio = dist_left / dist_right
        except:
            self.baseline_ratio = 1.0
            
        # 2. Blendshape Baseline
        bs_map = {b.category_name: b.score for b in blendshapes}
        self.baseline_bs['brow'] = (bs_map.get('browDownLeft', 0) + bs_map.get('browDownRight', 0)) / 2
        self.baseline_bs['squint'] = (bs_map.get('eyeSquintLeft', 0) + bs_map.get('eyeSquintRight', 0)) / 2
        self.baseline_bs['press'] = (bs_map.get('mouthPressLeft', 0) + bs_map.get('mouthPressRight', 0)) / 2
        
        print(f"Calibration Complete. Baseline Ratio: {self.baseline_ratio:.2f}")
        
    def calculate_ear(self, landmarks):
        """
        Calculates Eye Aspect Ratio (EAR) for blink detection.
        """
        # Indices for Left and Right Eye (MediaPipe 468/478 mesh)
        # Left Eye: 33 (p1), 160 (p2), 158 (p3), 133 (p4), 153 (p5), 144 (p6)
        # Right Eye: 362 (p1), 385 (p2), 387 (p3), 263 (p4), 373 (p5), 380 (p6)
        
        def eye_aspect_ratio(p1, p2, p3, p4, p5, p6):
            # Euclidian distance
            def dist(a, b): return np.linalg.norm(np.array([a.x, a.y]) - np.array([b.x, b.y]))
            
            vertical_1 = dist(p2, p5)
            vertical_2 = dist(p3, p6)
            horizontal = dist(p1, p4)
            return (vertical_1 + vertical_2) / (2.0 * horizontal)

        try:
            left_ear = eye_aspect_ratio(
                landmarks[33], landmarks[160], landmarks[158],
                landmarks[133], landmarks[153], landmarks[144]
            )
            right_ear = eye_aspect_ratio(
                landmarks[362], landmarks[385], landmarks[387],
                landmarks[263], landmarks[373], landmarks[380]
            )
            return (left_ear + right_ear) / 2.0
        except:
            return 0.3 # Default safe value if indexing fails

    def is_looking_away(self, landmarks):
        """
        Detects if user is looking away based on horizontal nose position relative to eyes.
        Returns True (Distracted) or False (Focused).
        """
        try: 
            # Nose Tip: 1
            # Left Eye Outer: 33
            # Right Eye Outer: 263
            nose = landmarks[1]
            left_eye = landmarks[33]
            right_eye = landmarks[263]
            
            # Simple horizontal processing
            # Distances
            dist_left = np.sqrt((nose.x - left_eye.x)**2 + (nose.y - left_eye.y)**2)
            dist_right = np.sqrt((nose.x - right_eye.x)**2 + (nose.y - right_eye.y)**2)
            
            # Yaw Ratio
            # If looking forward, dist_left ~= dist_right (Ratio ~= 1.0)
            # If looking left, nose moves left, dist_left decreases, ratio decreases
            
            if dist_right == 0: return True
            ratio = dist_left / dist_right
            
            # Thresholds (tuned for approximate 30-40 deg)
            # Normal range is roughly 0.6 to 1.6
            if ratio < 0.5 or ratio > 2.0:
                return True # Looking Left or Right
                
            return False
        except:
            return False

    def calculate_hybrid_score(self, face_crop, blendshapes, landmarks=None):
        """
        Calculates hybrid score with Smoothing, optimization, and blink detection.
        Arguments:
            face_crop (img): Face image for Keras model
            blendshapes (list): MediaPipe blendshapes
            landmarks (list, optional): MediaPipe landmarks for Blink/HeadPose detection
        """
        # --- 1. Geometric Score (MediaPipe) ---
        bs_map = {b.category_name: b.score for b in blendshapes}
        
        brow_down = (bs_map.get('browDownLeft', 0) + bs_map.get('browDownRight', 0)) / 2
        eye_squint = (bs_map.get('eyeSquintLeft', 0) + bs_map.get('eyeSquintRight', 0)) / 2
        lip_press = (bs_map.get('mouthPressLeft', 0) + bs_map.get('mouthPressRight', 0)) / 2
        
        # Apply Baseline Calibration (Subtract resting face tension)
        if self.baseline_bs:
            brow_down = max(0.0, brow_down - self.baseline_bs.get('brow', 0))
            eye_squint = max(0.0, eye_squint - self.baseline_bs.get('squint', 0))
            lip_press = max(0.0, lip_press - self.baseline_bs.get('press', 0))
        
        def boost(val): return min(1.0, np.sqrt(val) * 1.5)
        
        geo_stress = (boost(brow_down) * 0.4) + (boost(eye_squint) * 0.3) + (boost(lip_press) * 0.3)
        geo_focused = 1.0 - geo_stress

        # --- 2. Head Pose & Looking Away ---
        # Calculate distraction levels
        head_distraction = 0.0
        eye_distraction = 0.0
        
        # A. Head Pose (Landmarks)
        if landmarks:
            # We use the ratio logic from is_looking_away, but make it continuous or tiered
            # Re-implementing locally to get a score
            try:
                nose = landmarks[1]
                left_eye = landmarks[33]
                right_eye = landmarks[263]
                dist_left = np.sqrt((nose.x - left_eye.x)**2 + (nose.y - left_eye.y)**2)
                dist_right = np.sqrt((nose.x - right_eye.x)**2 + (nose.y - right_eye.y)**2)
                
                if dist_right > 0:
                    raw_ratio = dist_left / dist_right
                    # Normalize by baseline logic:
                    # If baseline is 1.0, use raw.
                    # If baseline is 1.2, then 1.2 is the new "1.0" center.
                    ratio = raw_ratio / self.baseline_ratio 
                    
                    # Normal: 0.6 - 1.6
                    # Slight Turn: 0.4-0.6 or 1.6-2.5
                    # Hard Turn: <0.4 or >2.5
                    
                    if ratio < 0.4 or ratio > 2.5:
                        head_distraction = 1.0 # HEAD TILTED AWAY (High)
                    elif ratio < 0.55 or ratio > 1.8:
                        head_distraction = 0.5 # Slight Head Turn
            except:
                pass
                
            # Blink Detection (Internal)
            ear = self.calculate_ear(landmarks)
            if ear < self.EAR_THRESHOLD:
                self.last_blink_time = time.time()

        # B. Eye Gaze (Blendshapes)
        # Look Left: eyeLookOutLeft + eyeLookInRight
        # Look Right: eyeLookInLeft + eyeLookOutRight
        # Look Up: eyeLookUpLeft + eyeLookUpRight
        # Look Down: eyeLookDownLeft + eyeLookDownRight
        
        # We can just take the max of any directional look
        # Note: These values are 0.0 - 1.0
        look_left = (bs_map.get('eyeLookOutLeft', 0) + bs_map.get('eyeLookInRight', 0)) / 2
        look_right = (bs_map.get('eyeLookInLeft', 0) + bs_map.get('eyeLookOutRight', 0)) / 2
        look_up = (bs_map.get('eyeLookUpLeft', 0) + bs_map.get('eyeLookUpRight', 0)) / 2
        look_down = (bs_map.get('eyeLookDownLeft', 0) + bs_map.get('eyeLookDownRight', 0)) / 2
        
        # "Eyes pointed away" - threshold
        curr_gaze_max = max(look_left, look_right, look_up, look_down)
        
        # Specific Logic for LOOKING UP (User Request)
        distraction_source = "None"
        if look_up > 0.45: # Looking Up significantly
            eye_distraction = 0.95 # ALMOST MAX DISTRACTION
            distraction_source = "Looking Up"
        elif curr_gaze_max > 0.6: # Threshold for substantial eye movement
            eye_distraction = 0.6 # EYES POINTED AWAY (Medium-High)
        elif curr_gaze_max > 0.3:
            eye_distraction = 0.3 # Slight eye movement
            
        # --- 3. Visual Score (Keras) - WITH FRAME SKIPPING ---
        self.frame_count += 1
        if self.frame_count % self.skip_frames == 0 or self.last_emotions is None:
            try:
                emotions = self.emotion_model.predict(face_crop)
            except:
                emotions = None
            self.last_emotions = emotions
        else:
            emotions = self.last_emotions
            
        vis_stress = 0.0
        vis_focused = 0.0
        vis_distracted = 0.0
        
        if emotions:
            vis_stress = emotions['Angry'] + emotions['Disgusted'] + emotions['Fearful'] + emotions['Sad']
            vis_focused = emotions['Neutral']
            vis_distracted = emotions['Happy'] + emotions['Surprised']

        # --- 4. Fusion & Tuning ---
        # User Priority: "focused score 100% when looking anywhere on screen, distracted 0"
        # "decrease focus and increase distracted based on looking away/rotation/tilt"
        
        # 1. Calculate raw distraction (0.0 to 1.0)
        raw_distraction = 0.0
        distraction_source = "None"
        
        # Head Rotation/Tilt takes precedence
        if head_distraction > 0:
            raw_distraction = head_distraction * 1.2 # User Req: "increase a higher when head is rotated"
            if head_distraction > 0.8: distraction_source = "Head Rotation"
            else: distraction_source = "Head Tilt"
            
        # Eye Gaze is secondary but additive if head is mostly front
        elif eye_distraction > 0:
            raw_distraction = eye_distraction
            if distraction_source == "None": distraction_source = "Eye Gaze"

        # 2. Logic: On-Screen vs Off-Screen
        # We define "On-Screen" as raw_distraction < threshold
        on_screen_threshold = 0.35
        
        if raw_distraction < on_screen_threshold:
            # ON SCREEN: Force Max Focus, Zero Distraction
            final_focused = 1.0
            final_distracted = 0.0
            # Stress is purely visual but dampened
            final_stress = ((vis_stress * 0.7) + (geo_stress * 0.3)) * 0.60
            distraction_source = "None (On Screen)"
        else:
            # OFF SCREEN: Scale linearly/exponentially
            # Map 0.35 -> 1.0 range to 0.0 -> 1.0 output
            # (val - min) / (max - min)
            scale = (raw_distraction - on_screen_threshold) / (1.0 - on_screen_threshold)
            scale = min(1.0, max(0.0, scale))
            
            # Linear ramp up of distraction
            final_distracted = scale 
            
            # Inverse ramp down of focus, but punish harder (User req)
            # "focused score to lower more when eyes are away"
            # If scale is 0.5 (halfway distracted), focus was 0.25, now 0.1
            final_focused = max(0.0, 1.0 - (scale * 2.0)) # Steeper drop off
            
            # Stress is unreliable if looking away
            final_stress = ((vis_stress * 0.6) + (geo_stress * 0.4)) * (1.0 - scale)

        # Clip
        final_stress = min(1.0, max(0.0, final_stress))
        final_focused = min(1.0, max(0.0, final_focused))
        final_distracted = min(1.0, max(0.0, final_distracted))
            
        # --- 5. Temporal Smoothing (Moving Average) ---
        self.score_buffer.append((final_stress, final_focused, final_distracted))
        
        avg_stress = sum([s[0] for s in self.score_buffer]) / len(self.score_buffer)
        avg_focus = sum([s[1] for s in self.score_buffer]) / len(self.score_buffer)
        avg_distracted = sum([s[2] for s in self.score_buffer]) / len(self.score_buffer)

        return {
            'stress_score': avg_stress,
            'focused_score': avg_focus,
            'distracted_score': avg_distracted,
            'details': {
                'visual_emotions': emotions,
                'geo_stress': geo_stress,
                'distraction_source': distraction_source,
                'raw_gaze': curr_gaze_max
            }
        }

class StudyTimer:
    def __init__(self, duration_minutes=30):
        self.total_seconds = duration_minutes * 60
        self.remaining_seconds = self.total_seconds
        self.is_running = False
        self.is_paused = False # Auto-pause state
        self.last_update_time = time.time()
        self.lock = Lock()
        
        self.no_face_start_time = None
        
    def start(self):
        self.is_running = True
        self.last_update_time = time.time()
        
    def stop(self):
        self.is_running = False
        
    def reset(self, duration_minutes):
        self.total_seconds = duration_minutes * 60
        self.remaining_seconds = self.total_seconds
        self.is_running = False
        self.is_paused = False
        self.no_face_start_time = None
        self.last_update_time = time.time()

    def update(self, face_detected):
        with self.lock:
            current_time = time.time()
            
            if not self.is_running:
                return

            if face_detected:
                self.no_face_start_time = None
                if self.is_paused:
                    self.is_paused = False # Auto-resume
                    self.last_update_time = current_time # Reset delta
            else:
                if self.no_face_start_time is None:
                    self.no_face_start_time = current_time
                elif current_time - self.no_face_start_time > 2.0:
                    self.is_paused = True
            
            if not self.is_paused:
                delta = current_time - self.last_update_time
                self.remaining_seconds = max(0, self.remaining_seconds - delta)
            
            self.last_update_time = current_time

class SessionLogger:
    def __init__(self, filepath="session_log.csv"):
        self.filepath = filepath
        # Initialize file with headers if not exists
        try:
            pd.read_csv(filepath)
        except FileNotFoundError:
            pd.DataFrame(columns=["Timestamp", "Stress_Score", "Focus_Status"]).to_csv(filepath, index=False)
            
    def log(self, stress_score, focus_status):
        new_row = {
            "Timestamp": datetime.now().isoformat(),
            "Stress_Score": stress_score,
            "Focus_Status": focus_status
        }
        df = pd.DataFrame([new_row])
        df.to_csv(self.filepath, mode='a', header=False, index=False)
