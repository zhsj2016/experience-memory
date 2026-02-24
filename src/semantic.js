class StopWords {
  constructor() {
    this.words = new Set([
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
      '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
      '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么', '怎么',
      '如何', '为什么', '哪', '哪个', '哪里', '多少', '几', '可以', '能', '能够',
      '应该', '需要', '想', '想要', '希望', '让', '把', '被', '给', '跟', '和',
      '与', '及', '或', '但', '但是', '然而', '所以', '因此', '因为', '如果',
      '虽然', '而', '而且', '并且', '或者', '还是', '只是', '不过', '然后',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
      'into', 'through', 'during', 'before', 'after', 'above', 'below',
      'between', 'under', 'again', 'further', 'then', 'once', 'here',
      'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few',
      'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
      'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
      'and', 'or', 'but', 'if', 'because', 'while', 'although', 'though'
    ]);
  }

  isStopWord(word) {
    return this.words.has(word.toLowerCase());
  }
}

class EmbeddingService {
  constructor(options = {}) {
    this.modelName = options.modelName || 'local-tfidf';
    this.vocabulary = new Map();
    this.idf = new Map();
    this.stopWords = new StopWords();
    this.initialized = false;
    this.embeddingDim = options.embeddingDim || 768;
  }

  async initialize() {
    if (this.initialized) return;
    console.log('[EmbeddingService] 初始化本地向量化服务（中文优化）');
    this.initialized = true;
  }

  tokenize(text) {
    const tokens = [];
    const normalized = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const words = normalized.split(' ').filter(w => w.length > 0);
    
    for (const word of words) {
      if (!this.stopWords.isStopWord(word) && word.length > 1) {
        tokens.push(word);
        if (/[\u4e00-\u9fa5]/.test(word)) {
          for (let len = 2; len <= Math.min(word.length, 4); len++) {
            for (let i = 0; i <= word.length - len; i++) {
              const ngram = word.substring(i, i + len);
              if (!this.stopWords.isStopWord(ngram)) tokens.push(ngram);
            }
          }
        }
      }
    }
    return [...new Set(tokens)];
  }

  buildVocabulary(documents) {
    const docCount = documents.length;
    const df = new Map();

    documents.forEach(doc => {
      const text = typeof doc === 'string' ? doc : (doc.content || doc.text || JSON.stringify(doc));
      const tokens = this.tokenize(text);
      [...new Set(tokens)].forEach(token => {
        df.set(token, (df.get(token) || 0) + 1);
      });
    });

    df.forEach((count, token) => {
      if (!this.idf.has(token)) {
        this.idf.set(token, Math.log(docCount / count + 1));
      }
    });

    this.idf.forEach((_, token) => {
      if (!this.vocabulary.has(token)) {
        this.vocabulary.set(token, this.vocabulary.size);
      }
    });
  }

  transform(text) {
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return new Array(this.embeddingDim).fill(0);
    
    const tf = new Map();
    tokens.forEach(token => tf.set(token, (tf.get(token) || 0) + 1));

    const vector = new Array(this.embeddingDim).fill(0);
    
    tf.forEach((count, token) => {
      const tfValue = count / tokens.length;
      const idfValue = this.idf.get(token) || 0.5;
      const weight = tfValue * idfValue;
      const hashIdx = this.hash(token) % this.embeddingDim;
      vector[hashIdx] += weight;
    });

    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) for (let i = 0; i < vector.length; i++) vector[i] /= norm;

    return vector;
  }

  hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  async embed(texts) {
    await this.initialize();
    const textList = Array.isArray(texts) ? texts : [texts];
    if (textList.length > 1 || this.vocabulary.size === 0) this.buildVocabulary(textList);
    const embeddings = textList.map(text => this.transform(text));
    return textList.length === 1 ? embeddings[0] : embeddings;
  }

  async embedQuery(query) { return this.embed(query); }
  async embedDocuments(documents) {
    return this.embed(documents.map(doc => typeof doc === 'string' ? doc : (doc.content || doc.text || JSON.stringify(doc))));
  }
}

class VectorStore {
  constructor(options = {}) {
    this.persistPath = options.persistPath || require('path').resolve(__dirname, '../data/vectors.json');
    this.vectors = [];
    this.initialized = false;
  }

  async initialize() {
    this._load();
    console.log('[VectorStore] 初始化完成');
  }

  _load() {
    try {
      const fs = require('fs');
      const dir = require('path').dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(this.persistPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
        this.vectors = data.vectors || [];
      }
    } catch (e) { this.vectors = []; }
  }

  _save() {
    require('fs').writeFileSync(this.persistPath, JSON.stringify({ vectors: this.vectors }, null, 2), 'utf-8');
  }

  async addVectors(vectors, documents, options = {}) {
    const ids = options.ids || vectors.map((_, i) => `doc_${Date.now()}_${i}`);
    vectors.forEach((vec, i) => {
      this.vectors.push({ id: ids[i], vector: vec, document: documents[i], metadata: options.metadatas?.[i] || {} });
    });
    this._save();
    return ids;
  }

  async search(queryVector, options = {}) {
    const limit = options.limit || 5;
    const results = this.vectors.map(item => ({
      id: item.id,
      content: item.document,
      distance: 1 - this._cosineSimilarity(queryVector, item.vector),
      metadata: item.metadata
    }));
    results.sort((a, b) => a.distance - b.distance);
    return results.slice(0, limit);
  }

  _cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length || vec1.length === 0) return 0;
    let dotProduct = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    return norm1 === 0 || norm2 === 0 ? 0 : dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  async deleteById(ids) {
    const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
    this.vectors = this.vectors.filter(v => !idSet.has(v.id));
    this._save();
  }

  async deleteAll() { this.vectors = []; this._save(); }
  async count() { return this.vectors.length; }
}

class SemanticSearch {
  constructor(options = {}) {
    this.embeddingService = new EmbeddingService(options.embedding);
    this.vectorStore = new VectorStore(options.vectorStore);
    this.similarityThreshold = options.similarityThreshold || 0.1;
  }

  async initialize() {
    await this.vectorStore.initialize();
    console.log('[SemanticSearch] 初始化完成');
  }

  async addDocument(doc, options = {}) {
    const text = doc.content || doc.text || JSON.stringify(doc);
    const vector = await this.embeddingService.embed(text);
    const id = options.id || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await this.vectorStore.addVectors([vector], [text], { ids: [id], metadatas: [{ ...doc, id }] });
    return id;
  }

  async search(query, options = {}) {
    const queryVector = await this.embeddingService.embedQuery(query);
    const results = await this.vectorStore.search(queryVector, { limit: options.limit || 5 });
    return results.filter(r => (1 - r.distance) >= this.similarityThreshold)
      .map(r => ({ id: r.id, content: r.content, score: 1 - r.distance, metadata: r.metadata }));
  }

  async deleteDocument(id) { await this.vectorStore.deleteById(id); }
  async deleteAll() { await this.vectorStore.deleteAll(); }
  async count() { return await this.vectorStore.count(); }
}

module.exports = { EmbeddingService, VectorStore, SemanticSearch };
