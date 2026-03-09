import os
import pandas as pd
import psycopg2
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Load environment variables from the digi-board .env file
# Assuming the relative path from stress_detector to digi-board
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', 'digi-board', '.env')
load_dotenv(dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """Returns a raw psycopg2 connection."""
    return psycopg2.connect(DATABASE_URL)

def get_engine():
    """Returns a SQLAlchemy engine (useful for pandas)."""
    # psycopg2 uses 'postgresql://', sqlalchemy likes it too but sometimes needs 'postgresql+psycopg2://'
    # We'll stick to the standard URL for now.
    return create_engine(DATABASE_URL)

def get_session_analytics(session_id):
    """
    Queries the database using pandas and returns aggregated analytics for a session.
    """
    engine = get_engine()
    
    # 1. Fetch Telemetry Data
    query = f"SELECT * FROM session_telemetry WHERE session_id = {session_id} ORDER BY recorded_at"
    df = pd.read_sql(query, engine)
    
    if df.empty:
        return None
        
    # 2. Basic Aggregations
    # Convert focus/stress scores to 0-1 range for calculation
    df['focus_norm'] = df['focus_score'] / 100.0
    df['stress_norm'] = df['stress_score'] / 100.0
    
    avg_stress = df['stress_norm'].mean()
    avg_focus = df['focus_norm'].mean()
    
    # 3. Peak Stress Time
    peak_row = df.loc[df['stress_score'].idxmax()]
    peak_stress_time = peak_row['recorded_at']
    session_start_time = df['recorded_at'].min()
    
    time_offset = peak_stress_time - session_start_time
    total_seconds = int(time_offset.total_seconds())
    minutes = total_seconds // 60
    seconds = total_seconds % 60
    
    if minutes > 0:
        formatted_peak_time = f"{minutes}m {seconds}s mark"
    else:
        formatted_peak_time = f"{seconds}s mark"
    
    # 4. Total Deep Work (Focused) Percentage
    # We define "Focused" as classification == 'Focused'
    total_samples = len(df)
    focused_samples = len(df[df['state_classification'] == 'Focused'])
    deep_work_pct = (focused_samples / total_samples) * 100 if total_samples > 0 else 0
    
    # 5. Prepare Data for Chart.js
    # Time series data (recorded_at, focus, stress)
    # Convert timestamps to relative MM:SS format for JSON readiness
    df['offset_seconds'] = (df['recorded_at'] - session_start_time).dt.total_seconds().astype(int)
    df['time_str'] = df['offset_seconds'].apply(lambda s: f"{s // 60:02d}:{s % 60:02d}")
    
    timeline = {
        "labels": df['time_str'].tolist(),
        "focus_data": df['focus_score'].tolist(),
        "stress_data": df['stress_score'].tolist()
    }
    
    distribution = {
        "labels": ["Focused", "Distracted", "Away"],
        "values": [
            len(df[df['state_classification'] == 'Focused']),
            len(df[df['state_classification'].str.startswith('Distracted', na=False)]),
            len(df[df['state_classification'] == 'No Face Detected'])
        ]
    }

    
    # 6. AI Tutor Guidance logic
    guidance = ""
    if avg_stress > 0.6:
        guidance = "You seemed quite stressed this session. Remember to take 5-minute walks every hour to reset your nervous system."
    elif deep_work_pct < 50:
        guidance = "Focus was a bit scattered. Try using a physical timer (Pomodoro) and putting your phone in another room."
    elif avg_focus > 0.8:
        guidance = "Incredible session! You were in the 'Zone' for most of it. Keep this momentum going!"
    else:
        guidance = "Solid work today. Consistency is the key to mastery. See you at your next session!"
        
    return {
        "avg_stress": avg_stress,
        "avg_focus": avg_focus,
        "peak_stress_time": formatted_peak_time,
        "deep_work_pct": deep_work_pct,
        "timeline": timeline,
        "distribution": distribution,
        "ai_guidance": guidance,
        "raw_df": df # useful for internal PDF logic
    }
