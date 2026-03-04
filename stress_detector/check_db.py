import pandas as pd
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '..', 'digi-board', '.env')
load_dotenv(dotenv_path)

DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)

query = "SELECT state_classification, count(*) FROM session_telemetry WHERE session_id = 17 GROUP BY state_classification"
df = pd.read_sql(query, engine)
print("Classification counts for Session 17:")
print(df)

# Also let's check what a few rows where focus_score is low look like
query2 = "SELECT focus_score, stress_score, state_classification FROM session_telemetry WHERE session_id = 17 AND focus_score < 50 LIMIT 5"
df2 = pd.read_sql(query2, engine)
print("\nRows where focus_score < 50:")
print(df2)
