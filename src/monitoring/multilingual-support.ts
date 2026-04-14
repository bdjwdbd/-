/**
 * 多语言支持模块
 * 
 * 功能：
 * 1. 语言检测
 * 2. 多语言响应
 * 3. 翻译接口
 * 4. 语言偏好管理
 */

// ============================================================
// 类型定义
// ============================================================

type Language = 'zh' | 'en' | 'auto';

interface LanguageConfig {
  defaultLanguage: Language;
  supportedLanguages: Language[];
  autoDetect: boolean;
  fallbackLanguage: Language;
}

interface LanguageDetectionResult {
  language: Language;
  confidence: number;
  isMixed: boolean;
}

interface MultilingualResponse {
  original: string;
  language: Language;
  translations: Map<Language, string>;
}

// ============================================================
// 语言检测器
// ============================================================

export class LanguageDetector {
  private config: LanguageConfig;

  constructor(config?: Partial<LanguageConfig>) {
    this.config = {
      defaultLanguage: 'zh',
      supportedLanguages: ['zh', 'en'],
      autoDetect: true,
      fallbackLanguage: 'zh',
      ...config,
    };
  }

  /**
   * 检测语言
   */
  detect(text: string): LanguageDetectionResult {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = chineseChars + englishChars;

    if (totalChars === 0) {
      return { language: this.config.fallbackLanguage, confidence: 0, isMixed: false };
    }

    const chineseRatio = chineseChars / totalChars;
    const englishRatio = englishChars / totalChars;

    // 判断是否混合
    const isMixed = chineseRatio > 0.2 && englishRatio > 0.2;

    // 判断主要语言
    let language: Language;
    let confidence: number;

    if (chineseRatio > englishRatio) {
      language = 'zh';
      confidence = chineseRatio;
    } else {
      language = 'en';
      confidence = englishRatio;
    }

    return { language, confidence, isMixed };
  }

  /**
   * 批量检测
   */
  batchDetect(texts: string[]): LanguageDetectionResult[] {
    return texts.map(text => this.detect(text));
  }

  /**
   * 获取主要语言
   */
  getPrimaryLanguage(texts: string[]): Language {
    const results = this.batchDetect(texts);
    const counts: Record<string, number> = { zh: 0, en: 0 };

    for (const result of results) {
      if (result.language !== 'auto') {
        counts[result.language]++;
      }
    }

    return counts.zh > counts.en ? 'zh' : 'en';
  }
}

// ============================================================
// 多语言响应生成器
// ============================================================

export class MultilingualResponder {
  private detector: LanguageDetector;
  private responseTemplates: Map<string, Map<Language, string>>;

  constructor() {
    this.detector = new LanguageDetector();
    this.responseTemplates = new Map();
    this.initTemplates();
  }

  /**
   * 初始化响应模板
   */
  private initTemplates(): void {
    const templates = [
      // 问候
      { key: 'greeting', zh: '你好！有什么可以帮助你的吗？', en: 'Hello! How can I help you?' },
      { key: 'greeting_formal', zh: '您好！有什么可以帮助您的吗？', en: 'Hello! How may I assist you?' },
      // 确认
      { key: 'confirm', zh: '好的，明白了。', en: 'Got it, understood.' },
      { key: 'ok', zh: '好的，没问题。', en: 'OK, no problem.' },
      // 感谢
      { key: 'thanks', zh: '不客气！', en: "You're welcome!" },
      { key: 'thanks_formal', zh: '不用谢，很高兴能帮到您。', en: "You're welcome, glad to help." },
      // 告别
      { key: 'goodbye', zh: '再见！有需要随时找我。', en: 'Goodbye! Feel free to reach out anytime.' },
      { key: 'bye', zh: '拜拜！', en: 'Bye!' },
      // 错误
      { key: 'error', zh: '抱歉，出了点问题。请稍后再试。', en: 'Sorry, something went wrong. Please try again later.' },
      { key: 'not_understood', zh: '抱歉，我没太理解。能再说清楚一点吗？', en: "Sorry, I didn't quite understand. Could you clarify?" },
      // 状态
      { key: 'status', zh: '在的！有什么可以帮助你的吗？', en: "I'm here! How can I help you?" },
      { key: 'thinking', zh: '让我想想...', en: 'Let me think...' },
      { key: 'processing', zh: '正在处理...', en: 'Processing...' },
      // 完成
      { key: 'done', zh: '完成了！', en: 'Done!' },
      { key: 'success', zh: '操作成功！', en: 'Operation successful!' },
    ];

    for (const template of templates) {
      const langMap = new Map<Language, string>();
      langMap.set('zh', template.zh);
      langMap.set('en', template.en);
      this.responseTemplates.set(template.key, langMap);
    }
  }

  /**
   * 获取响应
   */
  getResponse(key: string, language?: Language): string {
    const template = this.responseTemplates.get(key);
    if (!template) {
      return this.responseTemplates.get('error')?.get(language || 'zh') || 'Error';
    }
    return template.get(language || 'zh') || template.get('en') || '';
  }

  /**
   * 智能响应（根据输入语言自动选择）
   */
  smartResponse(key: string, inputText: string): string {
    const detection = this.detector.detect(inputText);
    return this.getResponse(key, detection.language);
  }

  /**
   * 生成双语响应
   */
  generateBilingual(key: string): { zh: string; en: string } {
    const template = this.responseTemplates.get(key);
    if (!template) {
      return { zh: '错误', en: 'Error' };
    }
    return {
      zh: template.get('zh') || '',
      en: template.get('en') || '',
    };
  }

  /**
   * 添加自定义模板
   */
  addTemplate(key: string, zh: string, en: string): void {
    const langMap = new Map<Language, string>();
    langMap.set('zh', zh);
    langMap.set('en', en);
    this.responseTemplates.set(key, langMap);
  }
}

// ============================================================
// 翻译接口
// ============================================================

export class Translator {
  private detector: LanguageDetector;

  constructor() {
    this.detector = new LanguageDetector();
  }

  /**
   * 简单翻译（基于规则）
   */
  simpleTranslate(text: string, targetLang: Language): string {
    const sourceLang = this.detector.detect(text).language;

    if (sourceLang === targetLang) {
      return text;
    }

    // 简单词汇映射
    const wordMap: Record<string, Record<string, string>> = {
      '你好': { en: 'Hello' },
      '谢谢': { en: 'Thank you' },
      '再见': { en: 'Goodbye' },
      '是': { en: 'Yes' },
      '不是': { en: 'No' },
      '好的': { en: 'OK' },
      'Hello': { zh: '你好' },
      'Thank you': { zh: '谢谢' },
      'Goodbye': { zh: '再见' },
      'Yes': { zh: '是' },
      'No': { zh: '不是' },
      'OK': { zh: '好的' },
    };

    // 查找匹配
    for (const [word, translations] of Object.entries(wordMap)) {
      if (text.includes(word) && translations[targetLang]) {
        return text.replace(word, translations[targetLang]);
      }
    }

    // 无匹配时返回原文
    return text;
  }

  /**
   * 检测并翻译
   */
  detectAndTranslate(text: string, targetLang?: Language): { original: string; translated: string; sourceLang: Language } {
    const detection = this.detector.detect(text);
    const target = targetLang || (detection.language === 'zh' ? 'en' : 'zh');

    return {
      original: text,
      translated: this.simpleTranslate(text, target),
      sourceLang: detection.language,
    };
  }
}

// ============================================================
// 语言偏好管理器
// ============================================================

export class LanguagePreferenceManager {
  private preferences: Map<string, Language> = new Map();
  private defaultLanguage: Language = 'zh';

  /**
   * 设置用户语言偏好
   */
  setPreference(userId: string, language: Language): void {
    this.preferences.set(userId, language);
  }

  /**
   * 获取用户语言偏好
   */
  getPreference(userId: string): Language {
    return this.preferences.get(userId) || this.defaultLanguage;
  }

  /**
   * 移除用户语言偏好
   */
  removePreference(userId: string): void {
    this.preferences.delete(userId);
  }

  /**
   * 获取所有偏好
   */
  getAllPreferences(): Map<string, Language> {
    return new Map(this.preferences);
  }

  /**
   * 设置默认语言
   */
  setDefaultLanguage(language: Language): void {
    this.defaultLanguage = language;
  }

  /**
   * 获取默认语言
   */
  getDefaultLanguage(): Language {
    return this.defaultLanguage;
  }
}

// ============================================================
// 统一入口
// ============================================================

export class MultilingualSupport {
  detector: LanguageDetector;
  responder: MultilingualResponder;
  translator: Translator;
  preferenceManager: LanguagePreferenceManager;

  constructor(config?: Partial<LanguageConfig>) {
    this.detector = new LanguageDetector(config);
    this.responder = new MultilingualResponder();
    this.translator = new Translator();
    this.preferenceManager = new LanguagePreferenceManager();
  }

  /**
   * 检测语言
   */
  detectLanguage(text: string): Language {
    return this.detector.detect(text).language;
  }

  /**
   * 处理输入（自动检测语言并响应）
   */
  process(input: string, userId?: string): {
    detectedLanguage: Language;
    response: string;
    confidence: number;
  } {
    const detection = this.detector.detect(input);
    const userLang = userId ? this.preferenceManager.getPreference(userId) : detection.language;

    return {
      detectedLanguage: detection.language,
      response: this.responder.getResponse('greeting', userLang),
      confidence: detection.confidence,
    };
  }
}

// ============================================================
// 单例
// ============================================================

let instance: MultilingualSupport | null = null;

export function getMultilingualSupport(config?: Partial<LanguageConfig>): MultilingualSupport {
  if (!instance) {
    instance = new MultilingualSupport(config);
  }
  return instance;
}
