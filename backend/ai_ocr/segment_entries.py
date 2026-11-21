import cv2
import os

image_path = "uploads/trocr_enhanced.png"
output_dir = "uploads/trocr_entries"

os.makedirs(output_dir, exist_ok=True)

image = cv2.imread(image_path)

if image is None:
    raise FileNotFoundError(image_path)

height, width = image.shape[:2]

# Approximate vertical boundaries of the three numbered entries
entries = [
    ("entry_1", 0.08, 0.46),
    ("entry_2", 0.45, 0.69),
    ("entry_3", 0.67, 0.93)
]

for name, start, end in entries:
    y1 = int(height * start)
    y2 = int(height * end)

    crop = image[y1:y2, :]

    output_path = os.path.join(
        output_dir, f"{name}.png"
    )

    cv2.imwrite(output_path, crop)

    print(f"Created: {output_path}")
    print(f"Dimensions: {crop.shape[1]} x {crop.shape[0]}")

print("\nThree medicine-entry crops created.")
