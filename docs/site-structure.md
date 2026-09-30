# 现网站点结构记录

2026-09-30 通过未登录 HTTP GET 读取 psnine.com 首页、游戏列表、游戏奖杯页、公开个人游戏页、Tips、机因、问答、约战、数折、价格历史、攻略和测评。原始 HTML 仅留在 `.audit-cache/live/`，不发布个人资料或完整用户文章。

结论：v2 导航与 legacy 内容结构同时存在，不能只按首页 `.topic-row` 推断所有页面已经卡片化。

|页面|已观察到的结构|注意|
|导航|`.site-nav .nav-menu`、`.nav-user`、`.mobile-nav-panel nav`|未登录没有 auth-user；不要从普通用户链接推断登录账号|
|首页主题|`.topic-row .author a`、`.topic-main .title`、`.replies`|其余区块是不同结构|
|游戏列表|普通 `table`（不一定有 `.list`）、`td.pd1015.title.lh180`、`.text-platinum`、`td.twoge em`|按真实游戏链接辨认；末页可能只有一行，不能依赖类名或最少行数|
|奖杯列表|`tr.trophy[id]`、首格 `td.t1..t4`、`img.imgbg`、末格 `.twoge`|行 ID 是分组内序号，真实 trophyId 要从 `/trophy/46507001` 取|
|个人奖杯页|`?psnid=…`、`img.imgbg.earned`、时间 `em.alert-success` 的 `tips` 年份|公开版没有个人获得状态；个人版比公开版多一格|
|DLC|每 DLC 独立 `table.list`|排序不能混到同一 tbody|
|个人主页|游戏行 `td.pd15`、`div.progress > div`、`span.text-platinum`|此处白金为个人获得数；进度可能只写在样式 width 中。样本官方完成度 38%，19/32 是奖杯数量比，18.63% 是游戏稀有度，不能互换|
|Tips/测评|`ul.list > li > .ml64`、第一条 `.meta.pb10` 作者头、第二条 `.meta` 时间、`.content.pb10`、`.sonlistmark > .sonlist`|日期不能从作者头取；评分和顶数只读当前主评论，不能混入子评论|
|主题/机因详情|`.post > .ml64 > .meta` 与 `.content.pb10`|与 ul.list 的评论不同|
|数折|`ul.dd_ul > li.dd_box`、`h4.dd_title > a`、`.dd_info p.dd_text`、`.dd_price_old/off/plus`、`.dd_status_best`|商品标题与活动链接是不同元素；去重用商品 SKU，不能用共享活动 URL|
|历史数折|日期示例 `20年10月14日 ~ 20年10月28日`|当前公开历史含多年以前记录，不代表今日促销|
|约战|多个 `table.list`、封面 `td.pdd15 a[href*="/psngame/"]`、标题 `td.pd15 > p > a[href*="/battle/"]`、描述 `td.pd15 > span.font12`|封面和作者头像链接可能没有文字，标题不能取其 textContent|
|游戏版本元数据|`.min-inner > ul.darklist > li`，平台在 `span.r`|封面与标题可重复链接同一版本；样本 46507 关联 42152 (PS4)、42066 (PS5)。奖杯页 12518001 的父游戏 12518 指向元数据 10999，不能假设 ID 相同|

## 外部接口

已只读验证 `https://api.frankfurter.dev/v1/latest?base=CNY&symbols=HKD,USD,GBP,JPY` 返回 `base: CNY`、`date`、`rates`。rates 是每一 CNY 可兑换外币数，换算“1外币=CNY”需要取倒数。启用换算后可拉取；请求失败使用标明日期的有效缓存/人工汇率，不能使用未标记过期常量。

## 兼容依据与验证边界

- Tampermonkey API：[官方文档](https://www.tampermonkey.net/documentation.php)。
- Stay API：[官方仓库说明](https://github.com/shenruisi/Stay)。支持用户脚本和 GM 存储；不同版本行为仍需实际管理器验证。
- WebKit 自动测试验证浏览器引擎和移动布局，不等于 iPhone 上 Stay 扩展执行链路的真机验证。
