import pymupdf
import re
import csv
import json
from pathlib import Path

PDF = Path("data/NLEM-2022-List.pdf")
OUTPUT = Path("data")
doc = pymupdf.open(PDF)

medicines = {}

# Main alphabetical NLEM 2022 list: PDF pages 86–101
for page_number in range(85, 101):
    text = doc[page_number].get_text()

    for match in re.finditer(r"^\s*(\d+)\.\s+(.+?)\s*$", text, re.MULTILINE):
        number = int(match.group(1))
        name = match.group(2).strip()

        if 1 <= number <= 384:
            medicines[number] = name

expected = list(range(1, 385))
missing = [n for n in expected if n not in medicines]

if missing:
    raise SystemExit(f"Extraction incomplete. Missing entry numbers: {missing}")

entries = [
    {"nlem_number": number, "name": medicines[number]}
    for number in expected
]

# CSV catalogue
with open(OUTPUT / "nlem2022_medicines.csv", "w", newline="", encoding="utf-8-sig") as f:
    writer = csv.DictWriter(f, fieldnames=["nlem_number", "name"])
    writer.writeheader()
    writer.writerows(entries)

# JSON catalogue
with open(OUTPUT / "nlem2022_medicines.json", "w", encoding="utf-8") as f:
    json.dump(entries, f, indent=2, ensure_ascii=False)

# Safe SQL import: preserves existing medicine IDs and non-null descriptions
def sql_escape(value):
    return value.replace("\\", "\\\\").replace("'", "''")

values = []
for item in entries:
    name = sql_escape(item["name"])
    description = sql_escape(f"NLEM 2022 | Entry {item['nlem_number']}")
    values.append(f"('{name}', '{name}', '{description}')")

sql = """-- RxSentinel: NLEM 2022 medicine catalogue
-- Source: National List of Essential Medicines 2022 (CDSCO)
-- Existing medicine records are preserved.

INSERT INTO medicines (name, generic_name, description)
VALUES
""" + ",\n".join(values) + """
ON DUPLICATE KEY UPDATE
generic_name = COALESCE(generic_name, VALUES(generic_name)),
description = COALESCE(description, VALUES(description));

"""

with open(OUTPUT / "nlem2022_import.sql", "w", encoding="utf-8") as f:
    f.write(sql)

print("Extraction successful.")
print("Total NLEM entries:", len(entries))
print("First 5:", [x["name"] for x in entries[:5]])
print("Last 5:", [x["name"] for x in entries[-5:]])
print("CSV: data/nlem2022_medicines.csv")
print("JSON: data/nlem2022_medicines.json")
print("SQL: data/nlem2022_import.sql")
