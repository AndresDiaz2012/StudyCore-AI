"""
AI Service — Google Gemini 2.0 Flash (GRATIS)
SDK: google-genai (oficial, actualizado)
Tier gratuito: 1 500 req/día · 15 req/min · 1M tokens/día
"""
import os
import json
from typing import Generator
from google import genai
from google.genai import types
from backend.config.settings import GEMINI_API_KEY

_client = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        key = GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
        if not key or key == "your_gemini_api_key_here":
            raise RuntimeError(
                "GEMINI_API_KEY no configurada. "
                "Obtén tu key GRATIS en aistudio.google.com/app/apikey "
                "y agrégala al archivo .env"
            )
        _client = genai.Client(api_key=key)
    return _client


GEMINI_MODEL = "models/gemini-flash-latest"


def _build_personalization(profile_json: str) -> str:
    """Builds the personalization block from the user profile JSON."""
    try:
        p = json.loads(profile_json or "{}")
    except Exception:
        return ""
    if not p:
        return ""

    lines = []

    # Grade calibration
    grade_level = p.get("grade_level", "")
    avg = p.get("current_average")
    if avg:
        lines.append(f"- Promedio actual del estudiante: {avg}/20")
    if grade_level == "struggling":
        lines.append("- Nivel académico: necesita explicaciones desde lo más básico, paso a paso, sin asumir nada por obvio.")
    elif grade_level == "average":
        lines.append("- Nivel académico: nivel intermedio — refuerza conceptos pero no expliques lo muy básico.")
    elif grade_level == "good":
        lines.append("- Nivel académico: buen nivel — puedes usar algo de tecnicismo si lo explicas.")
    elif grade_level == "excellent":
        lines.append("- Nivel académico: excelente — puede usar términos técnicos y profundizar más.")

    # Interests for analogies
    analogies = []
    if p.get("plays_games") and p.get("game_types"):
        analogies.append(f"videojuegos de tipo {', '.join(p['game_types'])}")
    if p.get("likes_sports") and p.get("fav_sports"):
        analogies.append(f"deportes ({p['fav_sports']})")
    if p.get("fav_story"):
        analogies.append(f"la historia/serie '{p['fav_story']}'")
    if p.get("other_interests"):
        analogies.append(p["other_interests"])
    if p.get("reading_types"):
        analogies.append(f"lectura de {', '.join(p['reading_types'])}")
    if analogies:
        lines.append(f"- Usa analogías de: {'; '.join(analogies)}. El estudiante conectará mejor con esas referencias.")

    if not lines:
        return ""

    return "\n═══ PERFIL DEL ESTUDIANTE (personalización) ═══\n" + "\n".join(lines)


def _build_system_prompt(subject_name: str, context: str, sources_text: str = "", user_profile: str = "") -> str:
    prompt = f"""Eres un profesor experto en {subject_name}, parte del sistema educativo StudyCore AI.
Tu misión es ayudar a cada estudiante a entender los conceptos con sus propias palabras, su propio estilo y su propia forma de pensar. El objetivo de la educación no es que todos piensen igual, sino que cada quien desarrolle su propio pensamiento crítico.

═══ PRINCIPIOS FUNDAMENTALES ═══

1. NUNCA hagas la tarea por el estudiante.
   • Sí puedes: explicar CÓMO resolver un problema paso a paso, dar pistas, mostrar un ejemplo DIFERENTE al de la tarea.
   • Sí puedes: corregir el trabajo del estudiante, señalar exactamente dónde está el error y explicar POR QUÉ es un error para que no lo repita.
   • No puedes: dar la respuesta directa a una tarea o examen.

2. ADAPTA tu explicación a cómo piensa cada estudiante.
   • Si el estudiante menciona algo que le gusta (música, deportes, videojuegos, cocina, etc.), usa eso como analogía.
   • Pregunta cómo prefiere aprender si no lo sabes.
   • Algunos entienden mejor con ejemplos visuales (diagramas en texto), otros con historias, otros con pasos numéricos.

3. USA recursos visuales cuando ayude a entender:
   • Mapas mentales en texto:
       [TEMA CENTRAL]
           ├── subtema A
           │     └── detalle
           └── subtema B
   • Diagramas de flujo:
       Paso 1 → Paso 2 → Paso 3 → Resultado
   • Tablas comparativas con | columnas |
   • Ejemplos de la vida cotidiana ANTES de los ejemplos abstractos.

4. CORRIGE con empatía:
   • Nunca digas "estás mal". Di: "Casi lo tienes — el error está en X, y ocurre porque Y".
   • Muestra el razonamiento correcto sin dar la respuesta final si es tarea.

5. MOTIVA el pensamiento propio:
   • Termina con una pregunta que haga reflexionar al estudiante.
   • Celebra cuando el estudiante llega a una conclusión por sí mismo.
   • Si el estudiante da una respuesta inesperada pero válida, reconócela.

6. Responde SIEMPRE en español latinoamericano, de forma clara y concisa."""

    personalization = _build_personalization(user_profile)
    if personalization:
        prompt = prompt + chr(10) + personalization

    if sources_text.strip():
        prompt += f"""

═══ MATERIAL DE ESTUDIO DEL ESTUDIANTE ═══
(Usa este contenido para personalizar y contextualizar tus respuestas)

{sources_text}"""
    elif context.strip():
        prompt += f"""

═══ APUNTES DEL ESTUDIANTE ═══
{context}"""

    return prompt


def _build_contents(
    question: str,
    messages_history: list | None,
) -> list:
    contents = []
    if messages_history:
        for msg in messages_history[-10:]:
            role    = msg.get("role", "")
            content = msg.get("content", "")
            if not content:
                continue
            gemini_role = "model" if role == "assistant" else "user"
            contents.append(types.Content(
                role=gemini_role,
                parts=[types.Part(text=content)]
            ))
    contents.append(types.Content(
        role="user",
        parts=[types.Part(text=question)]
    ))
    return contents


def get_ai_response(
    question: str,
    subject_name: str = "General",
    context: str = "",
    sources_text: str = "",
    messages_history: list | None = None,
    user_profile: str = "",
) -> str:
    client   = _get_client()
    system   = _build_system_prompt(subject_name, context, sources_text, user_profile)
    contents = _build_contents(question, messages_history)

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=2048,
            temperature=0.7,
        ),
    )
    return response.text


def stream_ai_response(
    question: str,
    subject_name: str = "General",
    context: str = "",
    sources_text: str = "",
    messages_history: list | None = None,
) -> Generator[str, None, None]:
    client   = _get_client()
    system   = _build_system_prompt(subject_name, context, sources_text)
    contents = _build_contents(question, messages_history)

    for chunk in client.models.generate_content_stream(
        model=GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=2048,
            temperature=0.7,
        ),
    ):
        if chunk.text:
            yield chunk.text
