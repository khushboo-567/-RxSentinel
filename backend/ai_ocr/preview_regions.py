from PIL import Image, ImageDraw
import os
import glob
import math

folder = "uploads/trocr_lines"
files = sorted(
    glob.glob(os.path.join(folder, "line_*.png")),
    key=lambda f: int(os.path.basename(f).split("_")[1].split(".")[0])
)

cell_width = 500
cell_height = 110
columns = 2
rows = math.ceil(len(files) / columns)

sheet = Image.new(
    "RGB",
    (columns * cell_width, rows * cell_height),
    "white"
)

draw = ImageDraw.Draw(sheet)

for i, file in enumerate(files):
    image = Image.open(file).convert("RGB")
    image.thumbnail((cell_width - 20, 75))

    x = (i % columns) * cell_width + 10
    y = (i // columns) * cell_height

    draw.text((x, y + 3), os.path.basename(file), fill="red")
    sheet.paste(image, (x, y + 25))

output = "uploads/trocr_contact_sheet.png"
sheet.save(output)

print("Preview saved:", output)
print("Regions:", len(files))
