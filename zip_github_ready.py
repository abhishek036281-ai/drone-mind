import os
import zipfile
import tempfile

def package_project():
    workspace_dir = os.path.dirname(os.path.abspath(__file__))
    zip_filename = "DroneMind-GitHub-Ready.zip"
    zip_path = os.path.join(workspace_dir, zip_filename)
    
    # Exclude directories
    exclude_dirs = {
        "venv", 
        "__pycache__", 
        ".git", 
        ".idea", 
        ".vscode", 
        "node_modules", 
        "brain", 
        ".system_generated"
    }
    
    # Exclude files
    exclude_files = {
        "dronemind.db",
        "DroneMind_SIH_Fleet.zip",
        "DroneMind-GitHub-Ready.zip",
        "zip_project.py",
        "zip_github_ready.py"
    }

    print(f"Scanning target path: {workspace_dir}")
    print(f"Creating clean production ZIP: {zip_path}")
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(workspace_dir):
            # Exclude folders dynamically in-place
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            
            for file in files:
                if file in exclude_files:
                    continue
                # Skip any database journal temp files
                if file.endswith("-journal") or file.endswith(".db"):
                    continue
                # Skip generated images / recordings in workspace root
                if file.endswith(".webp") or file.endswith(".png"):
                    if root == workspace_dir:
                        continue
                
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, workspace_dir)
                zipf.write(full_path, rel_path)
                print(f" -> Added: {rel_path}")
                
    print("\nExtraction test verification:")
    try:
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            test_list = zipf.namelist()
            print(f"Total files in ZIP: {len(test_list)}")
            
            # Check for critical files
            expected_files = [
                "backend/main.py",
                "frontend/index.html",
                "frontend/js/app.js",
                "requirements.txt",
                "Dockerfile",
                ".gitignore",
                ".env.example",
                "README.md"
            ]
            
            missing = [f for f in expected_files if f not in test_list]
            if missing:
                print(f"WARNING: Missing expected files: {missing}")
            else:
                print("SUCCESS: Clear verification check passed! All core files present.")
                
    except Exception as e:
        print(f"ERROR: Extraction validation failed! Reason: {e}")

if __name__ == "__main__":
    package_project()
