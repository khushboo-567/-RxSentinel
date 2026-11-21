import cv2
import os

image_path = "uploads/trocr_enhanced.png"
output_dir = "uploads/trocr_lines_v2"

os.makedirs(output_dir, exist_ok=True)

image = cv2.imread(image_path)

if image is None:
    raise FileNotFoundError(image_path)

gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

binary = cv2.threshold(
    gray, 0, 255,
    cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
)[1]

# Join words that belong to the same horizontal line
kernel = cv2.getStructuringElement(
    cv2.MORPH_RECT, (100, 3)
)

connected = cv2.morphologyEx(
    binary,
    cv2.MORPH_CLOSE,
    kernel
)

contours, _ = cv2.findContours(
    connected,
    cv2.RETR_EXTERNAL,
    cv2.CHAIN_APPROX_SIMPLE
)

regions = []

for contour in contours:
    x, y, w, h = cv2.boundingRect(contour)

    if w < 35 or h < 8 or w * h < 100:
        continue

    padding = 20

    x1 = max(0, x - padding)
    y1 = max(0, y - padding)
    x2 = min(image.shape[1], x + w + padding)
    y2 = min(image.shape[0], y + h + padding)

    regions.append((y1, x1, y2, x2))

regions.sort(key=lambda r: (r[0], r[1]))

for index, (y1, x1, y2, x2) in enumerate(regions, 1):
    crop = image[y1:y2, x1:x2]

    output_path = os.path.join(
        output_dir, f"line_{index}.png"
    )

    cv2.imwrite(output_path, crop)

    print(f"Saved line {index}: {output_path}")

print("\nTotal regions detected:", len(regions))
