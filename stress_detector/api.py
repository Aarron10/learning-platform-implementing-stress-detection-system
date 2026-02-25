import cv2
import asyncio
import threading
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import time

from src.logic import FaceDetector, LandmarkProcessor, StressCalculator

app = FastAPI(title="Stress AI API")

# Enable CORS for Digi-board frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with Digi-board URL e.g. ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global State
class SystemState:
    def __init__(self):
        self.is_running = False
        self.camera = None
        self.detector = None
        self.landmarker = None
        self.stress_calc = None
        
        # Buffer for API returns
        self.current_classification = "Neutral"
        self.avg_stress = 0.0
        self.avg_focus = 0.0
        self.avg_distracted = 0.0
        
        self.lock = threading.Lock()

state = SystemState()

def processing_loop():
    """Background thread running the YOLO -> MediaPipe -> Keras pipeline"""
    while state.is_running:
        if not state.camera or not state.camera.isOpened():
            time.sleep(0.1)
            continue
            
        ret, frame = state.camera.read()
        if not ret:
            time.sleep(0.1)
            continue
            
        # 1. YOLO Face Detection
        face_box = state.detector.detect(frame)
        
        current_stress, current_focus, current_distracted = 0.0, 0.0, 0.0
        classification = "No Face Detected"
        
        if face_box is not None:
            x1, y1, x2, y2 = map(int, face_box)
            h, w, _ = frame.shape
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            face_crop = frame[y1:y2, x1:x2]
            
            if face_crop.size > 0:
                # 2. MediaPipe Landmarks
                results = state.landmarker.process(face_crop)
                
                if results.face_landmarks and results.face_blendshapes:
                    blendshapes = results.face_blendshapes[0]
                    landmarks = results.face_landmarks[0]
                    
                    # 3. Keras Stress Calculation (with rolling average internally)
                    scores = state.stress_calc.calculate_hybrid_score(face_crop, blendshapes, landmarks)
                    current_stress = scores['stress_score']
                    current_focus = scores['focused_score']
                    current_distracted = scores['distracted_score']
                    
                    if current_stress > current_focus and current_stress > current_distracted:
                        classification = "Stressed"
                    elif current_distracted > current_focus and current_distracted > current_stress:
                        classification = "Distracted"
                    else:
                        classification = "Focused"
                        
                    # Handle "looking away" override
                    if scores['details'].get('looking_away', False):
                        classification = "Distracted (Looking Away)"

        # Update global state safely
        with state.lock:
            state.avg_stress = current_stress
            state.avg_focus = current_focus
            state.avg_distracted = current_distracted
            state.current_classification = classification
            
        # Prevent 100% CPU lock; yield to other threads
        time.sleep(0.05) 

@app.post("/start_monitoring")
async def start_monitoring():
    """Initializes models and starts the background camera thread."""
    with state.lock:
        if state.is_running:
            return {"status": "already_running"}
            
        try:
            print("Initializing AI Models...")
            # Load models locally to this process
            if state.detector is None: state.detector = FaceDetector("yolo26n.pt")
            if state.landmarker is None: state.landmarker = LandmarkProcessor()
            if state.stress_calc is None: state.stress_calc = StressCalculator()
            
            # Start Camera
            state.camera = cv2.VideoCapture(0)
            state.is_running = True
            
            # Start background thread
            thread = threading.Thread(target=processing_loop, daemon=True)
            thread.start()
            
            return {"status": "started", "message": "Pipeline initialized."}
        except Exception as e:
            state.is_running = False
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/current_state")
async def get_current_state():
    """Returns the latest buffered classification without blocking."""
    with state.lock:
        if not state.is_running:
            return {"status": "inactive", "classification": "Offline"}
            
        return {
            "status": "active",
            "classification": state.current_classification,
            "raw_scores": {
                "focus": round(state.avg_focus, 3),
                "stress": round(state.avg_stress, 3),
                "distraction": round(state.avg_distracted, 3)
            }
        }

@app.post("/stop_monitoring")
async def stop_monitoring():
    """Gracefully shuts down the camera and pipeline."""
    with state.lock:
        state.is_running = False
        if state.camera:
            state.camera.release()
            state.camera = None
            
        # Return final session averages if needed
        return {
            "status": "stopped",
            "avg_stress": round(state.avg_stress, 3),
            "avg_focus": round(state.avg_focus, 3)
        }

if __name__ == "__main__":
    print("Starting FastAPI Wrapper with Uvicorn...")
    # uvicorn api:app --reload --host 0.0.0.0 --port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
