import requests

try:
    r = requests.get('http://localhost:9003/health', timeout=3)
    print(f'Status: {r.status_code}')
    print(f'Response: {r.text}')
except Exception as e:
    print(f'Error: {e}')
