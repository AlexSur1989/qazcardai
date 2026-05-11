# Unconfirmed Kie Models

These models were requested but were not added as `AiModel` rows because an exact official Kie docs page or concrete mode contract was not confirmed during this pass.

| Family | Requested mode | Why not added | What to verify manually |
| --- | --- | --- | --- |
| Wan 2.7 Image | `wan-2-7-text-to-image` | Search did not find an official `docs.kie.ai/market/wan/...` image generation page for Wan 2.7. | Exact docs URL, `model`, input fields, endpoint, pricing. |
| Wan 2.7 Image | `wan-2-7-image-to-image` / edit | Search did not find an official Kie docs page for this mode. | Exact docs URL, whether it is I2I or edit, upload fields, pricing. |
| Seedream 5.0 Lite | `seedream-5-lite-text-to-image` | Official docs were found for `seedream/5-lite-image-to-image` only. | Whether a separate T2I model exists and its exact `apiModelId`. |
| Z-Image | text/image modes | Search did not find a concrete official Z-Image docs page. | Exact docs URL, concrete modes and model IDs. |
| Flux 2 / Black Forest Labs | `flux-2-pro-*` | Official market docs in this pass list Flex T2I/I2I; Pro modes were not confirmed. | Exact Pro docs URLs, fields and pricing. |
| FLUX.1 Kontext | generate/edit | Search did not find official Kie docs for FLUX.1 Kontext. | Exact docs URL and whether endpoint is `/api/v1/jobs/createTask` or custom. |
| Ideogram V3 | `ideogram-v3-text-to-image` | Official docs were confirmed for Edit and Remix; no V3 T2I page found in this pass. | Exact docs URL if a V3 T2I mode exists. |
| Ideogram V3 | `ideogram-v3-reframe` | Search result suggested a page, but direct fetch returned 404. | Correct docs URL and input fields. |
| Veo 3.1 | text-to-video / image-to-video | Existing project has a custom Veo seed using `/api/v1/veo/*`, but `docs.kie.ai/market` search did not confirm concrete Veo 3.1 market docs in this pass. | Exact Kie docs URLs, endpoint, adapter requirements and source task handling before adding to unified registry. |
