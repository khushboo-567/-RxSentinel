from PIL import Image, ImageDraw
import os, glob, math

folder = "uploads/trocr_lines_v2"

files = sorted(
    glob.glob(os.path.join(folder, "line_*.png")),
    key=lambda f: int(os.path.basename(f).split("_")[1].split(".")[0])
)

columns = 2
cell_width = 600
cell_height = 140
rows = math.ceil(len(files) / columns)

sheet = Image.new(
    "RGB",
    (columns * cell_width, rows * cell_height),
    "white"
)

draw = ImageDraw.Draw(sheet)

for i, file in enumerate(files):
    img = Image.open(file).convert("RGB")
    img.thumbnail((cell_width - 20, 100))

    x = (i % columns) * cell_width + 10
    y = (i // columns) * cell_height

    draw.text((x, y + 3), os.path.basename(file), fill="red")
    sheet.paste(img, (x, y + 30))

output = "uploads/trocr_contact_sheet_v2.png"
sheet.save(output)

print("Regions:", len(files))
print("Saved:", output)
