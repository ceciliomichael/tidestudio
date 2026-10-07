# User Preferences

- Keep responses concise, direct, and in English.
- For TideStudio development, plan before implementation and keep plans under `docs/plan/`.
- TideStudio UI should feel calm, precise, restrained, and deliberate, with hierarchy driven by spacing, typography, alignment, and fine separators rather than decoration.
- Prefer flat solid surfaces and open layouts. Avoid gradients, glass effects, heavy shadows, and unnecessary cards.
- Use a consistent icon library for interface icons. Do not use emoji as UI icons.
- Structure the TideStudio desktop workspace around an approximately 20/60/20 resizable layout: left navigation, center primary content, right contextual model/server configuration.
- Keep an `InferenceBackend` architecture boundary so llama.cpp is one backend implementation rather than being coupled directly to the server registry.
