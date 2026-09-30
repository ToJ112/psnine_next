# 功能台账

从两个来源仓库的可获取历史中整理出 80 个独立验收点。实现、历史 SHA 和关联测试完整保存在 [features.json](features.json)。历史删除/实验项的取舍见 [迁移决策](migration-decisions.md)。

1.0.4 按用户要求移除了 T01–T07 的整个奖杯概览，T10 改为复用原站筛选；保留全部 80 条历史映射，不再将已移除界面声明为支持。以下“已实现”表示已接入代码；不代表每项都做过脚本管理器真机验证。关联测试按模块列出，个别功能还有模拟、历史夹具或站点数据限制。最终命令与浏览器结果见 [验证记录](validation.md)。

|编号|功能|实现文件|验证范围/限制|
|---|---|---|---|
|G01|手动深色主题|[global](../src/features/global.ts)|单一外观选择浅色/深色，覆盖保存、刷新与旧配置映射。|
|G02|跟随系统主题|[global](../src/features/global.ts)|实际系统偏好变化驱动主题；浏览器使用发布脚本验证。|
|G03|按时间切换主题|[global](../src/features/global.ts)|选择定时后才显示开始/结束小时，兼容旧配置。|
|G04|刮刮条显示|[global](../src/features/global.ts)|代码审阅、关联模块回归|
|G05|自动签到|[global](../src/features/global.ts)|默认关闭；仅用模拟签到按钮验证去重与启用条件，本次未发起真实签到。|
|G06|回到页底|[global](../src/features/global.ts)|原生悬浮层合并与几何无重叠回归；旧页保留独立入口。|
|G07|插件设置|[core](../src/main.ts)|设置导入导出仅含设置，不同步 Cookie 或个人进度；移动浏览器回归不等于管理器沙箱实测。|
|G08|裸文本链接识别|[global](../src/features/global.ts)|代码审阅、关联模块回归|
|G09|D7VG 旧链接修复|[global](../src/features/global.ts)|代码审阅、关联模块回归|
|G10|站内 HTTPS|[global](../src/features/global.ts)|代码审阅、关联模块回归|
|G11|机因问答默认最新|[global](../src/features/global.ts)|代码审阅、关联模块回归|
|C01|楼主徽标|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C02|指定用户高亮|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C03|楼层编号|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C04|回复内容回溯|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C05|回溯完整内容与跳转|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C06|回复控件可见性|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C07|热门标签|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C08|用户黑名单|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C09|关键词过滤|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C10|头像个人卡片|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C11|问答状态与悬赏|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C12|载入全部问答答案|[paging](../src/features/paging.ts)|仅沿真实下一页链接加载；每批有上限，可停止并继续，不把部分加载称为已全部完成。|
|C13|问答答案最新优先|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C14|展开问答隐藏回复|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C15|二级回复倒序|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C16|视口内展开子评论|[community](../src/features/community.ts)|代码审阅、关联模块回归|
|C17|机因字数统计|[editor](../src/features/editor.ts)|代码审阅、关联模块回归|
|C18|BBCode 实时预览|[editor](../src/features/editor.ts)|安全的基础 BBCode 预览；历史未合并的完整编辑工具栏不恢复。|
|C19|攻略中我的奖杯|[trophies](../src/features/trophies.ts)|需已验证登录身份和个人奖杯响应；无法确认时显示未知。|
|C20|列表自动翻页|[paging](../src/features/paging.ts)|追加当前同类列表；保留原分页，遇到未知结构或请求失败停止。|
|C21|个人主页全部游戏|[paging](../src/features/paging.ts)|跟随主页实际“全部游戏”入口，再按分页上限分批载入。|
|T01|奖杯类型统计|[trophies](../src/features/trophies.ts)|**按用户要求移除（1.0.4）**：整个概览及相关设置已删除；历史证据保留。|
|T02|奖杯稀有度统计|[trophies](../src/features/trophies.ts)|**按用户要求移除（1.0.4）**：整个概览及相关设置已删除；历史证据保留。|
|T03|获得时间曲线|[trophies](../src/features/trophies.ts)|**按用户要求移除（1.0.4）**：整个概览及相关设置已删除；历史证据保留。|
|T04|已获/未获图标汇总|[trophies](../src/features/trophies.ts)|**按用户要求移除（1.0.4）**：整个概览及相关设置已删除；历史证据保留。|
|T05|汇总 Tips 标记与预览|[trophies](../src/features/trophies.ts)|**按用户要求移除（1.0.4）**：整个概览及相关设置已删除；历史证据保留。|
|T06|奖杯汇总折叠|[trophies](../src/features/trophies.ts)|**按用户要求移除（1.0.4）**：整个概览及相关设置已删除；历史证据保留。|
|T07|奖杯图表折叠|[trophies](../src/features/trophies.ts)|**按用户要求移除（1.0.4）**：整个概览及相关设置已删除；历史证据保留。|
|T08|获得时间排序|[trophies](../src/features/trophies.ts)|补充在个人页的原生排序菜单中；公开页不显示，无原菜单时跳过。|
|T09|原序/类型/稀有度排序|[trophies](../src/features/trophies.ts)|保留原生 XMB/类型/完美率链接；菜单内补充反向和页面初始顺序，本地排序保持现有 DLC 分组与 Tips 归属。|
|T10|获得状态筛选|[trophies](../src/features/trophies.ts)|沿用原站已获得/未获得控件，仅同步内联 Tips 与动态行；不再添加独立筛选。|
|T11|内联展开单个 Tips|[trophies](../src/features/trophies.ts)|代码审阅、关联模块回归|
|T12|批量全部/未获 Tips|[trophies](../src/features/trophies.ts)|显式按钮、限速、可取消；异常后允许重试。|
|T13|Tips 顶数排序|[trophies](../src/features/trophies.ts)|读取已载入 Tips 自身的顶数，不包含子评论；匿名站点不提供顶数时不能推断。|
|T14|Tips 输入框缩放|[trophies](../src/features/trophies.ts)|代码审阅、关联模块回归|
|P01|无白金游戏降低透明度|[games](../src/features/games.ts)|代码审阅、关联模块回归|
|P02|游戏封面完成度提示|[games](../src/features/games.ts)|官方进度条优先，避免重复百分比与整行底色；缓存徽章覆盖亮暗主题、动态更新及他人主页回归。|
|P03|游戏列表按难度排序|[games](../src/features/games.ts)|代码审阅、关联模块回归|
|P04|我的游戏进度缓存|[games](../src/features/games.ts)|按已验证登录账号隔离；不读旧脚本独立 GM 私有区。|
|P05|进度后台增量刷新|[games](../src/features/games.ts)|分批增量读取；账号、空列表、下一页与错误均需验证，缓存可能暂时滞后。|
|P06|列表背景进度与徽章|[games](../src/features/games.ts)|官方进度条优先，避免重复百分比与整行底色；缓存徽章覆盖亮暗主题、动态更新及他人主页回归。|
|P07|白金封面修饰|[games](../src/features/games.ts)|代码审阅、关联模块回归|
|P08|未注册主页同步入口|[games](../src/features/games.ts)|只添加手动同步链接，本次未在网站执行同步。|
|P09|游戏页转到我的奖杯|[games](../src/features/games.ts)|模拟导航验证；不覆盖 URL 已指定的其他用户。|
|P10|元数据关联游戏版本|[games](../src/features/games.ts)|以站点元数据为依据；部分游戏可能没有其他版本。|
|P11|搜索关联游戏版本|[games](../src/features/games.ts)|规范化名称精确匹配；不把标题包含关系当同款证明。|
|P12|跨版本奖杯 Tips|[games](../src/features/games.ts)|仅对名称或描述能明确对应的奖杯生成链接；跨语言无法确认时不猜。|
|P13|子页面版本导航|[games](../src/features/games.ts)|代码审阅、关联模块回归|
|P14|PSPC 与 PS5 封面修正|[games](../src/features/games.ts)|代码审阅、关联模块回归|
|B01|隐藏约战发起人头像|[battle](../src/features/battle.ts)|代码审阅、关联模块回归|
|B02|约战列表我的进度|[battle](../src/features/battle.ts)|代码审阅、关联模块回归|
|B03|约战游戏监控|[battle](../src/features/battle.ts)|代码审阅、关联模块回归|
|B04|导航招募提醒|[battle](../src/features/battle.ts)|导航提醒为本地监控游戏的匹配数量，不是系统推送。|
|B05|约战信息缓存|[battle](../src/features/battle.ts)|代码审阅、关联模块回归|
|R01|测评均分|[reviews](../src/features/reviews.ts)|当前已载入评论样本，不声称全站总分。|
|R02|评分分布|[reviews](../src/features/reviews.ts)|代码审阅、关联模块回归|
|R03|按分数过滤评论|[reviews](../src/features/reviews.ts)|代码审阅、关联模块回归|
|R04|正态参考曲线|[reviews](../src/features/reviews.ts)|正态曲线为分布参考，不是对评分真实性的判定。|
|R05|累计均分趋势|[reviews](../src/features/reviews.ts)|仅可信时间进入趋势；缺失时间单独说明。|
|R06|每周评分热度|[reviews](../src/features/reviews.ts)|按上海时区计算 ISO 周，并补齐样本范围内空周。|
|D01|普通/Plus 价格历史|[deals](../src/features/deals.ts)|缺失价格、日期或原价保留为未知，图表不将未知填成零。|
|D02|数折人民币换算|[deals](../src/features/deals.ts)|异步公开汇率或用户填写的带日期汇率；必须保留原币种，来源/日期/过期状态可见。|
|D03|活动人民币切换|[deals](../src/features/deals.ts)|只读访问 /huodong 返回 404；采用旧源码结构的测试夹具验证，未做当前活动页在线验证。|
|D04|折扣幅度着色|[deals](../src/features/deals.ts)|代码审阅、关联模块回归|
|D05|数折与活动只看史低|[deals](../src/features/deals.ts)|只接受站点显式史低标记；活动页部分沿用历史夹具验证。|
|X01|v2 导航与布局|[core](../src/main.ts)|入口复用原生链接，亮暗样式逐项比对；插件配色跟随站点变量，公开页面回放覆盖。|
|X02|iOS Safari Stay|[core](../src/main.ts)|单文件、GM 兼容层与触控已实现；Chromium/WebKit 自动化通过仍不能代表 Tampermonkey 或 iPhone Stay 真机安装、授权及沙箱通过。|
|X03|动态内容幂等增强|[core](../src/main.ts)|重复注入、局部动态内容与取消回归；不依赖 MutationObserver 持续轮询。|
|X04|旧配置迁移|[core](../src/main.ts)|只迁移可访问的旧 localStorage 或用户导入的 JSON；新脚本不能读取旧脚本的 GM 私有区。|
