# File: download_model.py
from huggingface_hub import snapshot_download
import os

# --- IMPORTANT ---
# Ensure you are logged in with `hf auth login` before running this script.
MODEL_ID = "Salesforce/GPTSQL-small"
LOCAL_FOLDER = "local-gptsql-small"# The folder where the model will be saved

print(f"--- Attempting to download model: {MODEL_ID} ---")
print(f"This may take a few minutes...")

try:
    # This command downloads all necessary files for a model repository
    snapshot_download(
        repo_id=MODEL_ID,
        local_dir=LOCAL_FOLDER,
        local_dir_use_symlinks=False,  # This is safer for Windows
        token=None  # This will automatically use the token from your CLI login
    )
    print(f"\n[SUCCESS] Model downloaded successfully to the '{LOCAL_FOLDER}' folder.")
    print("\nNext steps: Move this folder into your 'nlp_service' directory and update main.py.")

except Exception as e:
    print(f"\n[FAILURE] Download failed. This confirms a persistent network issue.")
    print("If this fails, please try running this script on a different network (e.g., your home network or a mobile hotspot).")
    print(f"Error details: {e}")