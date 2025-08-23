#!/usr/bin/env python3
"""
Test script for the corrected workflow file upload functionality.
This tests that uploaded files are properly linked to asset records.
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
    """Test linking uploaded files to assets."""
    
    # Simulate files that were already uploaded to Supabase
    # These would come from the frontend after actual upload
    files = [
        {
            "id": str(uuid4()),  # This would be the actual file UUID from upload
            "name": "test_document.txt",
            "type": "text/plain",
            "size": 1024,
            "uploadURL": f"https://storage.example.com/assets/user123/{uuid4()}/test_document.txt"
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
        print(f"✅ Success! Assets linked: {result}")
        print(f"   - Asset IDs: {result.get('asset_ids', [])}")
        print(f"   - Count: {result.get('count', 0)}")
        return result.get("asset_ids", [])
    else:
        print(f"❌ Failed with status {response.status_code}")
        print(f"Response: {response.text}")
        return []

def test_workflow_with_assets(asset_ids):
    """Test workflow execution with asset IDs."""
    
    url = f"{API_BASE_URL}/workflows/{WORKFLOW_ID}/stream"
    headers = {
        "Authorization": f"Bearer {AUTH_TOKEN}",
        "Content-Type": "application/json"
    }
    
    # Use file_ids to pass the asset IDs to the workflow
    payload = {
        "message": "Write a haiku based on the uploaded content",
        "file_ids": asset_ids,  # These are the asset IDs
        "asset_ids": [],
        "knowledge_base_ids": []
    }
    
    print(f"\nTesting workflow stream with asset IDs: {asset_ids}")
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

def check_asset_content(asset_id):
    """Check if an asset has content (for debugging)."""
    
    # This would typically be a GET endpoint to retrieve asset details
    # For now, just a placeholder to show where content verification would happen
    print(f"\n📝 To verify content extraction, check asset {asset_id} in the database")
    print("   The content field should be populated by Supabase Edge functions")

if __name__ == "__main__":
    print("=" * 60)
    print("Testing Workflow Asset Linking (Corrected)")
    print("=" * 60)
    
    # Step 1: Link uploaded files to assets
    asset_ids = test_create_assets_from_files()
    
    if asset_ids:
        # Step 2: Test workflow with the asset IDs
        stream_token = test_workflow_with_assets(asset_ids)
        
        if stream_token:
            print("\n✅ All tests passed!")
            print(f"Workflow is processing with asset IDs: {asset_ids}")
            
            # Step 3: Note about content verification
            for asset_id in asset_ids:
                check_asset_content(asset_id)
        else:
            print("\n❌ Workflow stream test failed")
    else:
        print("\n❌ Asset linking test failed")
        print("\nNote: Make sure the workflow exists and allows file uploads")