# Face identity notices

The browser-only face-identity feature uses the following locally served third-party software and model files. It does not send camera frames or face descriptors to a network service.

- `@vladmandic/human` 3.3.6 — MIT License. The bundled source license is in `human-MIT.txt`.
- `blazeface.{json,bin}` — MediaPipe BlazeFace Back variation. The Human project identifies the model source as MediaPipe; MediaPipe is licensed under Apache License 2.0. The Apache 2.0 text is in `hse-facerec-apache-2.0.txt`.
- `faceres.{json,bin}` — HSE FaceRes, derived from `av-savchenko/HSE_FaceRec_tf`, licensed under Apache License 2.0. The Apache 2.0 text is in `hse-facerec-apache-2.0.txt`.

Model definitions and weights are served from `/models/human/` only; the application does not configure a remote model URL.
