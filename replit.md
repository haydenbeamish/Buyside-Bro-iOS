# Buy Side Bro — Mobile App

## Overview

This is the **Buy Side Bro** iOS/Android mobile app, built with **React Native** and **Expo**. It is a WebView wrapper that loads the Buy Side Bro website ([https://www.buysidebro.com](https://www.buysidebro.com)) in a native mobile shell for App Store and Google Play distribution.

## Architecture

- **Framework:** React Native + Expo (SDK 54, TypeScript)
- **Core Component:** Single full-screen `WebView` pointing to `https://www.buysidebro.com`
- **No backend or API:** All features, authentication, payments, and data are handled by the website
- **Companion project:** The main web codebase (separate repository) powers all functionality

## Key Features

| Feature | Implementation |
|---|---|
| Full-screen WebView | Loads buysidebro.com with no native chrome |
| Offline detection | Shows "No Connection" screen with retry button |
| Pull-to-refresh | Swipe down to reload the WebView |
| Android back button | Navigates back in WebView history before exiting |
| External links | Stripe checkout, OAuth redirects open in system browser |
| Session persistence | Cookies and DOM storage enabled for authentication |
| Dark theme | Black background (#000000) with orange (#F97316) accents |

## Project Structure

```
/
├── App.tsx              # Main app component (WebView + offline handling)
├── app.json             # Expo configuration (app name, bundle ID, splash)
├── index.ts             # Expo entry point
├── tsconfig.json        # TypeScript configuration
├── package.json         # Dependencies
└── assets/              # App icons and splash screen images
```

## Running the App

```bash
# Start Expo development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

## App Configuration

- **App Name:** Buy Side Bro
- **Bundle Identifier:** `com.buysidebro.app`
- **Orientation:** Portrait (landscape supported on tablets)
- **Status Bar:** Light text on dark background
- **Background Color:** #000000

## Building for Production

```bash
# Build for iOS App Store
eas build --platform ios --profile production

# Build for Google Play Store
eas build --platform android --profile production
```

Requires an [Expo Application Services (EAS)](https://expo.dev/eas) account and appropriate Apple/Google developer credentials.

## Notes

- This app contains **no native screens, API calls, or backend logic** — it is purely a WebView wrapper
- All user-facing features (courses, authentication, payments, profiles) are served by the website
- App updates are instant — deploying changes to the website automatically updates the mobile experience
- Only the app shell (icons, splash screen, native behaviors) requires an app store update
