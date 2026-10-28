# Douyin acquisition checkpoint - 2026-10-27

- Source: https://www.douyin.com/note/7684572630280187855
- Existing manifest and all 53 WebP files preserved. New image downloads confirmed: **0**.
- Normal IAB browser navigation succeeded without login. Ordinary login suggestion modal was dismissed with its close button. No authentication, CAPTCHA, or access barrier was bypassed.
- Page title/caption and creator matched prior source. Gallery was auto-advancing; observed counters included 2/80, 6/80, screenshot 8/80, and 10/80. Paused via normal playback control at 10/80; playback control DOM text changed to play.
- Rendered DOM exposed 80 .dySwiperSlide nodes and 80 direct photo image URL paths, saved in acquisition-observations.json. These are **gallery source photos**, not an assertion of 80 distinct card faces or physical deck quantity.
- DOM ordinal 10 aligned with on-page 10/80 and visible gallery coordinates x=160,y=56,width=746,height=640. Other DOM ordinals are only candidate positions pending direct counter/navigation validation. The original manifest's null indexes remain unchanged.
- 53 of the 80 observed URL paths match prior manifest URLs by case-sensitive pathname identity. Signed query strings expired independently of pathname identity; only two full signed URL samples were preserved. No unobserved URLs were fabricated or fetched.
- Concrete tool limitation: the supported pageAssets inventory+bundle call did not return a result and blocked about 711.2 seconds before intentional interruption. No bundle output directory or manifest path was received, so do not claim download success from that attempt. No further gallery exploration or retry was performed after parent requested stop.
- Existing 53 files were rehashed with SHA-256. Individual filenames, byte sizes and hashes are in acquisition-observations.json. This hash audit checks byte identity only; it does not validate image decoding, source attribution, or printed mechanics. Prior image-integrity audit remains the decoding evidence.
- Next bounded attempt: read this checkpoint and observations; reacquire fresh signed URLs with normal browser DOM/pageAssets, validate candidate positions through normal carousel controls, download only observed missing images, then hash-deduplicate against preserved originals. Persist incremental results before any potentially long bundle call.

## Final bounded follow-up

Parent authorized one normal locator.downloadMedia attempt with a 20-second media timeout, targeting the already observed DOM ordinal 54. It failed immediately (0.0219 seconds): `Browser is not available: 2`. No media path was returned. No retry or browser recovery was attempted. Final confirmed new downloads remain zero; 27 observed paths have no matching saved asset. The original manifest and all 53 original images remain unchanged.

## Fresh-binding download follow-up (2026-10-27T11:56:13.723606+00:00)

- Reopened source in a fresh normal IAB tab and reobserved all 80 rendered `.dySwiperSlide` image URLs. Saved **all full signed URLs before any download** in `signed-observed-20261027.json`; acquisition observations also now preserve each full URL.
- One supported `locator.downloadMedia({timeoutMs:20000})` call for candidate DOM ordinal 54 succeeded, but took **795.2135 seconds** despite 20-second media and 30-second tool timeout requests. No further browser download calls attempted because bounded operation could not be guaranteed.
- Preserved `2ce6114721e23bda.webp`: 225262 bytes, 2374×1653 WEBP, SHA-256 `2ce6114721e23bda31f5cb679d1832a400b62594f7b9b994e0016d0e5cf8cfc6`. Pillow fully decoded the saved image. Hash is distinct from all 53 preserved originals. Original 53 files remain unchanged.
- **54 saved source photos; 26 observed paths remain without saved files.** DOM ordinal 54 is a candidate position; no new on-page counter mapping was claimed. New content has not been transcribed.


## Bounded direct transfer (2026-10-27T12:38:38.402268+00:00)

- Downloaded 26 of 26 missing exact previously observed signed public media URLs using four workers and 15-second socket timeouts.
- 80 unique WebP files now saved; original 54 file hashes unchanged: True. Every newly saved image fully decoded with Pillow.
- Manifest entries retain candidate DOM ordinal and imageIndex=null. No on-page gallery index or card transcription is asserted. See direct-transfer-results-20261027.json for per-request outcomes and original file hashes.
