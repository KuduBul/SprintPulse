#!/usr/bin/env python3
"""Inspect the linked Vercel project's git connection and env var count."""
import json
import urllib.request
import urllib.error

AUTH_PATH = "/Users/daniebosman/Library/Application Support/com.vercel.cli/auth.json"
PROJECT_PATH = ".vercel/project.json"

with open(AUTH_PATH) as f:
    token = json.load(f)["token"]
with open(PROJECT_PATH) as f:
    proj = json.load(f)

project_id = proj["projectId"]
team_id = proj["orgId"]

def api(path, method="GET", body=None):
    url = f"https://api.vercel.com{path}"
    sep = "&" if "?" in path else "?"
    url = f"{url}{sep}teamId={team_id}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.load(resp)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

status, data = api(f"/v9/projects/{project_id}")
if isinstance(data, dict):
    print("project:", data.get("name"))
    link = data.get("link")
    print("git link:", json.dumps(link) if link else "NONE")
    print("env count:", len(data.get("env", [])))
else:
    print("status", status, data)
