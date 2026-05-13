/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import { AdminConfig } from './admin.types';
import { Favorite, IStorage, PlayRecord, SkipConfig } from './types';

// storage type 常量: 'localstorage' | 'redis' | 'd1' | 'upstash' | 'kvrocks'，默认 'localstorage'
const STORAGE_TYPE =
  (process.env.NEXT_PUBLIC_STORAGE_TYPE as
    | 'localstorage'
    | 'redis'
    | 'd1'
    | 'upstash'
    | 'kvrocks'
    | undefined) || 'localstorage';

// 创建存储实例（使用动态 import 以兼容 Edge Runtime）
async function createStorageAsync(): Promise<IStorage> {
  switch (STORAGE_TYPE) {
    case 'redis': {
      // @ts-expect-error redis 模块不兼容 Edge Runtime，仅 Node.js 部署可用
      const { RedisStorage } = await import('./redis.db');
      return new RedisStorage();
    }
    case 'upstash': {
      // @ts-expect-error upstash 模块类型声明在 CF Pages 构建中可能不可用
      const { UpstashRedisStorage } = await import('./upstash.db');
      return new UpstashRedisStorage();
    }
    case 'kvrocks': {
      // @ts-expect-error kvrocks 模块依赖 redis npm 包，不兼容 Edge Runtime
      const { KvrocksStorage } = await import('./kvrocks.db');
      return new KvrocksStorage();
    }
    case 'd1': {
      // @ts-expect-error d1 模块类型声明在 CF Pages 构建中可能不可用
      const { D1Storage } = await import('./d1.db');
      return new D1Storage();
    }
    case 'localstorage':
    default:
      return null as unknown as IStorage;
  }
}

// 单例存储实例
let storageInstance: IStorage | null = null;
let storagePromise: Promise<IStorage> | null = null;

function _getStorage(): IStorage {
  if (storageInstance) {
    return storageInstance;
  }
  // 在 Edge Runtime 中，需要异步创建存储实例
  // 返回 null 占位，实际使用时通过 ensureStorage 获取
  if (!storagePromise) {
    storagePromise = createStorageAsync().then((s) => {
      storageInstance = s;
      return s;
    });
  }
  throw new Error('Storage not initialized. Call ensureStorage() first.');
}

/** 异步确保存储已初始化并返回实例 */
async function ensureStorage(): Promise<IStorage> {
  if (storageInstance) {
    return storageInstance;
  }
  if (!storagePromise) {
    storagePromise = createStorageAsync().then((s) => {
      storageInstance = s;
      return s;
    });
  }
  return storagePromise;
}

// 工具函数：生成存储key
export function generateStorageKey(source: string, id: string): string {
  return `${source}+${id}`;
}

// 导出便捷方法
export class DbManager {
  private storage: IStorage | null = null;
  private migrationPromise: Promise<void> | null = null;

  constructor() {
    // 异步初始化存储
    this.initStorage().catch((err) => {
      console.error('Failed to initialize storage:', err);
    });
  }

  private async initStorage(): Promise<void> {
    const storage = await ensureStorage();
    this.storage = storage;
    // 启动时自动触发数据迁移（异步，不阻塞构造）
    if (this.storage && typeof this.storage.migrateData === 'function') {
      this.migrationPromise = this.storage.migrateData().then(async () => {
        // 数据结构迁移完成后，执行密码哈希迁移
        if (typeof this.storage!.migratePasswords === 'function') {
          await this.storage!.migratePasswords();
        }
      }).catch((err) => {
        console.error('数据迁移异常:', err);
      });
    }
  }

  /** 等待存储和迁移完成 */
  private async ensureReady(): Promise<IStorage> {
    if (this.storage) {
      if (this.migrationPromise) {
        await this.migrationPromise;
        this.migrationPromise = null;
      }
      return this.storage;
    }
    await this.initStorage();
    if (this.migrationPromise) {
      await this.migrationPromise;
      this.migrationPromise = null;
    }
    return this.storage!;
  }

  // 播放记录相关方法
  async getPlayRecord(
    userName: string,
    source: string,
    id: string
  ): Promise<PlayRecord | null> {
    const storage = await this.ensureReady();
    const key = generateStorageKey(source, id);
    return storage.getPlayRecord(userName, key);
  }

  async savePlayRecord(
    userName: string,
    source: string,
    id: string,
    record: PlayRecord
  ): Promise<void> {
    const storage = await this.ensureReady();
    const key = generateStorageKey(source, id);
    await storage.setPlayRecord(userName, key, record);
  }

  async getAllPlayRecords(userName: string): Promise<{
    [key: string]: PlayRecord;
  }> {
    const storage = await this.ensureReady();
    return storage.getAllPlayRecords(userName);
  }

  async deletePlayRecord(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    const storage = await this.ensureReady();
    const key = generateStorageKey(source, id);
    await storage.deletePlayRecord(userName, key);
  }

  async deleteAllPlayRecords(userName: string): Promise<void> {
    const storage = await this.ensureReady();
    await storage.deleteAllPlayRecords(userName);
  }

  // 收藏相关方法
  async getFavorite(
    userName: string,
    source: string,
    id: string
  ): Promise<Favorite | null> {
    const storage = await this.ensureReady();
    const key = generateStorageKey(source, id);
    return storage.getFavorite(userName, key);
  }

  async saveFavorite(
    userName: string,
    source: string,
    id: string,
    favorite: Favorite
  ): Promise<void> {
    const storage = await this.ensureReady();
    const key = generateStorageKey(source, id);
    await storage.setFavorite(userName, key, favorite);
  }

  async getAllFavorites(
    userName: string
  ): Promise<{ [key: string]: Favorite }> {
    const storage = await this.ensureReady();
    return storage.getAllFavorites(userName);
  }

  async deleteFavorite(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    const storage = await this.ensureReady();
    const key = generateStorageKey(source, id);
    await storage.deleteFavorite(userName, key);
  }

  async deleteAllFavorites(userName: string): Promise<void> {
    const storage = await this.ensureReady();
    await storage.deleteAllFavorites(userName);
  }

  async isFavorited(
    userName: string,
    source: string,
    id: string
  ): Promise<boolean> {
    const favorite = await this.getFavorite(userName, source, id);
    return favorite !== null;
  }

  // ---------- 用户相关 ----------
  async registerUser(userName: string, password: string): Promise<void> {
    const storage = await this.ensureReady();
    await storage.registerUser(userName, password);
  }

  async verifyUser(userName: string, password: string): Promise<boolean> {
    const storage = await this.ensureReady();
    return storage.verifyUser(userName, password);
  }

  // 检查用户是否已存在
  async checkUserExist(userName: string): Promise<boolean> {
    const storage = await this.ensureReady();
    return storage.checkUserExist(userName);
  }

  async changePassword(userName: string, newPassword: string): Promise<void> {
    const storage = await this.ensureReady();
    await storage.changePassword(userName, newPassword);
  }

  async deleteUser(userName: string): Promise<void> {
    const storage = await this.ensureReady();
    await storage.deleteUser(userName);
  }

  // ---------- 搜索历史 ----------
  async getSearchHistory(userName: string): Promise<string[]> {
    const storage = await this.ensureReady();
    return storage.getSearchHistory(userName);
  }

  async addSearchHistory(userName: string, keyword: string): Promise<void> {
    const storage = await this.ensureReady();
    await storage.addSearchHistory(userName, keyword);
  }

  async deleteSearchHistory(userName: string, keyword?: string): Promise<void> {
    const storage = await this.ensureReady();
    await storage.deleteSearchHistory(userName, keyword);
  }

  // 获取全部用户名
  async getAllUsers(): Promise<string[]> {
    const storage = await this.ensureReady();
    if (typeof (storage as any).getAllUsers === 'function') {
      return (storage as any).getAllUsers();
    }
    return [];
  }

  // ---------- 管理员配置 ----------
  async getAdminConfig(): Promise<AdminConfig | null> {
    const storage = await this.ensureReady();
    if (typeof (storage as any).getAdminConfig === 'function') {
      return (storage as any).getAdminConfig();
    }
    return null;
  }

  async saveAdminConfig(config: AdminConfig): Promise<void> {
    const storage = await this.ensureReady();
    if (typeof (storage as any).setAdminConfig === 'function') {
      await (storage as any).setAdminConfig(config);
    }
  }

  // ---------- 跳过片头片尾配置 ----------
  async getSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<SkipConfig | null> {
    const storage = await this.ensureReady();
    if (typeof (storage as any).getSkipConfig === 'function') {
      return (storage as any).getSkipConfig(userName, source, id);
    }
    return null;
  }

  async setSkipConfig(
    userName: string,
    source: string,
    id: string,
    config: SkipConfig
  ): Promise<void> {
    const storage = await this.ensureReady();
    if (typeof (storage as any).setSkipConfig === 'function') {
      await (storage as any).setSkipConfig(userName, source, id, config);
    }
  }

  async deleteSkipConfig(
    userName: string,
    source: string,
    id: string
  ): Promise<void> {
    const storage = await this.ensureReady();
    if (typeof (storage as any).deleteSkipConfig === 'function') {
      await (storage as any).deleteSkipConfig(userName, source, id);
    }
  }

  async getAllSkipConfigs(
    userName: string
  ): Promise<{ [key: string]: SkipConfig }> {
    const storage = await this.ensureReady();
    if (typeof (storage as any).getAllSkipConfigs === 'function') {
      return (storage as any).getAllSkipConfigs(userName);
    }
    return {};
  }

  // ---------- 数据清理 ----------
  async clearAllData(): Promise<void> {
    const storage = await this.ensureReady();
    if (typeof (storage as any).clearAllData === 'function') {
      await (storage as any).clearAllData();
    } else {
      throw new Error('存储类型不支持清空数据操作');
    }
  }
}

// 导出默认实例
export const db = new DbManager();
