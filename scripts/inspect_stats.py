import os

def search_imports():
    for root, dirs, files in os.walk('.'):
        if 'node_modules' in root or '.git' in root or '.next' in root or '.history' in root:
            continue
        for file in files:
            if file.endswith(('.tsx', '.ts', '.js', '.jsx')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if 'StatisticsDashboard' in content:
                            print(f"Found in: {path}")
                except Exception as e:
                    pass

if __name__ == "__main__":
    search_imports()