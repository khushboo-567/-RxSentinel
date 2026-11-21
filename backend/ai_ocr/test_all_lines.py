import os
import glob
from PIL import Image
from trocr_service import load_model, recognize_image

folder = "uploads/trocr_lines_v2"

files = sorted(
    glob.glob(os.path.join(folder, "line_*.png")),
    key=lambda f: int(os.path.basename(f).split("_")[1].split(".")[0])
)

print("\nLoading TrOCR model...")
load_model()

print("\n========== HANDWRITING OCR RESULTS ==========\n")

for file in files:
    try:
        result = recognize_image(file)
        print(f"{os.path.basename(file)}: {result}")
    except Exception as error:
        print(f"{os.path.basename(file)}: ERROR - {error}")

print("\n=============================================")


