
import sys
import json
import os
import traceback

import torch
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel


MODEL_NAME = "microsoft/trocr-base-handwritten"

processor = None
model = None


def load_model():
    global processor, model

    if model is None:
        print("Loading TrOCR handwriting model...", file=sys.stderr)

        processor = TrOCRProcessor.from_pretrained(MODEL_NAME)

        model = VisionEncoderDecoderModel.from_pretrained(
            MODEL_NAME
        )

        model.to("cpu")
        model.eval()

        print("TrOCR model loaded successfully.", file=sys.stderr)


def recognize_image(image_path):
    load_model()

    image = Image.open(image_path).convert("RGB")

    inputs = processor(
        images=image,
        return_tensors="pt"
    )

    with torch.inference_mode():
        generated_ids = model.generate(
            inputs.pixel_values,
            max_new_tokens=128,
            num_beams=4
        )

    text = processor.batch_decode(
        generated_ids,
        skip_special_tokens=True
    )[0].strip()

    return text


def main():
    try:
        request = json.loads(sys.stdin.readline())

        image_path = request.get("imagePath")

        if not image_path or not os.path.isfile(image_path):
            raise ValueError("Valid imagePath is required.")

        text = recognize_image(image_path)

        print(json.dumps({
            "success": True,
            "text": text,
            "ocrMode": "trocr_handwriting"
        }), flush=True)

    except Exception as error:
        print(json.dumps({
            "success": False,
            "error": str(error)
        }), flush=True)


if __name__ == "__main__":
    main()
