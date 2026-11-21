import sys
from trocr_service import recognize_image

if len(sys.argv) < 2:
    print("Usage: python test_trocr.py <image_path>")
    sys.exit(1)

image_path = sys.argv[1]

print("\nProcessing handwritten prescription...\n")

result = recognize_image(image_path)

print("\n========== TrOCR RESULT ==========")
print(result)
print("==================================")
