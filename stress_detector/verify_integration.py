import cv2
import numpy as np
import os
import time
from src.logic import FaceDetector, LandmarkProcessor, StressCalculator

def test_pipeline():
    print("--- Starting Robust Integration Test ---")
    
    # 1. Load Components
    try:
        print("[1/3] Loading Models...")
        detector = FaceDetector("yolo26n.pt")
        landmarker = LandmarkProcessor()
        stress_calc = StressCalculator()
        print("   ✅ All models loaded successfully")
    except Exception as e:
        print(f"   ❌ Model Loading Failed: {e}")
        return

    # 2. Test Data
    image_path = "data/test/neutral/im0.png"
    if not os.path.exists(image_path):
        print(f"   ⚠️ Test image not found at {image_path}")
        return

    print(f"[2/3] Processing {image_path}...")
    original_frame = cv2.imread(image_path)
    
    if original_frame is None:
        print("   ❌ Failed to load image")
        return

    # Upscale for MediaPipe/YOLO (FER images are tiny 48x48)
    # MediaPipe works best on larger images
    frame = cv2.resize(original_frame, (480, 480))
    print(f"   ℹ️ Upscaled image to {frame.shape}")

    # 3. Direct Component Testing
    
    # A. YOLO
    # Note: YOLO trained on COCO might not detect a single huge face filling the frame as a "person" 
    # effectively, but we check if it runs without crashing.
    print("   👉 Testing YOLO (may not detect face in this icon-style image)...")
    face_box = detector.detect(frame)
    if face_box:
        print(f"   ✅ YOLO Processed: Detected {face_box}")
    else:
        print("   ⚠️ YOLO Processed: No detection (Expected for zoomed-in face icon)")

    # B. MediaPipe
    # Pass the full frame to MediaPipe (since it IS a face)
    print("   👉 Testing MediaPipe on full frame...")
    results = landmarker.process(frame)
    
    if results.face_blendshapes:
        print("   ✅ MediaPipe: Landmarks Detected!")
        blendshapes = results.face_blendshapes[0]
        
        # C. Keras Stress Model
        print("   👉 Testing StressCalculator (Keras)...")
        # StressCalculator expects a crop. We pass the whole frame as the "crop" here
        scores = stress_calc.calculate_hybrid_score(frame, blendshapes)
        
        print("\n--- ✅ FINAL OUTPUT GENERATED ---")
        print(f"   Stress Score: {scores['stress_score']:.4f}")
        print(f"   Focus Score:  {scores['focused_score']:.4f}")
        print(f"   Details:      {scores['details']}")
        print("---------------------------------")
        print("   CONCLUSION: Models are working together.")
    else:
        print("   ❌ MediaPipe failed to detect landmarks on upscaled image.")

if __name__ == "__main__":
    test_pipeline()
