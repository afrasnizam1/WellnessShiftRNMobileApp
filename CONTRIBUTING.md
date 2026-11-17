# Contributing to WellnessShift

Thank you for your interest in contributing to WellnessShift! This document provides guidelines and instructions for setting up your development environment and contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)

## Development Setup

### Prerequisites

- **Node.js** 18+ (we recommend using nvm)
- **npm** 10+
- **Git**

For iOS development:
- **macOS** (required for iOS development)
- **Xcode** 16+ with iOS 18 simulators
- **CocoaPods** (`sudo gem install cocoapods`)
- **Watchman** (optional but recommended: `brew install watchman`)

For Android development:
- **Java JDK** 17+
- **Android Studio** with:
  - Android SDK Platform 34+
  - Android SDK Build-Tools
  - Android Emulator
  - Android SDK Platform-Tools

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/afrasnizam1/WellnessShiftRNMobileApp.git
   cd WellnessShiftRNMobileApp
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```
   
   Note: We use `--legacy-peer-deps` due to peer dependency conflicts between React Native 0.86, Firebase, and other native modules. This is normal for complex React Native projects.

3. **Install iOS dependencies** (macOS only)
   ```bash
   cd ios
   pod install
   cd ..
   ```

4. **Configure Google Sign-In** (optional)
   
   Create `src/config/googleAuth.local.ts`:
   ```typescript
   export const GOOGLE_WEB_CLIENT_ID = 'your-web-client-id-here';
   ```
   
   Without this, the Google Sign-In button will be hidden but the app will work normally.

### Running the App

1. **Start Metro bundler**
   ```bash
   npm start
   ```

2. **Run on iOS** (in a new terminal)
   ```bash
   npm run ios
   # or for a specific simulator
   npx react-native run-ios --simulator "iPhone 17 Pro"
   ```

3. **Run on Android** (in a new terminal)
   ```bash
   npm run android
   ```
   
   The Android script automatically handles port forwarding and dismisses the 16KB compatibility dialog.

### Common Issues

#### Dependencies Not Installing

If you encounter peer dependency conflicts:
```bash
npm install --legacy-peer-deps --force
```

#### iOS Build Fails

1. Clean iOS build:
   ```bash
   cd ios
   pod deintegrate
   pod install
   cd ..
   xcodebuild -workspace ios/WellnessShift.xcworkspace -scheme WellnessShift clean
   ```

2. Try running again:
   ```bash
   npm run ios
   ```

#### Android Build Fails

1. Clean Android build:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

2. Try running again:
   ```bash
   npm run android
   ```

#### Metro Bundler Issues

Reset Metro cache:
```bash
npm start -- --reset-cache
```

#### Hologram/Native Changes Not Showing

For **Android**, native changes and hologram updates require a full rebuild:
```bash
npm run bundle:hologram  # If you changed hologram viewer
npm run android          # Full rebuild
```

For **iOS**, hologram model changes require a full rebuild:
```bash
npx react-native run-ios
```

## Project Structure

```
WellnessShift/
├── src/
│   ├── config/           # App configuration and feature flags
│   ├── navigation/       # React Navigation setup (auth, tabs, stacks)
│   ├── screens/          # Screen components organized by feature
│   │   ├── auth/         # Authentication and onboarding
│   │   ├── home/         # Patient home tab
│   │   ├── fitness/      # Fitness modules and library
│   │   ├── analytics/    # Analytics and insights
│   │   ├── clinician/    # Clinician portal screens
│   │   └── more/         # Settings and profile
│   ├── components/       # Reusable UI components
│   ├── services/         # Business logic and external integrations
│   │   ├── firebase.ts   # Firebase initialization
│   │   ├── ai.ts         # AI/Coach integration
│   │   ├── health.ts     # HealthKit/Health Connect
│   │   ├── iap.ts        # In-app purchases
│   │   └── notifications.ts
│   ├── store/            # Zustand state management
│   ├── theme/            # Design system (colors, typography, spacing)
│   └── hologram/         # 3D hologram viewer (Android WebView + Three.js)
├── ios/
│   └── WellnessShift/
│       ├── Models/       # USDZ 3D models
│       └── HologramSceneView.swift  # iOS native SceneKit viewer
├── android/
│   └── app/src/main/
│       ├── assets/hologram/  # Bundled hologram viewer
│       └── java/...          # Native Android code
├── functions/            # Firebase Cloud Functions
├── public/               # Firebase Hosting (email verification page)
├── firestore.rules       # Firestore security rules
└── firestore.indexes.json
```

## Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### Making Changes

1. **Write clean, typed code** - This is a TypeScript project
2. **Follow the existing patterns** - Look at similar screens/components
3. **Test on both platforms** - iOS and Android when possible
4. **Update documentation** - If you add features or change behavior

### Code Organization

- **Screens** are in `src/screens/` organized by feature area
- **Reusable components** go in `src/components/`
- **Business logic** goes in `src/services/`
- **State** is managed with Zustand in `src/store/`
- **Navigation** setup is in `src/navigation/`

### Firebase Structure

The app uses Firebase for:
- **Authentication** - Email/password, Apple Sign-In, Google Sign-In
- **Firestore** - User data, care plans, messages, etc.
- **Cloud Functions** - AI proxy, server-side logic
- **Cloud Messaging** - Push notifications
- **Crashlytics** - Error reporting
- **Remote Config** - Feature flags

Main Firestore collections:
- `users` - User profiles, wellness scores, daily plans
- `patients` - Patient-specific data
- `clinicians` - Clinician profiles and practices
- `messageThreads` - In-app messaging
- `connectionRequests` - Patient-clinician linking
- `inviteCodes` - Invite system

## Code Style

### TypeScript

- Use **TypeScript** for all new code
- Prefer **interfaces** over types for object shapes
- Use **explicit return types** for functions
- Avoid `any` - use proper typing

### React/React Native

- Use **functional components** with hooks
- Prefer **named exports** over default exports
- Keep components **focused and small**
- Use **memo** for expensive components
- Follow the **hooks rules** (no conditionals, etc.)

### Naming Conventions

- **Components**: PascalCase (`WellnessScore.tsx`)
- **Files**: camelCase for utilities, PascalCase for components
- **Functions**: camelCase (`calculateWellnessScore`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_SCORE`)
- **Interfaces/Types**: PascalCase with descriptive names

### Styling

- Use the **theme system** from `src/theme/`
- Keep styles **close to components** (bottom of file)
- Use **StyleSheet.create()** for performance
- Follow **mobile design patterns** (thumb zones, etc.)

### Comments

- Write **self-documenting code** when possible
- Add comments for **complex logic** or **non-obvious decisions**
- Document **public APIs** and **interfaces**
- Keep comments **up to date** with code changes

## Testing

### Running Tests

```bash
npm test
```

### Testing Guidelines

- Test **critical user flows** (auth, wellness score, care plans)
- Test **edge cases** and **error states**
- Mock **external services** (Firebase, AI, health APIs)
- Test on **both platforms** when possible

### Manual Testing Checklist

Before submitting:

- [ ] App builds successfully on iOS
- [ ] App builds successfully on Android
- [ ] No TypeScript errors
- [ ] No console warnings/errors
- [ ] Authentication flows work
- [ ] Navigation works correctly
- [ ] UI looks good on different screen sizes
- [ ] Works without network connection (where applicable)
- [ ] Firebase integration works
- [ ] No crashes or performance issues

## Submitting Changes

### Before Submitting

1. **Test your changes** thoroughly
2. **Check for TypeScript errors**: `npx tsc --noEmit`
3. **Run linting**: `npm run lint`
4. **Commit with clear messages**

### Commit Messages

Follow this format:
```
type(scope): brief description

Longer description if needed.
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(fitness): add new meditation module
fix(auth): resolve sign-in crash on iOS
docs: update setup instructions
```

### Pull Request Process

1. **Push your branch** to GitHub
2. **Create a Pull Request** with:
   - Clear title describing the change
   - Description of what changed and why
   - Screenshots/videos for UI changes
   - Testing notes
   - Any breaking changes or migration needed

3. **Address review feedback**
4. **Ensure CI passes**
5. **Squash and merge** when approved

## Questions?

If you have questions or need help:
- Check the [README.md](README.md) for general information
- Look at [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) for system design
- Review existing code for patterns and examples
- Reach out to the team

Thank you for contributing to WellnessShift! 🌟
