# NoteCraft Desktop v1.0.0

## Initial Windows Release

NoteCraft Desktop 1.0.0 is the first production Windows release.

### Features

- Windows desktop application (Electron + React 18 + Vite)
- Microphone recording
- Windows system/loopback audio capture (WASAPI)
- Minutes of Meeting (MOM) mode
- Class / Webinar Notes mode
- Speech-to-Text audio transcription pipeline
- AI-generated structured notes
- Formatted DOCX export
- Firebase authentication (Email/Password & Google Sign-In)
- Firestore cloud note history
- Guest / local note history
- Windows NSIS interactive & silent installer

### Requirements

- Windows 10/11 (x64)
- Internet connection for AI processing and cloud sync
- Microphone access for audio capture

### Installer

Windows x64:
- `NoteCraft-Desktop-Setup-1.0.0-x64.exe` (Size: ~86.44 MB)

### Known Limitations

- Unsigned executable (code-signing certificate can be attached in future releases).
- Packaging uses standard application icon until official brand `.ico` asset is committed.
- Auto-update is disabled in v1.0.0; updates must be downloaded manually from GitHub Releases.
