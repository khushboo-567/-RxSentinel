import cv2

image = cv2.imread("uploads/trocr_enhanced.png")
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

binary = cv2.threshold(
    gray, 0, 255,
    cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
)[1]

kernel = cv2.getStructuringElement(
    cv2.MORPH_RECT, (100, 3)
)

connected = cv2.morphologyEx(
    binary, cv2.MORPH_CLOSE, kernel
)

contours, _ = cv2.findContours(
    connected, cv2.RETR_EXTERNAL,
    cv2.CHAIN_APPROX_SIMPLE
)

regions = []

for contour in contours:
    x, y, w, h = cv2.boundingRect(contour)

    if w < 35 or h < 8 or w * h < 100:
        continue

    regions.append((y, x, w, h))

regions.sort()

print("\n========== REGION POSITIONS ==========\n")

for i, (y, x, w, h) in enumerate(regions, 1):
    print(
        f"Region {i:02}: X={x:4}, Y={y:4}, "
        f"Width={w:4}, Height={h:4}"
    )

print("\nTotal regions:", len(regions))
