const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { SemanticSearch } = require('./semantic');

class AutoMemoryExtractor {
  constructor() {
    this.patterns = {
      preference: [/喜欢|偏好|更喜欢|倾向于|想要|希望|不要|讨厌/],
      habit: [/经常|总是|通常|一般|习惯|每次|从来不|偶尔/],
      constraint: [/不能|无法|必须|需要|只要|除非|只有/]
    };
  }

  extractFromConversation(messages, options = {}) {
    const userId = options.userId || 'default-user';
    const memories = [];
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    for (let i = 0; i < userMessages.length; i++) {
      const userText = userMessages[i].content || userMessages[i].text || '';
      const assistantText = assistantMessages[i]?.content || assistantMessages[i]?.text || '';

      for (const [type, patternList] of Object.entries(this.patterns)) {
        if (patternList.some(p => p.test(userText))) {
          memories.push({
            user_id: userId,
            type,
            key: `${type}:${userText.substring(0, 20)}`,
            value: { raw: userText },
            source_question: userText,
            context: { answer: assistantText },
            active: true,
            priority: this._calcPriority(userText)
          });
          break;
        }
      }
    }
    return this._deduplicate(memories);
  }

  _calcPriority(text) {
    if ([/必须|不能|绝对|永远/].some(p => p.test(text))) return 'high';
    if ([/可能|也许|大概|偶尔/].some(p => p.test(text))) return 'low';
    return 'medium';
  }

  _deduplicate(memories) {
    const seen = new Map();
    return memories.filter(m => {
      const key = `${m.user_id}:${m.key}`;
      if (seen.has(key)) return false;
      seen.set(key, true);
      return true;
    });
  }
}

class ImportanceScorer {
  constructor() {
    this.weights = { frequency: 0.2, recency: 0.3, emotion: 0.2, specificity: 0.15, feedback: 0.15 };
  }

  calculateScore(memory, options = {}) {
    const scores = {
      frequency: Math.min(1, (memory.access_count || 0) / 10),
      recency: this._recencyScore(memory, options.currentTime),
      emotion: this._emotionScore(memory),
      specificity: this._specificityScore(memory),
      feedback: this._feedbackScore(memory)
    };

    const total = Object.entries(scores).reduce((sum, [k, v]) => sum + v * this.weights[k], 0);
    return { total: Math.min(1, Math.max(0, total)), priority: total > 0.7 ? 'high' : total > 0.4 ? 'medium' : 'low' };
  }

  _recencyScore(memory, currentTime) {
    const time = Math.max(new Date(memory.created_at).getTime(), new Date(memory.updated_at || memory.created_at).getTime());
    const ageInDays = ((currentTime || Date.now()) - time) / (1000 * 60 * 60 * 24);
    if (ageInDays < 1) return 1; if (ageInDays < 7) return 0.8; if (ageInDays < 30) return 0.5;
    if (ageInDays < 90) return 0.3; return 0.1;
  }

  _emotionScore(memory) {
    const emotionalWords = ['喜欢', '讨厌', '希望', '必须', '绝对', '重要', '关键'];
    const text = memory.key + ' ' + JSON.stringify(memory.value);
    return Math.min(1, emotionalWords.filter(w => text.includes(w)).length * 0.2);
  }

  _specificityScore(memory) {
    let score = 0;
    if (memory.key && !memory.key.includes('unknown')) score += 0.3;
    if (memory.value) score += 0.3;
    if (memory.source_question) score += 0.4;
    return score;
  }

  _feedbackScore(memory) {
    const positive = memory.positive_feedback || 0;
    const negative = memory.negative_feedback || 0;
    if (positive + negative === 0) return 0.5;
    return ((positive - negative) / (positive + negative) + 1) / 2;
  }
}

class SmartForgetter {
  constructor(options = {}) {
    this.scorer = new ImportanceScorer();
    this.baseDecayRate = options.baseDecayRate || 0.05;
    this.minImportance = options.minImportance || 0.15;
  }

  evaluate(memories, options = {}) {
    const currentTime = options.currentTime || Date.now();
    const result = { keep: [], review: [], forget: [] };

    for (const memory of memories) {
      const importance = this.scorer.calculateScore(memory, { currentTime });
      const ageInDays = (currentTime - new Date(memory.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const retentionScore = importance.total * Math.pow(1 - this.baseDecayRate, ageInDays);

      if (retentionScore < this.minImportance || ageInDays > 90) result.forget.push({ memory, retentionScore });
      else if (retentionScore < 0.4) result.review.push({ memory, retentionScore });
      else result.keep.push({ memory, retentionScore });
    }
    return result;
  }

  cleanup(memories, options = {}) {
    const ev = this.evaluate(memories, options);
    return {
      toDelete: ev.forget.map(f => f.memory.id),
      toReview: ev.review.map(r => r.memory.id),
      summary: { total: memories.length, keep: ev.keep.length, review: ev.review.length, forget: ev.forget.length }
    };
  }
}

class MemoryStore {
  constructor(options = {}) {
    this.storePath = options.path || path.resolve(__dirname, 'memory-store.json');
    this.semanticSearch = options.disableVector ? null : new SemanticSearch({
      vectorStore: { persistDirectory: path.resolve(__dirname, '../data') },
      similarityThreshold: options.similarityThreshold || 0.1
    });
    this.extractor = options.disableAutoExtract ? null : new AutoMemoryExtractor();
    this.scorer = new ImportanceScorer();
    this.forgetter = new SmartForgetter();
    this._load();
  }

  _load() {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(this.storePath)) {
        this.memories = JSON.parse(fs.readFileSync(this.storePath, 'utf-8')).memories || [];
        return;
      }
    } catch (e) { console.error('MemoryStore: 载入失败', e.message); }
    this.memories = [];
  }

  _save() {
    fs.writeFileSync(this.storePath, JSON.stringify({ memories: this.memories }, null, 2), 'utf-8');
  }

  addMemory(memoryEntry) {
    const entry = {
      id: memoryEntry.id || uuidv4(),
      user_id: memoryEntry.user_id || 'default-user',
      type: memoryEntry.type || 'unknown',
      key: memoryEntry.key,
      value: memoryEntry.value,
      source_question: memoryEntry.source_question,
      context: memoryEntry.context,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: memoryEntry.expires_at || null,
      active: memoryEntry.active !== false,
      priority: memoryEntry.priority || 'medium',
      version: memoryEntry.version || '1.0.0',
      superseded_by: null,
      meta: memoryEntry.meta || {}
    };
    this.memories.push(entry);
    this._save();
    return entry;
  }

  getMemoriesForUser(userId, options = {}) {
    let list = this.memories.filter(m => m.user_id === (userId || 'default-user'));
    if (options.type) list = list.filter(m => m.type === options.type);
    if (options.key) list = list.filter(m => m.key === options.key);
    if (options.activeOnly) list = list.filter(m => m.active !== false);
    return list;
  }

  listMemories(userId) { return this.getMemoriesForUser(userId); }

  getActiveMemoryForKey(userId, key) {
    const list = this.getMemoriesForUser(userId, { key, activeOnly: true });
    return list.length ? list[0] : null;
  }

  updateMemory(id, updates) {
    const idx = this.memories.findIndex(m => m.id === id);
    if (idx >= 0) {
      this.memories[idx] = { ...this.memories[idx], ...updates, updated_at: new Date().toISOString() };
      this._save();
      return this.memories[idx];
    }
    return null;
  }

  deleteMemory(id) {
    const idx = this.memories.findIndex(m => m.id === id);
    if (idx >= 0) {
      const [del] = this.memories.splice(idx, 1);
      this._save();
      return del;
    }
    return null;
  }

  purgeExpired() {
    const now = Date.now();
    const before = this.memories.length;
    this.memories = this.memories.filter(m => {
      if (!m.expires_at) return true;
      const exp = new Date(m.expires_at).getTime();
      return isNaN(exp) || exp > now;
    });
    this._save();
    return before - this.memories.length;
  }

  consolidateMemories(userId, key) {
    const list = this.getMemoriesForUser(userId, { key, activeOnly: true });
    if (list.length <= 1) return { merged: null, count: 0 };

    const priorityValue = p => (p === 'high' ? 3 : p === 'medium' ? 2 : p === 'low' ? 1 : 0);
    const sorted = [...list].sort((a, b) => {
      const pa = priorityValue(a.priority), pb = priorityValue(b.priority);
      if (pb !== pa) return pb - pa;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    const winner = sorted[0];
    sorted.slice(1).forEach(s => { s.active = false; s.superseded_by = winner.id; s.updated_at = new Date().toISOString(); });
    this._save();
    return { merged: winner, superseded: sorted.slice(1).map(s => s.id), count: sorted.length - 1 };
  }

  exportMemories(format = 'json') {
    if (format === 'json') return JSON.stringify({ memories: this.memories }, null, 2);
    if (format === 'csv') {
      const header = ['id', 'user_id', 'type', 'key', 'value', 'created_at', 'active', 'priority'];
      const lines = [header.join(',')];
      for (const m of this.memories) {
        const val = typeof m.value === 'object' ? JSON.stringify(m.value) : String(m.value ?? '');
        lines.push([m.id, m.user_id, m.type, m.key, `"${val}"`, m.created_at, m.active, m.priority].join(','));
      }
      return lines.join('\n');
    }
    return null;
  }

  async initializeVectorStore() {
    if (this.semanticSearch) await this.semanticSearch.initialize();
  }

  async addMemoryWithVector(memoryEntry) {
    const entry = this.addMemory(memoryEntry);
    if (this.semanticSearch && entry) {
      try {
        await this.semanticSearch.addDocument({ content: entry.key + ': ' + JSON.stringify(entry.value), ...entry }, { id: entry.id });
      } catch (e) { console.error('[MemoryStore] 向量存储失败:', e.message); }
    }
    return entry;
  }

  async semanticSearchMemories(query, options = {}) {
    if (!this.semanticSearch) return [];
    try {
      await this.initializeVectorStore();
      const results = await this.semanticSearch.search(query, options);
      return results.map(r => {
        const memory = this.memories.find(m => m.id === r.id);
        return memory ? { ...memory, score: r.score } : null;
      }).filter(Boolean);
    } catch (e) { console.error('[MemoryStore] 语义搜索失败:', e.message); return []; }
  }

  extractMemoriesFromConversation(messages, options = {}) {
    if (!this.extractor) return [];
    const extracted = this.extractor.extractFromConversation(messages, options);
    return extracted.map(mem => {
      const existing = this.getActiveMemoryForKey(mem.user_id, mem.key);
      return existing ? { ...existing, already_exists: true } : this.addMemory(mem);
    }).filter(m => !m.already_exists);
  }

  async autoLearnFromConversation(messages, options = {}) {
    const userId = options.userId || 'default-user';
    const extracted = this.extractMemoriesFromConversation(messages, { userId });
    const added = [];
    for (const mem of extracted) {
      const entry = await this.addMemoryWithVector(mem);
      if (entry) added.push(entry);
    }
    return added;
  }

  getMemoryImportance(memoryId) {
    const memory = this.memories.find(m => m.id === memoryId);
    return memory ? this.scorer.calculateScore(memory) : null;
  }

  updateMemoryImportance(memoryId, isPositive) {
    const memory = this.memories.find(m => m.id === memoryId);
    if (!memory) return null;
    if (isPositive) memory.positive_feedback = (memory.positive_feedback || 0) + 1;
    else memory.negative_feedback = (memory.negative_feedback || 0) + 1;
    memory.updated_at = new Date().toISOString();
    this._save();
    return memory;
  }

  smartForget(options = {}) {
    const userId = options.userId;
    let memories = userId ? this.getMemoriesForUser(userId) : this.memories;
    if (options.type) memories = memories.filter(m => m.type === options.type);
    const cleanup = this.forgetter.cleanup(memories, options);
    for (const id of cleanup.toDelete) this.deleteMemory(id);
    return cleanup;
  }

  getMemoriesToReview(userId, options = {}) {
    const memories = this.getMemoriesForUser(userId, { activeOnly: true });
    return this.forgetter.evaluate(memories, options).review;
  }
}

module.exports = MemoryStore;
