#!/usr/bin/env python3
"""Disable Vercel deployment protection (SSO/password) for the linked project."""
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

url = f"https://api.vercel.com/v9/projects/{project_id}?teamId={team_id}"
# Disable Vercel Authentication (SSO protection) and password protection.
body = json.dumps({
    "ssoProtection": None,
    "passwordProtection": None,
}).encode()

req = urllib.request.Request(url, data=body, method="PATCH")
req.add_header("Authorization", f"Bearer {token}")
req.add_header("Content-Type", "application/json")

try:
    with urllib.request.urlopen(req) as resp:
        data = json.load(resp)
        print("OK")
        print("ssoProtection:", data.get("ssoProtection"))
        print("passwordProtection:", data.get("passwordProtection"))
except urllib.error.HTTPError as e:
    print("HTTP", e.code)
    print(e.read().decode())
