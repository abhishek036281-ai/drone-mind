import os
import zipfile

def zip_project():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    zip_name = os.path.join(project_dir, "DroneMind_SIH_Fleet.zip")
    
    # Files to exclude from Zip
    exclude_folders = {"__pycache__", "venv", ".git", ".system_generated", "brain"}
    exclude_files = {"dronemind.db", "DroneMind_SIH_Fleet.zip"}
    
    print("Packaging DroneMind project into DroneMind_SIH_Fleet.zip...")
    
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(project_dir):
            # Modify dirs in-place to exclude unwanted directories
            dirs[:] = [d for d in dirs if d not in exclude_folders]
            
            for file in files:
                if file in exclude_files:
                    continue
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, project_dir)
                zipf.write(full_path, rel_path)
                
    print(f"Project successfully zipped and saved to:\n{zip_name}")

if __name__ == "__main__":
    zip_project()
