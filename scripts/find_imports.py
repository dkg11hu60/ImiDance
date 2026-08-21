import os
import re

def find_python_imports(directory="."):
    imports = set()
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        for line in f:
                            match = re.match(r"^\s*(?:import|from)\s+([a-zA-Z0-9_]+)", line)
                            if match:
                                imports.add(match.group(1))
                except Exception as e:
                    print(f"Error reading {filepath}: {e}")
    return sorted(list(imports))

if __name__ == "__main__":
    found = find_python_imports()
    print("Found imports:", found)