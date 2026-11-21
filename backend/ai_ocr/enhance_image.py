from PIL import Image, ImageEnhance, ImageFilter

input_path = "uploads/1795183986880-prescription 4.jpeg"
output_path = "uploads/trocr_enhanced.png"

image = Image.open(input_path).convert("RGB")

# Enlarge the image 3 times
image = image.resize(
    (image.width * 3, image.height * 3),
    Image.Resampling.LANCZOS
)

# Improve contrast and sharpness
image = ImageEnhance.Contrast(image).enhance(1.5)
image = ImageEnhance.Sharpness(image).enhance(2.0)

image.save(output_path)

print("Enhanced image saved:", output_path)
print("New dimensions:", image.size)
