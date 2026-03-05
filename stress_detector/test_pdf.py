import sys
from src.db import get_session_analytics
from src.report_generator import generate_session_pdf

try:
    print("Fetching analytics...")
    analytics = get_session_analytics(18)
    print("Generating PDF...")
    pdf = generate_session_pdf(analytics, 18)
    print("Success! Size:", len(pdf))
except Exception as e:
    import traceback
    traceback.print_exc()
