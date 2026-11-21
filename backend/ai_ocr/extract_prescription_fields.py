import json
import re
from pathlib import Path

INPUT_FILE = Path("uploads/trocr_v3/prescription.json")
OUTPUT_FILE = Path("uploads/trocr_v3/extracted_prescription.json")

MEDICINE_KEYWORDS = {
    "amoxicillin": r"\bamoxicillin\b",
    "clavulanic acid": r"\bclavulanic\b",
    "ofloxacin": r"\bofloxacin\b",
    "paracetamol": r"\bparacetamol\b"
}

FREQUENCY_MAP = {
    "OD": "OD",
    "BD": "BD",
    "BID": "BID",
    "TDS": "TDS",
    "TID": "TID",
    "QID": "QID",
    "QDS": "QDS",
    "SOS": "SOS",
    "PRN": "PRN",
    "HS": "HS",
    "STAT": "STAT"
}

FREQUENCY_PATTERN = re.compile(
    r"(?<![A-Z0-9])(T\s*D\s*S|T\s*I\s*D|Q\s*I\s*D|Q\s*D\s*S|B\s*I\s*D|O\s*D|B\s*D|SOS|P\s*R\s*N|H\s*S|S\s*T\s*A\s*T)(?![A-Z0-9])",
    re.IGNORECASE
)

STRENGTH_PATTERN = re.compile(
    r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml)\b",
    re.IGNORECASE
)

DURATION_PATTERN = re.compile(
    r"\b\d+\s*(?:days?|weeks?|months?)\b",
    re.IGNORECASE
)


def unique(values):
    result = []
    for value in values:
        value = value.strip()
        if value and value.lower() not in [x.lower() for x in result]:
            result.append(value)
    return result


def extract_entry(entry):
    combined_text = entry.get("recognized_text", "")
    regions = entry.get("regions", [])

    region_texts = [
        region.get("text", "")
        for region in regions
        if region.get("text")
    ]

    # Examine each region independently and retain the combined OCR text.
    all_text = " ".join(region_texts) + " " + combined_text
    searchable_text = all_text.lower()

    medicine_candidates = [
        name for name, pattern in MEDICINE_KEYWORDS.items()
        if re.search(pattern, searchable_text, re.IGNORECASE)
    ]

    strength_candidates = unique(
        match.group(0)
        for match in STRENGTH_PATTERN.finditer(all_text)
    )

    duration_candidates = unique(
        match.group(0)
        for match in DURATION_PATTERN.finditer(all_text)
    )

    frequency_candidates = []

    reconstructed_frequencies = []

    for match in FREQUENCY_PATTERN.finditer(all_text):
        detected = match.group(1).upper()
        normalized_token = re.sub(r"\s+", "", detected)
        normalized = FREQUENCY_MAP.get(normalized_token)

        if normalized:
            frequency_candidates.append(normalized)

            if detected != normalized_token:
                reconstructed_frequencies.append(normalized)

    frequency_candidates = unique(frequency_candidates)
    reconstructed_frequencies = unique(reconstructed_frequencies)

    review_reasons = []

    if reconstructed_frequencies:
        review_reasons.append(
            "Verify frequency reconstructed from spaced OCR text: " +
            ", ".join(reconstructed_frequencies)
        )

    if not medicine_candidates:
        review_reasons.append("Medicine name not confidently detected")

    if not strength_candidates:
        review_reasons.append("Strength not detected")

    if not frequency_candidates:
        review_reasons.append("Frequency not confidently detected")

    if len(medicine_candidates) > 1:
        review_reasons.append(
            "Multiple medicine components detected; verify combination"
        )

    # Decimal strengths are retained, but flagged for human verification.
    for strength in strength_candidates:
        if re.search(r"\d+\.\d+", strength):
            review_reasons.append(
                f"Verify decimal strength: {strength}"
            )

    # Preserve suspicious OCR text instead of guessing its meaning.
    uncertain_instruction_regions = []

    for region in regions:
        text = region.get("text", "").strip()
        normalized = re.sub(r"[^a-z0-9]", "", text.lower())

        if not normalized:
            continue

        # These regions contain text that may represent instructions,
        # but could not be reliably interpreted.
        if (
            re.search(r"\b(mps|quizhou1)\b", text, re.IGNORECASE)
            or "quizhou" in normalized
        ):
            uncertain_instruction_regions.append(text)

    if uncertain_instruction_regions:
        review_reasons.append(
            "Unclear instruction text: " +
            "; ".join(unique(uncertain_instruction_regions))
        )

    return {
        "entry_number": entry.get("entry_number"),
        "original_ocr_text": combined_text,
        "region_texts": region_texts,
        "extracted_fields": {
            "medicine_candidates": medicine_candidates,
            "strength_candidates": strength_candidates,
            "frequency_candidates": frequency_candidates,
            "duration_candidates": duration_candidates
        },
        "uncertain_instruction_text": unique(
            uncertain_instruction_regions
        ),
        "recognition_status": "needs_review",
        "review_reasons": unique(review_reasons)
    }


def main():
    import argparse

    parser = argparse.ArgumentParser()

    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)

    args = parser.parse_args()

    input_file = Path(args.input)
    output_file = Path(args.output)

    if not input_file.exists():
        raise FileNotFoundError(
            f"Input file not found: {input_file}"
        )

    with input_file.open("r", encoding="utf-8") as file:
        source = json.load(file)

    extracted_entries = [
        extract_entry(entry)
        for entry in source.get("entries", [])
    ]

    result = {
        "success": True,
        "engine": "RxSentinel Prescription Field Extractor",
        "source": "TrOCR",
        "processing_mode": "region_aware_extraction",
        "entries": extracted_entries
    }

    output_file.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    with output_file.open("w", encoding="utf-8") as file:
        json.dump(
            result,
            file,
            indent=4,
            ensure_ascii=False
        )

    print("\\n========== FIELD EXTRACTION ==========")

    for entry in extracted_entries:
        fields = entry["extracted_fields"]

        print(f"\\nEntry {entry['entry_number']}")
        print("Medicines:", fields["medicine_candidates"])
        print("Strength:", fields["strength_candidates"])
        print("Frequency:", fields["frequency_candidates"])
        print("Duration:", fields["duration_candidates"])
        print("Unclear text:", entry["uncertain_instruction_text"])
        print("Review:", entry["review_reasons"])

    print("\\nSaved:", output_file)


if __name__ == "__main__":
    main()
