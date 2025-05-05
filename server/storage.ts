import { 
  users, 
  audioTracks, 
  type User, 
  type InsertUser, 
  type AudioTrack, 
  type InsertAudioTrack, 
  type UpdateAudioTrack
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAudioTrack(id: number): Promise<AudioTrack | undefined>;
  createAudioTrack(track: InsertAudioTrack): Promise<AudioTrack>;
  updateAudioTrack(id: number, update: UpdateAudioTrack): Promise<AudioTrack | undefined>;
  getAudioTracksByUserId(userId: number): Promise<AudioTrack[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private tracks: Map<number, AudioTrack>;
  private userIdCounter: number;
  private trackIdCounter: number;

  constructor() {
    this.users = new Map();
    this.tracks = new Map();
    this.userIdCounter = 1;
    this.trackIdCounter = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getAudioTrack(id: number): Promise<AudioTrack | undefined> {
    return this.tracks.get(id);
  }

  async createAudioTrack(track: InsertAudioTrack): Promise<AudioTrack> {
    const id = this.trackIdCounter++;
    const newTrack: AudioTrack = { 
      ...track, 
      id, 
      extendedPath: null,
      duration: null,
      extendedDuration: null,
      bpm: null,
      key: null,
      format: null,
      bitrate: null,
      status: "uploaded",
      settings: null
    };
    this.tracks.set(id, newTrack);
    return newTrack;
  }

  async updateAudioTrack(id: number, update: UpdateAudioTrack): Promise<AudioTrack | undefined> {
    const track = this.tracks.get(id);
    if (!track) return undefined;

    const updatedTrack = { ...track, ...update };
    this.tracks.set(id, updatedTrack);
    return updatedTrack;
  }

  async getAudioTracksByUserId(userId: number): Promise<AudioTrack[]> {
    return Array.from(this.tracks.values()).filter(
      (track) => track.userId === userId
    );
  }
}

export const storage = new MemStorage();
