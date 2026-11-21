import os
import sys
import json
import re
import cv2
import numpy as np
from pathlib import Path
from PIL import Image

# Regular expression patterns for medical prescription parsing
STRENGTH_PATTERN = re.compile(
    r"\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?))\b",
    re.IGNORECASE
)

DOSAGE_PATTERN = re.compile(
    r"\b(\d+(?:\.\d+)?\s*(?:tablets?|tabs?|capsules?|caps?|puffs?|drops?|teaspoons?|tsp|ml))\b",
    re.IGNORECASE
)

FREQUENCY_PATTERN = re.compile(
    r"\b(once\s+daily|twice\s+daily|thrice\s+daily|three\s+times\s+daily|four\s+times\s+daily|every\s+\d+\s+hours?|1-0-1|1-1-1|1-0-0|0-0-1|0-1-0|OD|BD|BID|TDS|TID|QID|QDS|PRN|SOS|HS|STAT)\b",
    re.IGNORECASE
)

DURATION_PATTERN = re.compile(
    r"\b(for\s+\d+\s*(?:days?|weeks?|months?)|(?:\d+)\s*(?:days?|weeks?|months?))\b",
    re.IGNORECASE
)

# Common doctor prescription header/footer tokens to ignore
EXCLUDE_TOKENS = [
    "clinic", "hospital", "doctor", "dr.", "dr ", "mbbs", "md", "patient", "name:", "age:",
    "sex:", "date:", "rx", "address:", "phone:", "reg", "signature", "opd", "ipd"
]

def preprocess_image(image_path, output_dir=None):
    """
    OpenCV Preprocessing Pipeline:
    - Grayscale conversion
    - CLAHE (Contrast Limited Adaptive Histogram Equalization)
    - Bilateral filtering for edge-preserving denoising
    - Adaptive Otsu thresholding
    """
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Could not read image at {image_path}")

    # Resize if image is too small for OCR
    h, w = img.shape[:2]
    if w < 1200:
        scale = 1200 / float(w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Denoise preserving sharp text boundaries
    denoised = cv2.bilateralFilter(gray, 9, 75, 75)

    # Enhance contrast with CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)

    # Binarize with Otsu
    _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Output processed image
    if output_dir:
        out_p = Path(output_dir) / f"preprocessed_{Path(image_path).name}"
        cv2.imwrite(str(out_p), binary)
        return str(out_p), img, binary

    return str(image_path), img, binary


def run_trocr(image_path):
    """
    TrOCR for handwritten prescription recognition
    """
    try:
        from transformers import TrOCRProcessor, VisionEncoderDecoderModel
        import torch

        print("Initializing TrOCR handwriting model...", file=sys.stderr)
        processor = TrOCRProcessor.from_pretrained("microsoft/trocr-base-handwritten")
        model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-base-handwritten")
        model.eval()

        image = Image.open(image_path).convert("RGB")
        pixel_values = processor(images=image, return_tensors="pt").pixel_values

        with torch.no_grad():
            generated_ids = model.generate(pixel_values, max_new_tokens=128, num_beams=3)

        generated_text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0].strip()
        return generated_text, 82.0
    except Exception as e:
        print(f"TrOCR exception: {e}", file=sys.stderr)
        return "", 0.0


def run_pytesseract(image_path):
    """
    Tesseract OCR for printed prescriptions
    """
    try:
        import pytesseract
        # If tesseract binary exists in standard PATH
        text = pytesseract.image_to_string(Image.open(image_path))
        data = pytesseract.image_to_data(Image.open(image_path), output_type=pytesseract.Output.DICT)
        confs = [int(c) for c in data.get("conf", []) if int(c) > 0]
        avg_conf = float(sum(confs) / len(confs)) if confs else 75.0
        return text.strip(), avg_conf
    except Exception as e:
        print(f"Pytesseract note: {e}", file=sys.stderr)
        return "", 0.0


def extract_medicine_entries(raw_text):
    """
    Segment lines into medicine candidates and parse dosage, strength, frequency, duration
    """
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    candidates = []

    for line in lines:
        lower_line = line.lower()

        # Skip headers / footers / doctor meta
        if any(lower_line.startswith(token) for token in EXCLUDE_TOKENS):
            continue

        # Look for strength
        strength_match = STRENGTH_PATTERN.search(line)
        strength = strength_match.group(1) if strength_match else None

        # Look for dosage
        dosage_match = DOSAGE_PATTERN.search(line)
        dosage = dosage_match.group(1) if dosage_match else None

        # Look for frequency
        freq_match = FREQUENCY_PATTERN.search(line)
        freq = freq_match.group(1) if freq_match else None

        # Look for duration
        dur_match = DURATION_PATTERN.search(line)
        dur = dur_match.group(1) if dur_match else None

        # Clean medicine name by stripping numbers and matched tokens
        clean_name = line
        if strength: clean_name = clean_name.replace(strength, "")
        if dosage: clean_name = clean_name.replace(dosage, "")
        if freq: clean_name = clean_name.replace(freq, "")
        if dur: clean_name = clean_name.replace(dur, "")

        clean_name = re.sub(r"^\d+[\.\)\-]?\s*", "", clean_name) # remove line numbers like "1.", "2)"
        clean_name = re.sub(r"^(tab|cap|inj|syp|tablet|capsule|syrup)\.?\s*", "", clean_name, flags=re.IGNORECASE)
        clean_name = clean_name.strip(" -:;,")

        if len(clean_name) >= 3:
            candidates.append({
                "raw_text": line,
                "detected_name": clean_name,
                "strength": strength,
                "dosage": dosage,
                "frequency": freq,
                "duration": dur,
                "confidence": 75.0
            })

    return candidates


def process_prescription(image_path, prescription_type="printed", output_dir=None):
    """
    Complete Modular OCR Service Workflow:
    Prescription Upload -> Image Preprocessing -> OCR -> Medicine Extraction
    """
    if not os.path.exists(image_path):
        return {
            "success": False,
            "error": f"Image file not found: {image_path}"
        }

    # Preprocess with OpenCV
    try:
        proc_path, raw_img, binary_img = preprocess_image(image_path, output_dir)
    except Exception as e:
        proc_path = image_path

    raw_text = ""
    confidence = 70.0
    engine_used = "Tesseract"

    if prescription_type == "handwritten":
        engine_used = "TrOCR"
        text, conf = run_trocr(proc_path)
        if text:
            raw_text = text
            confidence = conf
        else:
            # Fallback to Tesseract if TrOCR fails
            text, conf = run_pytesseract(proc_path)
            raw_text = text
            confidence = conf
            engine_used = "Tesseract (Handwriting Fallback)"
    else:
        text, conf = run_pytesseract(proc_path)
        if text:
            raw_text = text
            confidence = conf
        else:
            engine_used = "OpenCV-Tesseract"
            raw_text = ""

    candidates = extract_medicine_entries(raw_text)

    return {
        "success": True,
        "engine": engine_used,
        "prescription_type": prescription_type,
        "confidence": confidence,
        "raw_text": raw_text,
        "candidates": candidates
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python prescription_ocr_service.py <image_path> [printed|handwritten]"
        }))
        sys.exit(1)

    image_path = sys.argv[1]
    p_type = sys.argv[2] if len(sys.argv) > 2 else "printed"

    result = process_prescription(image_path, p_type)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
