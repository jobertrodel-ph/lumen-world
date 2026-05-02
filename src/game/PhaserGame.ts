import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import WorldScene from './scenes/WorldScene';

export interface PlayerProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
}

let game: Phaser.Game | null = null;

export function startGame(parent: HTMLElement, profile: PlayerProfile) {
  if (game) return game;

  game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    backgroundColor: '#0d0f1a',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: false },
    },
    // We want SMOOTH, not pixel-perfect — this is the modern look.
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    scene: [BootScene, WorldScene],
    callbacks: {
      postBoot: (g) => {
        g.registry.set('profile', profile);
      },
    },
  });

  return game;
}

export function destroyGame() {
  if (game) {
    game.destroy(true);
    game = null;
  }
}
