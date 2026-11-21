import cv2
import os
import json
import argparse
from pathlib import Path

from trocr_service import load_model, recognize_image


def detect_regions(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    binary = cv2.threshold(
        gray,
        0,
        255,
        cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )[1]

    kernel = cv2.getStructuringElement(
        cv2.MORPH_RECT,
        (100, 3)
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

    height, width = image.shape[:2]
    regions = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)

        if w < 35 or h < 8 or w * h < 100:
            continue

        regions.append({
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "center_y": y + h / 2
        })

    return sorted(regions, key=lambda r: (r["y"], r["x"]))


def detect_number_markers(regions, image_shape):
    height, width = image_shape[:2]
    markers = []

    for region in regions:
        x = region["x"]
        y = region["y"]
        w = region["w"]
        h = region["h"]

        if (
            x < width * 0.22
            and y > height * 0.12
            and w < width * 0.12
            and h < height * 0.20
        ):
            markers.append(region)

    return sorted(markers, key=lambda r: r["center_y"])


def group_regions(regions, markers):
    if not markers:
        return [{
            "entry_number": 1,
            "regions": regions
        }]

    marker_centers = [
        marker["center_y"] for marker in markers
    ]

    boundaries = [
        (marker_centers[i] + marker_centers[i + 1]) / 2
        for i in range(len(marker_centers) - 1)
    ]

    groups = []

    for i, marker in enumerate(markers):
        lower = 0 if i == 0 else boundaries[i - 1]

        upper = (
            float("inf")
            if i == len(markers) - 1
            else boundaries[i]
        )

        entry_regions = []

        for region in regions:
            if region in markers:
                continue

            center = region["center_y"]

            if lower <= center < upper:
                entry_regions.append(region)

        groups.append({
            "entry_number": i + 1,
            "regions": sorted(
                entry_regions,
                key=lambda r: (r["y"], r["x"])
            )
        })

    return groups


def run_ocr(image, regions, entry_number, output_dir):
    height, width = image.shape[:2]
    lines = []

    for index, region in enumerate(regions, 1):
        x = region["x"]
        y = region["y"]
        w = region["w"]
        h = region["h"]

        padding = 25

        x1 = max(0, x - padding)
        y1 = max(0, y - padding)
        x2 = min(width, x + w + padding)
        y2 = min(height, y + h + padding)

        crop = image[y1:y2, x1:x2]

        crop_path = os.path.join(
            output_dir,
            f"entry_{entry_number}_region_{index}.png"
        )

        if not cv2.imwrite(crop_path, crop):
            raise RuntimeError(
                f"Could not save image region: {crop_path}"
            )

        recognized_text = recognize_image(crop_path)

        lines.append({
            "text": recognized_text.strip(),
            "position": {
                "x": x,
                "y": y,
                "width": w,
                "height": h
            }
        })

    return lines


def process_prescription(input_image, output_dir):
    input_image = Path(input_image)
    output_dir = Path(output_dir)

    if not input_image.exists():
        raise FileNotFoundError(
            f"Prescription image not found: {input_image}"
        )

    output_dir.mkdir(parents=True, exist_ok=True)

    output_json = output_dir / "prescription.json"

    image = cv2.imread(str(input_image))

    if image is None:
        raise ValueError(
            f"Could not read prescription image: {input_image}"
        )

    print("\nSTEP 1: Detecting handwriting regions...")

    regions = detect_regions(image)
    print("Detected regions:", len(regions))

    if not regions:
        raise ValueError(
            "No handwriting regions detected in the image."
        )

    print("\nSTEP 2: Detecting numbered entries...")

    markers = detect_number_markers(regions, image.shape)
    print("Detected entry markers:", len(markers))

    print("\nSTEP 3: Grouping handwriting...")

    groups = group_regions(regions, markers)

    for group in groups:
        print(
            f"Entry {group['entry_number']}: "
            f"{len(group['regions'])} regions"
        )

    print("\nSTEP 4: Loading TrOCR...")
    load_model()

    results = []

    print("\nSTEP 5: Running handwriting recognition...")

    for group in groups:
        entry_number = group["entry_number"]

        lines = run_ocr(
            image,
            group["regions"],
            entry_number,
            str(output_dir)
        )

        combined_text = " ".join(
            line["text"]
            for line in lines
            if line["text"]
        )

        results.append({
            "entry_number": entry_number,
            "recognized_text": combined_text,
            "regions": lines,
            "recognition_status": "needs_review"
        })

        print(f"\nMEDICINE ENTRY {entry_number}")
        print(combined_text)

    output = {
        "success": True,
        "ocr_engine": "TrOCR",
        "source_image": input_image.name,
        "processing_mode": "coordinate_based_grouping",
        "entries": results
    }

    with output_json.open("w", encoding="utf-8") as file:
        json.dump(
            output,
            file,
            indent=4,
            ensure_ascii=False
        )

    print("\nPRESCRIPTION PROCESSING COMPLETED")
    print("Entries:", len(results))
    print("JSON:", output_json)

    return str(output_json)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="RxSentinel handwritten prescription OCR"
    )

    parser.add_argument(
        "--input",
        required=True,
        help="Path to the uploaded prescription image"
    )

    parser.add_argument(
        "--output-dir",
        required=True,
        help="Directory for TrOCR output files"
    )

    args = parser.parse_args()

    try:
        result_path = process_prescription(
            args.input,
            args.output_dir
        )

        print("\nRESULT_JSON_PATH=" + result_path)

    except Exception as error:
        print("TROCR_ERROR:", str(error))
        raise
