# Lumen — a top-down 2D social world

A modern, non-retro Gather-style social world. This repo is the **client scaffold** with Google sign-in already wired up. Multiplayer (Colyseus) and proximity voice (LiveKit) plug in next.

## Stack

- **Vite + React + TypeScript** — app shell
- **Phaser 3** — game canvas (WebGL, smooth, non-pixel-art)
- **Firebase Auth** — Google OAuth sign-in

## What's working

- Google sign-in / sign-out
- Auth-gated game shell — login screen vs. world
- Phaser scene with a tiled floor, atmospheric ambient pools, and a controllable avatar (WASD or arrow keys)
- Smooth camera follow, name tag, soft shadow, no pixel art

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Firebase

1. Go to <https://console.firebase.google.com> and create a project.
2. Add a **Web app** to it. Copy the config values.
3. In the **Authentication** section, enable **Google** as a sign-in provider.
4. Add `localhost` to the authorized domains list (it's there by default in dev).
5. Copy `.env.example` to `.env.local` and paste your config values.

```bash
cp .env.example .env.local
# then edit .env.local
```

### 3. Run

```bash
npm run dev
```

Open <http://localhost:3000>. Sign in with Google, walk around with WASD.

## Project structure

```
src/
├── auth/
│   ├── firebase.ts          # Firebase init + Google provider
│   └── AuthContext.tsx      # React context: user, signIn, logout
├── components/
│   ├── LoginScreen.tsx      # Atmospheric login UI
│   └── GameContainer.tsx    # Mounts Phaser, overlays HUD
├── game/
│   ├── PhaserGame.ts        # Game lifecycle (start/destroy)
│   └── scenes/
│       ├── BootScene.ts     # Generates placeholder textures
│       └── WorldScene.ts    # The world: floor, avatar, camera
└── styles/
    └── index.css            # All styling (no Tailwind yet)
```

## What's next

- [ ] **Phase 2 — Multiplayer movement.** Add a Colyseus server. Define a `WorldRoom` with player schema (id, x, y, name, avatar). Broadcast position; render other players client-side with interpolation.
- [ ] **Phase 3 — Real maps.** Design rooms in [Tiled](https://www.mapeditor.org/), load with `phaser3-tiled-loader`. Add collision layers and interactive objects (whiteboards, sit-down spots, portals).
- [ ] **Phase 4 — Proximity voice.** Integrate [LiveKit](https://livekit.io). When two players are within N tiles, auto-join an audio room. Optional volume falloff with distance.
- [ ] **Phase 5 — Polish.** Custom avatars, room ownership, profile persistence (Firestore), particle effects, lighting, post-processing.

## Notes on the "modern" look

Currently using procedurally drawn placeholder shapes. To go from "scaffold" to "looks like Gather but better":

- Replace placeholder discs with high-res character spritesheets (Kenney's modern packs, Synty 2D, or commission custom).
- Add normal maps to sprites and turn on Phaser's `Light2D` pipeline.
- Add particle systems (footstep dust, ambient sparkles).
- Add a CRT-free post-processing chain: subtle bloom, vignette, color grading.
- Use [Tiled](https://www.mapeditor.org) to design real rooms with detailed tilesets.

## Troubleshooting

- **Sign-in popup blocked.** Browser blocking pop-ups; allow them for localhost or use `signInWithRedirect` instead.
- **`auth/unauthorized-domain`.** Add your domain to Firebase → Authentication → Settings → Authorized domains.
- **Blank screen, no errors.** Check `.env.local` exists and has all four `VITE_FIREBASE_*` values. Restart `npm run dev` after editing env files.
