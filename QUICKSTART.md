# WellnessShift - Quick Start Guide

Get WellnessShift running on your machine in minutes! ⚡

## Prerequisites

Install these first:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/)

### For iOS Development (macOS only)
- **Xcode 16+** - [Download from Mac App Store](https://apps.apple.com/us/app/xcode/id497799835)
- **CocoaPods** - Run: `sudo gem install cocoapods`

### For Android Development
- **Android Studio** - [Download here](https://developer.android.com/studio)
- **Java JDK 17+** - Included with Android Studio

## Quick Setup (5 minutes)

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/afrasnizam1/WellnessShiftRNMobileApp.git
cd WellnessShiftRNMobileApp

# Install dependencies
npm install --legacy-peer-deps
```

### 2. Platform Setup

#### For iOS (macOS only)
```bash
cd ios
pod install
cd ..
```

#### For Android
Android setup is automatic when you first build. Just make sure Android Studio is installed.

### 3. Run the App

```bash
# Start Metro bundler
npm start
```

In a new terminal:

```bash
# For iOS
npm run ios

# OR for Android
npm run android
```

That's it! 🎉 The app should now be running on your simulator/emulator.

## Common Commands

```bash
# Start Metro bundler
npm start

# Run on specific iOS simulator
npx react-native run-ios --simulator "iPhone 17 Pro"

# Run on connected Android device
npm run android

# Clean and rebuild iOS
cd ios && pod install && cd ..
xcodebuild -workspace ios/WellnessShift.xcworkspace -scheme WellnessShift clean

# Clean and rebuild Android
cd android && ./gradlew clean && cd ..
npm run android

# Bundle Android hologram viewer (if you changed it)
npm run bundle:hologram

# Reset Metro cache
npm start -- --reset-cache
```

## Troubleshooting

### iOS Build Fails
```bash
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

### Android Build Fails
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Metro Bundler Issues
```bash
npm start -- --reset-cache
```

### "command not found: pod" (macOS)
```bash
sudo gem install cocoapods
```

### Android Emulator Not Starting
1. Open Android Studio
2. Go to Tools → Device Manager
3. Create a new virtual device
4. Start the emulator
5. Run `npm run android`

## Project Structure at a Glance

```
WellnessShift/
├── src/
│   ├── screens/         # All app screens
│   ├── components/      # Reusable UI components
│   ├── navigation/      # Navigation setup
│   ├── services/        # Business logic
│   ├── store/           # State management
│   └── theme/           # Colors, fonts, spacing
├── ios/                 # iOS native code
├── android/             # Android native code
├── functions/           # Firebase Cloud Functions
└── App.tsx             # App entry point
```

## Key Features to Explore

### Patient App
- **Home** - Wellness score, daily plans, check-ins
- **Fitness** - Workouts, nutrition, 3D anatomy holograms
- **Coach** - AI wellness guidance
- **Analytics** - Progress tracking
- **My Care** - Clinician-assigned tasks

### Clinician Portal
- **Dashboard** - Practice overview
- **Patients** - Patient management
- **Care** - Care plan creation
- **Inbox** - Patient messages

## Development Workflow

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make your changes**
   - Follow TypeScript patterns
   - Use the theme system
   - Test on both platforms

3. **Commit & Push**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature
   ```

4. **Create Pull Request**
   - Go to GitHub
   - Click "New Pull Request"
   - Add description and screenshots

## Optional Configuration

### Google Sign-In (Optional)
Create `src/config/googleAuth.local.ts`:
```typescript
export const GOOGLE_WEB_CLIENT_ID = 'your-web-client-id';
```
Without this, Google Sign-In button is hidden but app works fine.

### Firebase (Already Configured)
Firebase config files are already included:
- iOS: `ios/WellnessShift/GoogleService-Info.plist`
- Android: `android/app/google-services.json`

## Need More Help?

- 📖 **Full Setup**: See [README.md](README.md)
- 👥 **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)
- 🏗️ **Architecture**: See [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md)
- 📊 **Project Status**: See [PROJECT_STATUS.md](PROJECT_STATUS.md)

## Test Your Setup

Run these to verify everything works:

```bash
# Check TypeScript
npx tsc --noEmit

# Run linting
npm run lint

# Run tests
npm test
```

If all pass, you're good to go! ✅

## What's Next?

1. Explore the codebase
2. Pick an issue or feature to work on
3. Make your changes
4. Test thoroughly
5. Submit a pull request

Happy coding! 🚀

---

**Quick Links**
- [GitHub Repository](https://github.com/afrasnizam1/WellnessShiftRNMobileApp)
- [Firebase Console](https://console.firebase.google.com/project/wellnessshift-rn-ios)
- [Website](https://wellnesshift.co.uk)
