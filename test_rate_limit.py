import requests
import time

# This script hits the backend API to trigger the Express rate limiter on /api/query.
# Default limit is 20 requests per minute.

url = "http://localhost:3000/api/query"
headers = {"Content-Type": "application/json"}
data = {"query": "hello"}

print("Sending rapid requests to /api/query to test rate limiting...")
print("Expected behavior: Status 429 Too Many Requests after ~20 requests.\n")

for i in range(25):
    try:
        res = requests.post(url, json=data, headers=headers)
        print(f"Request {i+1}: Status {res.status_code}")
        if res.status_code == 429:
            print("\n✅ Success! Rate limit triggered.")
            print(f"Response: {res.json()}")
            break
        time.sleep(0.1)
    except Exception as e:
        print(f"Error: {e}")
        break
