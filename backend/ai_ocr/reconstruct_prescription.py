import os
import glob
from trocr_service import load_model, recognize_image

folder = "uploads/trocr_lines_v2"

files = sorted(
    glob.glob(os.path.join(folder, "line_*.png")),
    key=lambda f: int(os.path.basename(f).split("_")[1].split(".")[0])
)

load_model()

results = []

for file in files:
    text = recognize_image(file)
    results.append(text)
    print(f"{os.path.basename(file)}: {text}")

combined_text = "\n".join(results)

output_path = "uploads/trocr_reconstructed.txt"

with open(output_path, "w", encoding="utf-8") as f:
    f.write(combined_text)

print("\n========== RECONSTRUCTED PRESCRIPTION ==========\n")
print(combined_text)
print("\nSaved:", output_path)
