import urllib.request, json, urllib.error
req = urllib.request.Request(
    'https://integrate.api.nvidia.com/v1/chat/completions',
    data=json.dumps({'model':'meta/llama-3.2-90b-vision-instruct', 'messages':[{'role':'user', 'content':'hi'}]}).encode(),
    headers={'Authorization': 'Bearer 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', 'Content-Type': 'application/json'}
)
try:
    res = urllib.request.urlopen(req)
    print(res.read().decode())
except urllib.error.HTTPError as e:
    print(e.read().decode())
