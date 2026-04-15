"""
OCR Service — jerarquía de motores para texto manuscrito, impreso y diagramas:

  1. Gemini Flash Vision  (GRATIS, excelente para manuscrito en español)
  2. Claude Vision        (premium, requiere créditos Anthropic)
  3. EasyOCR             (local, sin internet, bueno para impreso)
  4. Tesseract           (último recurso, solo texto impreso)
"""
import os
import base64
from backend.config.settings import ANTHROPIC_API_KEY, GEMINI_API_KEY, OCR_LANG, TESSERACT_CMD

OCR_PROMPT = (
    "Transcribe EXACTAMENTE todo el texto que aparece en esta imagen de un cuaderno escolar. "
    "Si el texto es manuscrito (letra a mano), transcríbelo fielmente respetando la ortografía original. "
    "Mantén la estructura: párrafos, listas con guiones, títulos subrayados, fórmulas matemáticas. "
    "Si hay diagramas, mapas conceptuales o esquemas, descríbelos brevemente entre corchetes [Diagrama: ...]. "
    "Devuelve SOLO el texto transcrito, sin comentarios adicionales ni explicaciones. "
    "Si no hay texto legible, responde únicamente: [Sin texto detectado]"
)


# ─── Motor 1: Google Gemini Flash Vision (GRATIS) ─────────────────────────────

def _process_with_gemini(path: str) -> dict:
    from google import genai
    from google.genai import types

    key = GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    if not key or key == "your_gemini_api_key_here":
        raise RuntimeError("GEMINI_API_KEY no configurada")

    client = genai.Client(api_key=key)

    with open(path, "rb") as f:
        image_bytes = f.read()

    ext = path.rsplit(".", 1)[-1].lower()
    mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                "png": "image/png", "webp": "image/webp", "gif": "image/gif"}
    mime_type = mime_map.get(ext, "image/jpeg")

    response = client.models.generate_content(
        model="models/gemini-flash-latest",
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            types.Part(text=OCR_PROMPT),
        ],
    )
    text = response.text.strip()
    if text == "[Sin texto detectado]":
        text = ""
    return {
        "text": text,
        "confidence": 98.0,
        "engine": "gemini-vision",
        "word_count": len(text.split()) if text else 0,
    }


# ─── Motor 2: Claude Vision (premium) ────────────────────────────────────────

def _process_with_claude(path: str) -> dict:
    import anthropic

    key = ANTHROPIC_API_KEY or os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY no configurada")

    ext = path.rsplit(".", 1)[-1].lower()
    media_types = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                   "png": "image/png", "webp": "image/webp"}
    media_type = media_types.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    client = anthropic.Anthropic(api_key=key)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_data}},
            {"type": "text", "text": OCR_PROMPT},
        ]}],
    )
    text = response.content[0].text.strip()
    if text == "[Sin texto detectado]":
        text = ""
    return {"text": text, "confidence": 99.0, "engine": "claude-vision",
            "word_count": len(text.split()) if text else 0}


# ─── Motor 3: EasyOCR (deep learning local) ──────────────────────────────────

_easyocr_reader = None


def _process_with_easyocr(path: str) -> dict:
    global _easyocr_reader
    import easyocr
    if _easyocr_reader is None:
        _easyocr_reader = easyocr.Reader(["es", "en"], gpu=False, verbose=False)

    results = _easyocr_reader.readtext(path, detail=1, paragraph=False)
    if not results:
        return {"text": "", "confidence": 0.0, "engine": "easyocr", "word_count": 0}

    results.sort(key=lambda r: (r[0][0][1], r[0][0][0]))
    lines, cur, last_y = [], [], None
    for bbox, word, conf in results:
        y = bbox[0][1]
        if last_y is not None and abs(y - last_y) > 20:
            if cur:
                lines.append(" ".join(cur))
            cur = []
        cur.append(word)
        last_y = y
    if cur:
        lines.append(" ".join(cur))

    text = "\n".join(lines).strip()
    avg_conf = sum(r[2] for r in results) / len(results) * 100
    return {"text": text, "confidence": round(avg_conf, 1), "engine": "easyocr",
            "word_count": len(text.split()) if text else 0}


# ─── Motor 4: Tesseract (último recurso) ─────────────────────────────────────

def _process_with_tesseract(path: str) -> dict:
    try:
        import pytesseract
        from PIL import Image, ImageFilter, ImageEnhance
        pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD
    except ImportError:
        return {"text": "", "error": "Tesseract no disponible", "confidence": 0, "engine": "none"}
    try:
        img = Image.open(path).convert("L")
        img = ImageEnhance.Contrast(img.filter(ImageFilter.SHARPEN)).enhance(2.0)
        w, h = img.size
        if w < 1000:
            img = img.resize((1000, int(h * 1000 / w)), Image.LANCZOS)
        text = pytesseract.image_to_string(img, lang=OCR_LANG, config="--psm 6 --oem 3").strip()
        return {"text": text, "confidence": 55.0, "engine": "tesseract",
                "word_count": len(text.split()) if text else 0}
    except Exception as e:
        return {"text": "", "error": str(e), "confidence": 0, "engine": "tesseract"}


# ─── Punto de entrada ─────────────────────────────────────────────────────────

def process_image(path: str) -> dict:
    """
    Extrae texto usando el mejor motor disponible.
    Jerarquía: Gemini → Claude → EasyOCR → Tesseract
    """
    if not os.path.exists(path):
        return {"text": "", "error": "Archivo no encontrado", "confidence": 0}

    errors = []

    # 1. Gemini Flash (gratis, excelente para manuscrito)
    gemini_key = GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    if gemini_key and gemini_key != "your_gemini_api_key_here":
        try:
            return _process_with_gemini(path)
        except Exception as e:
            errors.append(f"Gemini: {e}")

    # 2. Claude Vision (premium)
    anthropic_key = ANTHROPIC_API_KEY or os.getenv("ANTHROPIC_API_KEY", "")
    if anthropic_key:
        try:
            return _process_with_claude(path)
        except Exception as e:
            errors.append(f"Claude: {e}")

    # 3. EasyOCR (local)
    try:
        result = _process_with_easyocr(path)
        if errors:
            result["warning"] = " | ".join(errors)
        return result
    except Exception as e:
        errors.append(f"EasyOCR: {e}")

    # 4. Tesseract (último recurso)
    result = _process_with_tesseract(path)
    result["warning"] = " | ".join(errors)
    return result
