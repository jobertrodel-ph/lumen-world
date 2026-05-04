import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Track,
  LocalAudioTrack,
  createLocalAudioTrack,
  ConnectionState,
} from 'livekit-client';

export interface VoicePeer {
  uid: string;
  /** Effective gain 0..1; 0 = inaudible. */
  gain: number;
  /** Whether they're actively speaking right now. Used for visual indicator. */
  speaking: boolean;
}

export interface VoiceHandlers {
  /** Called whenever the speaking state of any participant changes. */
  onSpeakingChange: (uid: string, speaking: boolean) => void;
  onError: (message: string) => void;
}

interface ConnectOptions {
  serverUrl: string;
  token: string;
  handlers: VoiceHandlers;
}

/**
 * VoiceManager owns the LiveKit connection. The game loop calls
 * setAudibility(uid, gain) to control whether each remote participant
 * is heard, and at what volume.
 *
 * Audio elements are created per-track and routed through the WebAudio
 * graph for smooth gain control. Setting gain to 0 effectively mutes
 * the participant without disrupting the underlying subscription.
 */
export class VoiceManager {
  private room: Room | null = null;
  private localTrack: LocalAudioTrack | null = null;
  private handlers: VoiceHandlers | null = null;

  /** Map of remote LiveKit identity (= Firebase uid) -> audio element. */
  private audioElements = new Map<string, HTMLAudioElement>();
  /** Map of remote uid -> last-set gain. */
  private gainByUid = new Map<string, number>();
  /** Whether the local mic is currently muted. */
  private micEnabled = false;

  async connect({ serverUrl, token, handlers }: ConnectOptions): Promise<void> {
    this.handlers = handlers;
    this.room = new Room({
      adaptiveStream: false,
      dynacast: false,
    });

    this.room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed);
    this.room.on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed);
    this.room.on(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnected);
    this.room.on(RoomEvent.ActiveSpeakersChanged, this.onActiveSpeakersChanged);

    try {
      await this.room.connect(serverUrl, token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'voice connect failed';
      handlers.onError(msg);
      throw err;
    }
  }

  /**
   * Toggle the local microphone. First call requests browser mic permission.
   * Returns the new state (true = mic on).
   */
  async setMicEnabled(enabled: boolean): Promise<boolean> {
    if (!this.room) return false;

    if (enabled && !this.localTrack) {
      try {
        this.localTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        await this.room.localParticipant.publishTrack(this.localTrack);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'mic permission denied';
        this.handlers?.onError(msg);
        return false;
      }
    }

    if (this.localTrack) {
      if (enabled) {
        await this.localTrack.unmute();
      } else {
        await this.localTrack.mute();
      }
    }

    this.micEnabled = enabled;
    return enabled;
  }

  isMicEnabled(): boolean {
    return this.micEnabled;
  }

  /**
   * Set the audible gain for a remote participant. 0 = silent, 1 = full volume.
   * Called every audibility tick from the game loop.
   */
  setAudibility(uid: string, gain: number): void {
    const clamped = Math.max(0, Math.min(1, gain));
    const prev = this.gainByUid.get(uid);
    if (prev === clamped) return;
    this.gainByUid.set(uid, clamped);

    const el = this.audioElements.get(uid);
    if (el) {
      el.volume = clamped;
      // Pausing avoids browser doing audio decode work when fully muted.
      if (clamped === 0 && !el.paused) {
        el.pause();
      } else if (clamped > 0 && el.paused) {
        el.play().catch(() => { /* tab not focused, etc. */ });
      }
    }
  }

  disconnect(): void {
    for (const el of this.audioElements.values()) {
      el.pause();
      el.srcObject = null;
      el.remove();
    }
    this.audioElements.clear();
    this.gainByUid.clear();
    this.localTrack?.stop();
    this.localTrack = null;
    this.room?.disconnect();
    this.room = null;
    this.handlers = null;
  }

  isConnected(): boolean {
    return this.room?.state === ConnectionState.Connected;
  }

  // --- Event handlers ---

  private onTrackSubscribed = (
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    if (track.kind !== Track.Kind.Audio) return;

    const uid = participant.identity;
    const el = track.attach() as HTMLAudioElement;
    el.style.display = 'none';
    document.body.appendChild(el);

    // Default to silent — gain is set by the game loop's audibility tick.
    el.volume = 0;
    el.pause();

    this.audioElements.set(uid, el);
    // If we already had a gain set for this uid (reconnect), apply it.
    const previousGain = this.gainByUid.get(uid);
    if (previousGain !== undefined) {
      this.setAudibility(uid, previousGain);
    }
  };

  private onTrackUnsubscribed = (
    track: RemoteTrack,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ) => {
    if (track.kind !== Track.Kind.Audio) return;
    const uid = participant.identity;
    const el = this.audioElements.get(uid);
    if (el) {
      el.pause();
      el.srcObject = null;
      el.remove();
      this.audioElements.delete(uid);
    }
    track.detach();
  };

  private onParticipantDisconnected = (participant: RemoteParticipant) => {
    const uid = participant.identity;
    this.gainByUid.delete(uid);
    const el = this.audioElements.get(uid);
    if (el) {
      el.pause();
      el.remove();
      this.audioElements.delete(uid);
    }
    this.handlers?.onSpeakingChange(uid, false);
  };

  private onActiveSpeakersChanged = (speakers: Array<{ identity: string }>) => {
    const speakingNow = new Set(speakers.map((s) => s.identity));
    // Diff against last state. Simplest: notify all known peers.
    for (const uid of this.audioElements.keys()) {
      this.handlers?.onSpeakingChange(uid, speakingNow.has(uid));
    }
  };
}
