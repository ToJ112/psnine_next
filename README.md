# psnine_next

PSNINE 增强用户脚本的新实现。源码按功能维护，发布为一个自包含 `.user.js`，面向桌面 **Tampermonkey（篡改猴）** 与 iOS/iPadOS Safari **Stay**。

本仓库已公开。[直接获取安装脚本](https://raw.githubusercontent.com/ToJ112/psnine_next/main/dist/psnine_next.user.js)，无需登录 GitHub；脚本不依赖运行时 CDN。

版本 `1.0.4`：移除奖杯概览，仅保留紧凑的 Tips 操作；获得状态筛选沿用原站。游戏列表已有官方进度条时不重复添加进度徽章与整行底色；其他列表的缓存进度提示兼容亮暗主题。

## 设计与来源

- [完整实现方案](docs/implementation-plan.md)
- [功能台账](docs/feature-catalog.md)
- [778 条提交的历史证据](docs/history/README.md)
- [现网站点结构与兼容依据](docs/site-structure.md)

上游：[swsoyee/psnine-enhanced-version](https://github.com/swsoyee/psnine-enhanced-version)；v2 适配：[ToJ112/psnine-enhanced-version](https://github.com/ToJ112/psnine-enhanced-version/tree/adapt-v2-psnine)。原作者及贡献者声明见 [NOTICE](NOTICE)，许可见 [MIT](LICENSE)。

## 安装

安装文件为 [dist/psnine_next.user.js](dist/psnine_next.user.js)，无需安装源码目录，也无需在手机上运行 Node。

- 篡改猴：下载完整文件后导入，或把完整内容粘贴到新脚本编辑器并保存。
- Stay：将完整文件保存到 iPhone/iPad 的“文件”，在 Stay 中本地导入并激活，允许 Safari 扩展访问 PSNINE。
- 页面右下角的设置按钮可调整功能、导入/导出设置。第一次使用时请停用旧版增强脚本，避免两套脚本同时修改同一页面。

也可使用上面的公开脚本链接安装或下载后导入；当前脚本未配置专用自动更新地址。详见 [安装与兼容说明](docs/compatibility.md)。当前版本通过 170 项单元/DOM 测试、34 项浏览器测试及 52 个亮/暗主题公开页面回放案例。详见 [验证记录](docs/validation.md)；Tampermonkey 与 iPhone Stay 尚未进行实际安装及沙箱验证。

## 开发

建议使用 Node.js 24 与 npm；手机和桌面脚本安装端无需开发工具。最终依赖版本以 `package-lock.json` 为准。

```sh
npm ci
npm run check
npm test
npm run build
npx playwright install chromium webkit
npm run test:browser
python3 tools/audit_history.py
```

生产脚本由 Gemini `gemini-3.8-flash-high / high` 编写；Codex 负责历史核验、设计、拆分和集成评审。源码按模块维护，构建时将 TypeScript、CSS 和 SVG 合并成一个 IIFE，安装端不使用模块加载器或远程脚本依赖。

历史原始补丁压缩包、逐条审阅台账及功能映射随仓库保存。公开页面回放素材仅保存在本机忽略目录中，不随仓库发布。
