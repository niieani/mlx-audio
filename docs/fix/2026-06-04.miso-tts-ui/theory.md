# MisoTTS UI Theory

## Problem Thesis

MisoTTS is documented as a CSM/Sesame-family TTS model, and the local model config declares `model_type: "miso_tts"`. The backend loader only knows `csm` and `marvis` as Sesame aliases, so it rejects the model before any weights load. The Studio UI has a second problem: it only offers a fixed dropdown of known model IDs and defaults non-Marvis voices to Kokoro's `af_heart`, which is wrong for CSM and actively wrong for Miso.

## Operating Theory

The clean leverage point is model identity normalization, not a new Miso model implementation. Sesame already contains the Miso architecture support from the existing Miso support commit; the missing contract is that `miso_tts` maps to the `sesame` module. A second resolver issue matters: `get_model_class()` currently discovers the explicit alias, then ignores it when path-derived name parts do not also contain a known alias. The resolver must also preserve existing wrapper modules such as `moss_tts_delay`, where the public model type has its own package even though it reuses shared implementation. The UI should not special-case every model by hardcoding only a few options. It needs an explicit custom model path/id field that sends the backend exactly what the user enters, plus voice defaults that follow the selected model family.

The local Miso config also references `meta-llama/Llama-3.2-1B` for `text_tokenizer`, which is gated and not included in the local model folder. Because Miso only needs the Llama 3.2 tokenizer contract, the Sesame loader can resolve that specific gated tokenizer reference to the public `unsloth/Llama-3.2-1B` tokenizer.

After tokenizer and prompt resolution, generation reaches MLX runtime and exposes a separate server architecture bug. `/v1/audio/speech` preflights models before returning `StreamingResponse`, because worker failures after headers are committed become misleading `200 OK` responses. That preflight used `asyncio.to_thread`, while actual generation runs on the inference broker thread. MLX stream state is thread-bound, so a cached model initialized on the preflight thread can later fail in generation with `There is no Stream(gpu, N) in current thread`.

A later runtime smoke produced a valid but useless 80 ms WAV. That was not an audio I/O failure; it was exactly one Miso audio frame followed by EOS. Comparing upstream Miso inference shows why: Miso's quickstart calls `generate(text, speaker=0, context=[], max_audio_length_ms=10000)` with no prompt audio, tokenizes text as `[0] text`, and defaults sampling to `temperature=0.9`, `topk=50`. The mlx-audio Sesame wrapper was running Miso as if it were CSM: injecting the Sesame `conversational_a` prompt, enabling `voice_match`, omitting the speaker-space default, and letting API/UI voice defaults pull the model into a prompted path. Miso needs to share the Sesame architecture, not Sesame's default prompting policy.

## Strategy

Add backend regression tests for both registration and actual class resolution, then honor explicit model-type aliases before falling back to path-name heuristics, but only when no direct model module exists for the original type. For the UI, keep the current preset dropdown but add a custom option and input so local absolute paths and HF repo IDs work without changing source code each time. Generation should send `conversational_a` for Marvis/CSM/Sesame models, `af_heart` for Kokoro, and omit voice for Miso and models without a known preset contract.

For Miso loading, add targeted tests that forbid requesting the gated Meta tokenizer and assert Miso default generation is promptless with the upstream speaker prefix. The implementation keeps the config contract intact for other Sesame-family models while special-casing only the known gated Miso tokenizer reference and Miso's runtime defaults.

For server inference, the preflight should become a broker task instead of a request-thread task. That preserves the useful HTTP error behavior while warming the model on the same serialized worker that later runs generation. The model provider cache also needs thread ownership, because manual `/v1/models` preloads or other request-thread loads can otherwise seed a cached model instance that the broker later reuses from the wrong thread. Listing/removal remains model-name based, but concrete model objects are per loading thread.

For API shape, Miso should not receive server sampling defaults unless the request explicitly supplies them. `max_tokens` is still the OpenAI-compatible field the UI/API already expose, but for Miso it maps to `max_audio_length_ms` at 80 ms per frame.

The UI should now expose the same practical controls the JSON endpoint accepts rather than hiding them behind hardcoded defaults. This means the payload builder becomes the contract boundary: display state remains camelCase, while the request payload maps to backend snake_case (`voice_match`, `ref_audio`, `top_p`, etc.). Browser file upload is intentionally not part of this slice because the endpoint is JSON-only and voice cloning currently expects a server-visible audio path.

## Uncertainties

Miso first run may still download tokenizer and Mimi assets. Runtime confidence is now based on `/v1/audio/speech` with the local Miso path: a WAV smoke generated 5.04 s, and the exact UI payload (`model`, `input`, `speed`) generated a 9.34 s MP3 instead of the previous 0.08 s EOS-only result.
