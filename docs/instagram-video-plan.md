# Plan: moving share cards on Instagram (video)

## Why a video
Instagram Stories and Reels show only the first frame of a GIF. To make the animated
share card move on Instagram, FLEX UP has to export a short **MP4 video** instead.
Phones can encode video natively, but **Expo Go has no video encoder built in**, so this
needs a **development build** of FLEX UP: your own copy of the app with the extra native code.

## What it costs
| Item | Cost | Notes |
| --- | --- | --- |
| Apple Developer Program | $99 / year | Required to install your own build on an iPhone (and later for the App Store). |
| EAS Build (Expo's cloud builds) | Free tier | About 15 iOS builds a month on the free plan; no Mac needed. |
| Google Play (later) | $25 once | Only when publishing on Android. |

## Steps
1. **Join the Apple Developer Program** at developer.apple.com (personal account is fine).
2. **Install the EAS command-line tool** and log in to Expo:
   `npx eas-cli@latest login`, then `npx eas-cli@latest build:configure` in the project.
3. **Add a video encoder.** Recommended: a small Expo native module that takes the PNG frames
   we already capture for the GIF and writes an H.264 MP4 using the phone's built-in
   encoder (AVAssetWriter on iOS, MediaCodec on Android). It adds no big libraries.
   (Alternative: `ffmpeg-kit` forks; they work but add ~30 MB and the original project is retired.)
4. **Add "Share to Instagram Story"** with `react-native-share`, which can open Instagram
   directly with the video as the Story background and the FLEX UP sticker on top.
   This needs a free Meta (Facebook) App ID registered for FLEX UP.
5. **Create the development build:** `npx eas-cli@latest build --profile development --platform ios`.
   EAS registers your iPhone, builds in the cloud, and gives you an install link.
6. **Run it:** open the new FLEX UP app on your phone instead of Expo Go, and start the
   dev server with `npx expo start --dev-client`. Everything else works the same as now.
7. **In the app:** the share screen gets a third format, "Video for Instagram". It records the
   same frames as the GIF (about 3 seconds, looping 3 times), saves an MP4, and opens Instagram.

## What stays the same
All current features (GIF, still image, share sheet) keep working in Expo Go. The video
option only appears in the development build, so nothing breaks while it's being set up.

## Rough effort
About one focused session to add the encoder module and Instagram share once the Apple
account is active, plus one cloud build (about 15–20 minutes) to try it on the phone.
