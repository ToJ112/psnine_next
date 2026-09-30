# psnine_next 实现方案

## 目标与交付

保留 PSNINE 增强脚本的完整用户能力，重新组织为可测试的 TypeScript 模块，发布为 **一个自包含 `dist/psnine_next.user.js`**。桌面 Tampermonkey 和 iPhone/iPad Safari Stay 是兼容目标；模块化不改变用户安装方式，不需要 Node、服务器或浏览器扩展商店。开发环境才需要 Node。

源仓库为 `ToJ112/psnine-enhanced-version`，其上游为 `swsoyee/psnine-enhanced-version`。两个 `master` 都停在 `6f48f8f`；采用 fork 的 `adapt-v2-psnine@304b14e` 作为现存行为参考。所有可获取分支、标签、PR refs 共 778 个唯一 commit，master 祖先 712 个。完整来源、父提交和路径见 `history/manifest.json`，逐条解释见 `reviews/`。历史功能与当前主分支支持分开统计。

## 产品结构

1. 全局：主题、设置、文字链接修复、刮刮条、用户识别、跳到底部、签到。
2. 社区：楼主与特定用户标识、楼层、回复回溯、内容过滤、问答、个人卡片、编辑预览、分页。
3. 奖杯：类型与稀有度统计、获得时间、已获/未获汇总、排序、内联 Tips、跨版本、攻略进度。
4. 游戏与约战：游戏进度缓存、难度排序、白金封面、监控游戏及导航提醒。
5. 测评：均分、评分分布及筛选、正态参考曲线、累计均分与按周热度。
6. 数折：普通/Plus 价格历史、带日期的人民币换算、折扣色阶、史低筛选。

完整细项和源证据见 `feature-catalog.md` 与 `features.json`。每项记录实现文件、关联模块回归测试及验证范围；真机、历史活动页和登录操作的限制单列，不以 README 或提交标题代替行为核对。

## 技术选择

- TypeScript strict + esbuild；IIFE 单文件，目标 Safari 15+ / ES2020。CSS、图标、图表直接打包；无运行时 `import()`、无 `@require`、不依赖页面 jQuery/Highcharts/tippy。
- 图表使用原生 SVG + 可读数据表，支持触屏、键盘、响应式及深色；避免加载整个可视化框架。
- Vitest + jsdom 测纯逻辑和 DOM；Playwright Chromium/WebKit 测实际构建产物。测试优先覆盖数据错误、重复执行、请求故障、跨账号、排序保持 Tips 归属与 XSS。
- 用户脚本匹配 psnine.com、d7vg.com 及其子域；`document-start` 尝试注入主题，无根节点时在 DOM 就绪后补注入并挂载功能。
- 存储兼容 `GM.getValue/setValue` Promise 与 `GM_getValue/setValue` 同步接口；不可用时降级 localStorage，再降级内存并在设置中说明。界面不依赖 GM 菜单。
- 页面内始终有可点击设置入口，不依赖脚本管理器菜单。Stay 按钮最小触摸尺寸、16px 表单字体、安全区域边距、无纯 hover 必要操作；弹层支持关闭与返回焦点。

## 模块接口（所有实现者遵守）

`src/core/types.ts` 定义 `Context`：

```ts
interface Context {
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
interface Store {
  get<T>(key: string, fallback: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}
interface HttpClient {
  text(url: string, options?: { ttl?: number; signal?: AbortSignal }): Promise<string>;
  document(url: string, options?: { ttl?: number; signal?: AbortSignal }): Promise<Document>;
  json<T>(url: string, options?: { ttl?: number; signal?: AbortSignal }): Promise<T>;
}
type Cleanup = () => void;
type Mount = (ctx: Context) => void | Cleanup | Promise<void | Cleanup>;
```

每个模块导出 `mountGlobal` / `mountCommunity` / `mountEditor` / `mountPaging` / `mountTrophies` / `mountGames` / `mountBattle` / `mountReviews` / `mountDeals`；自己判断路由。core 隔离模块异常并集中记录，不让一处 selector 缺失阻止其余模块。挂载执行一次；动态内容通过 `onContent` 再增强，必须幂等。可由组合模块拆出子文件，但 API 不漂移。

`Settings` 延续原版属性名称，方便迁移：`hoverUnmark, autoCheckIn, autoPaging, autoPagingInHomepage, replyTraceback, highlightBack, highlightFront, highlightSpecificID, highlightSpecificBack, highlightSpecificFront, blockList, blockWordsList, newQaStatus, hoverHomepage, foldTrophySummary, foldTrophyChart, platinumGlow, filterNonePlatinumAlpha, hotTagThreshold, nightMode, autoNightMode, removeHeaderInBattle, listPostsByNew, showAllQAAnswers, listQAAnswersByNew, showHiddenQASubReply, fixTextLinks, fixD7VGLinks, fixHTTPLinks, referGameVariants, preferSearchForFindingVariants, expandCollapsedSubcomments, showGameProgressInBattle, BattleInfoUpdateInterval`。

`autoNightMode` 在新 schema 统一为 `'SYSTEM' | 'TIME' | 'OFF'`，迁移旧 `{value,enum}`。新增 `redirectToMine:boolean`、`currencyConversion:boolean`、`exchangeRates:Record<string,number>`、`exchangeRateDate:string`、`blockWordsRegex:boolean`、`nightStart:number`、`nightEnd:number`、`showReplyControls:boolean`。迁移/校验集中进行；未校验对象不能写入设置。

## 数据与网络

- `psnine_next:settings:v1` 存设置；只首次迁移旧 localStorage 的 `psnine-night-mode-CSS-settings`。不会假定新脚本能读到旧脚本的 GM 私有区；提供 JSON 导入/导出，个人进度重建。恢复默认不删除站点数据。
- 进度缓存按已验证登录 ID 分区。浏览其他人主页不得写入“我的”数据；未知登录身份只显示公开信息，不后台刷新私人进度。
- 进度源为个人游戏页，保存 gameId、percent、platinum、更新时间。支持首刷、分页补全、无变化后退避、有变化恢复及时更新；分页边界和隐藏游戏不得引发负长度数组。
- 网络层：不带独立取消信号的同 URL 在途请求去重，并发最多 2、15 秒超时、TTL、显式失败；带信号的请求单独取消，避免互相中止。分页、批量 Tips 和后台刷新分别设置批次上限、间隔或退避。HTML 页面仅同源请求，导入 DOM 之前移除脚本/事件属性/危险 URL。
- 自动翻页保持原 query/hash，不猜不存在下一页。用已知分页链接；追加同一种列表，按行身份去重；失败保留原分页和重试入口，有上限、可停止。
- 约战只缓存公开招募列表，监控列表保存在本地；仅有监控项目时刷新。红点代表匹配游戏数量而非系统推送。
- 汇率用异步公开接口（若启用）或用户填写的带日期汇率。失败只显示“不可用/过期”，绝不把 2020 年常量伪装成实时值。原币种价格永远保留。

## 关键行为决策

- 自动签到支持但新安装默认关闭，用户在设置中启用。每天、每账号最多一次尝试；优先站点公开按钮，不把任意 HTTP 200 当成已签到，不在开发验证时触发真实签到。
- 外观使用单一选择：跟随系统、浅色、深色、定时。仅定时显示开始/结束小时，UI 映射到既有 `nightMode` / `autoNightMode` 字段，保持旧配置兼容。优先使用 v2 `data-theme` 与站点变量，旧版和插件面板补充明确范围的暗色样式；不靠反色滤镜，不改图片。
- 设置按功能折叠分组，外观默认展开，配置管理放入独立分组；底部仅保留保存/取消。手机开关固定宽度、输入文字至少 16px、弹层适应可视高度并保留可滚动内容区。主题规则不依赖 CSS 插入先后，保存与刷新走真实配置验证。
- 插件界面沿用原站 v2 的颜色、边框、圆角变量，旧页提供回退值。手机与用户菜单复用原生链接结构，旧列表菜单保留 li 包装；奖杯操作使用中性细边按钮，统计采用单层卡片与分隔线，悬浮入口统一为原站图标按钮风格。原生导航不受插件的链接访问色覆盖。
- 过滤采用独立原因集合，评分过滤不能把黑名单重新显示。关键词默认字面匹配，正则需显式选择，非法表达式不会导致崩溃。
- 文本链接只处理文本节点，排除已有链接、代码、输入框；预览构建安全 DOM，不执行用户输入 HTML。
- 奖杯排序复用页面原有下拉菜单：保留 XMB、类型、完美率链接及其 URL 参数和跳转，仅在菜单内补充时间与反向排序。概览面板不另建排序栏；找不到可靠原菜单时跳过扩展。触屏与键盘均可操作。
- 插件本地排序仅在各 DLC 分组内移动，内联 Tips 与奖杯行共同移动；未知时间排最后，时间丢失不伪造为最早时间。“页面初始顺序”是恢复本次载入顺序，不能冒充原生 XMB。公开页不显示个人获得时间选项；未确认个人状态时不能全部显示成未获得。
- 游戏版本优先关联元数据，再精确规范化名称搜索；名称包含关系不足以判定同款。跨版本对应奖杯须验证名称/描述，不凭序号拼出一个可能错误的奖杯链接。
- 所有批量 Tips 加载改为明确可点击、限速、可停止的操作；历史隐藏按键入口列入迁移说明。
- 图表统计标明范围（当前已载入条目）；不把一页评论均分描述为全站总分。零值/缺失/单一数值均可渲染，不生成 NaN。
- PS5/PSPC 封面使用自然宽高比，样式限于实际游戏封面；不用全站全局 `img` 修复。

## 验收

1. 历史台账集合与 778 个 SHA 完全相等，无缺失/重复；每条给出说明、变更类别和功能关联。
2. 功能台账的每条现存能力都有实现文件或明确依赖说明，历史实验/删除项另列理由。
3. 类型检查、单元与 DOM 测试通过；构建后元数据首行正确、无模块加载/远程脚本依赖。
4. 浏览器 smoke 运行构建产物：桌面和 390px 移动视口；重复挂载、设置开关、暗色、详情/列表/空页面正常。
5. 只读真实公开页面验证 selectors；不发帖、不签到、不修改用户浏览器安装。Safari WebKit 自动化通过不等于 Stay/iPhone 已实测，交付清楚区分。
6. 推送仓库 main，包含源码、构建产物、完整功能与历史文档、安装与开发指引、MIT 声明。仓库最初按要求设为私有，后按用户要求于 2026-09-30 改为公开。

## 分工

Codex 负责来源快照、行为核对、方案、任务拆分、集成评审和交付。两个 Gemini `gemini-3.8-flash-high / high` 分别完成前/后半历史审阅，再按互斥文件所有权实现核心/社区与奖杯/数据模块。跨模块问题由主控统一接口后修复，不并发改同一文件。
