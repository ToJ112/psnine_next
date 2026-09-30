/**
 * psnine_next Core Type Definitions
 * Adheres strictly to docs/implementation-plan.md and verified upstream defaults.
 */

declare global {
  const GM: any;
  const GM_getValue: any;
  const GM_setValue: any;
  const GM_deleteValue: any;
  const GM_addStyle: any;
  interface Window {
    DOMParser: typeof DOMParser;
    __psnine_next_initialized__?: boolean;
    __psnine_next_mounted__?: boolean;
    __psnine_next_early_styled__?: boolean;
  }
}

export interface Settings {
  // Legacy fields from upstream
  hoverUnmark: boolean;
  autoCheckIn: boolean;
  autoPaging: number;
  autoPagingInHomepage: boolean;
  replyTraceback: boolean;
  highlightBack: string;
  highlightFront: string;
  highlightSpecificID: string[];
  highlightSpecificBack: string;
  highlightSpecificFront: string;
  blockList: string[];
  blockWordsList: string[];
  newQaStatus: boolean;
  hoverHomepage: boolean;
  foldTrophySummary: boolean;
  foldTrophyChart: boolean;
  platinumGlow: boolean;
  filterNonePlatinumAlpha: number;
  hotTagThreshold: number;
  nightMode: boolean;
  autoNightMode: 'SYSTEM' | 'TIME' | 'OFF';
  removeHeaderInBattle: boolean;
  listPostsByNew: boolean;
  showAllQAAnswers: boolean;
  listQAAnswersByNew: boolean;
  showHiddenQASubReply: boolean; // Upstream default is FALSE
  fixTextLinks: boolean;
  fixD7VGLinks: boolean;
  fixHTTPLinks: boolean;
  referGameVariants: boolean;
  preferSearchForFindingVariants: boolean;
  expandCollapsedSubcomments: boolean;
  showGameProgressInBattle: boolean;
  BattleInfoUpdateInterval: number; // 毫秒，默认 3600000 (1小时)

  // Modern / Extended fields
  redirectToMine: boolean;
  currencyConversion: boolean;
  exchangeRates: Record<string, number>;
  exchangeRateDate: string;
  blockWordsRegex: boolean;
  nightStart: number;
  nightEnd: number;
  showReplyControls: boolean;
}

export const defaultSettings: Settings = {
  hoverUnmark: true,
  autoCheckIn: false, // Default false for safety per implementation plan
  autoPaging: 0,
  autoPagingInHomepage: true,
  replyTraceback: true,
  highlightBack: '#3890ff',
  highlightFront: '#ffffff',
  highlightSpecificID: ['mechille', 'sai8808', 'jimmyleo', 'jimmyleohk', 'monica_zjl'],
  highlightSpecificBack: '#d9534f',
  highlightSpecificFront: '#ffffff',
  blockList: [],
  blockWordsList: [],
  newQaStatus: true,
  hoverHomepage: true,
  foldTrophySummary: false,
  foldTrophyChart: false,
  platinumGlow: false,
  filterNonePlatinumAlpha: 0.2,
  hotTagThreshold: 20,
  nightMode: false,
  autoNightMode: 'SYSTEM',
  removeHeaderInBattle: false,
  listPostsByNew: false,
  showAllQAAnswers: false,
  listQAAnswersByNew: false,
  showHiddenQASubReply: false, // Strictly align with upstream default false
  fixTextLinks: true,
  fixD7VGLinks: true,
  fixHTTPLinks: true,
  referGameVariants: true,
  preferSearchForFindingVariants: false,
  expandCollapsedSubcomments: true,
  showGameProgressInBattle: true,
  BattleInfoUpdateInterval: 3600000,

  redirectToMine: true,
  currencyConversion: true,
  exchangeRates: {},
  exchangeRateDate: '',
  blockWordsRegex: false,
  nightStart: 19,
  nightEnd: 7,
  showReplyControls: false
};

export interface Store {
  backend?: 'GM_V4' | 'GM_CLASSIC' | 'LOCAL_STORAGE' | 'MEMORY';
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface HttpOptions {
  ttl?: number;
  signal?: AbortSignal;
}

export interface HttpClient {
  text(url: string, options?: HttpOptions): Promise<string>;
  document(url: string, options?: HttpOptions): Promise<Document>;
  json<T>(url: string, options?: HttpOptions): Promise<T>;
}

export interface Context {
  document: Document;
  window: Window;
  url: URL;
  settings: Settings;
  store: Store;
  http: HttpClient;
  userId: string | null;
  onContent(fn: (root: ParentNode) => void): () => void;
  report(feature: string, error: unknown): void;
}

export type Cleanup = () => void;
export type Mount = (ctx: Context) => void | Cleanup | Promise<void | Cleanup>;
