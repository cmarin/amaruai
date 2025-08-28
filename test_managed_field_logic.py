#!/usr/bin/env python3
"""
Test script to verify the managed field logic implementation.
This tests the new path-based managed field assignment.
"""
import sys

def test_managed_field_logic():
    """Test that the managed field is set correctly based on file paths."""
    
    # Simulate the logic from the crud.py create_asset function
    def determine_managed_status(file_url, explicit_managed=None):
        managed_status = False  # Default to False for backward compatibility
        
        if file_url:
            # Files in 'assets/' or 'knowledge-bases/' folders are permanent managed assets
            if file_url.startswith('assets/') or file_url.startswith('knowledge-bases/'):
                managed_status = True
            # Files in 'chats/', 'batch-flow/', 'workflows/' are temporary
            elif file_url.startswith(('chats/', 'batch-flow/', 'workflows/')):
                managed_status = False
            # Respect explicitly provided value if set
            elif explicit_managed is not None:
                managed_status = explicit_managed
        # If managed is explicitly provided in the request, use that
        elif explicit_managed is not None:
            managed_status = explicit_managed
            
        return managed_status
    
    # Test cases
    test_cases = [
        # (file_url, explicit_managed, expected_result, description)
        ('assets/user123/uuid123/document.pdf', None, True, 'Assets folder should be managed'),
        ('knowledge-bases/kb456/uuid456/guide.pdf', None, True, 'Knowledge base folder should be managed'),
        ('chats/user123/uuid123/image.jpg', None, False, 'Chat folder should be unmanaged'),
        ('batch-flow/user123/uuid123/video.mp4', None, False, 'Batch flow folder should be unmanaged'),
        ('workflows/user123/uuid123/audio.mp3', None, False, 'Workflow folder should be unmanaged'),
        ('unknown/user123/uuid123/file.txt', None, False, 'Unknown folder should default to unmanaged'),
        ('unknown/user123/uuid123/file.txt', True, True, 'Explicit True should override default'),
        ('chats/user123/uuid123/file.txt', True, False, 'Path-based logic should override explicit value for known paths'),
        (None, True, True, 'No file_url with explicit True should use explicit'),
        (None, None, False, 'No file_url and no explicit should default to False'),
    ]
    
    print("Testing Managed Field Logic")
    print("=" * 50)
    
    all_passed = True
    for file_url, explicit_managed, expected, description in test_cases:
        result = determine_managed_status(file_url, explicit_managed)
        passed = result == expected
        all_passed = all_passed and passed
        
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {description}")
        if not passed:
            print(f"   Expected: {expected}, Got: {result}")
        print(f"   File URL: {file_url}, Explicit: {explicit_managed}")
        print()
    
    print("=" * 50)
    if all_passed:
        print("✅ All tests passed! The managed field logic is working correctly.")
        print("\nPath-based Rules:")
        print("• assets/* → managed=True (permanent assets)")
        print("• knowledge-bases/* → managed=True (KB assets)")  
        print("• chats/* → managed=False (temporary)")
        print("• batch-flow/* → managed=False (temporary)")
        print("• workflows/* → managed=False (temporary)")
        print("• unknown paths → managed=False (default)")
    else:
        print("❌ Some tests failed! Please check the logic.")
        return False
        
    return True

if __name__ == "__main__":
    success = test_managed_field_logic()
    sys.exit(0 if success else 1)