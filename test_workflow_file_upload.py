#!/usr/bin/env python3
"""
Test script to verify workflow file upload functionality.
This script tests the new endpoint that creates assets from uploaded files.
"""

import os
import requests
import json
from uuid import uuid4

# Configuration from environment variables
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
WORKFLOW_ID = os.getenv("WORKFLOW_ID", "acc0727f-2586-43e5-b20b-0ed0ccc00468")
AUTH_TOKEN = os.getenv("AUTH_TOKEN", "")

if not AUTH_TOKEN:
    print("⚠️  Warning: AUTH_TOKEN not set. Set it via environment variable.")

def test_create_assets_from_files():
    """Test creating assets from uploaded files."""
    
    # Sample file information (simulating files that were uploaded to storage)
    files = [
        {
            "id": str(uuid4()),
            "name": "test_document.txt",
            "type": "text/plain",
            "size": 1024,
            "uploadURL": "https://storage.example.com/assets/user123/uuid/test_document.txt"
        }
    ]
    
    # Prepare request
    url = f"{API_BASE_URL}/workflows/{WORKFLOW_ID}/create-assets-from-files"
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {"files": files}
    
    print(f"Testing endpoint: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    # Make request with timeout
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
    except requests.RequestException as e:
        print(f"❌ Request failed: {e}")
        return []
    
    # Check response
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Success! Created assets: {result}")
        return result["asset_ids"]
    else:
        print(f"❌ Failed with status {response.status_code}")
        print(f"Response: {response.text}")
        return []

def test_workflow_stream_with_files(asset_ids):
    """Test workflow streaming with file IDs."""
    
    url = f"{API_BASE_URL}/workflows/{WORKFLOW_ID}/stream"
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "message": "Write a haiku based on the uploaded content",
        "file_ids": asset_ids,
        "asset_ids": [],
        "knowledge_base_ids": []
    }
    
    print(f"\nTesting workflow stream with file_ids: {asset_ids}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
    except requests.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Stream initiated! Token: {result.get('stream_token')}")
        return result.get('stream_token')
    else:
        print(f"❌ Failed with status {response.status_code}")
        print(f"Response: {response.text}")
        return None

if __name__ == "__main__":
    print("=" * 60)
    print("Testing Workflow File Upload Functionality")
    print("=" * 60)
    
    # Step 1: Create assets from files
    asset_ids = test_create_assets_from_files()
    
    if asset_ids:
        # Step 2: Test workflow with the created assets
        stream_token = test_workflow_stream_with_files(asset_ids)
        
        if stream_token:
            print("\n✅ All tests passed!")
            print(f"You can now connect to the stream endpoint with token: {stream_token}")
        else:
            print("\n❌ Workflow stream test failed")
    else:
        print("\n❌ Asset creation test failed")