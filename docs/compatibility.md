# 安装与兼容验证

## 同一个文件用于两端

发布文件为 `dist/psnine_next.user.js`。源码目录中的 TypeScript 不需要安装。完整脚本应以 `// ==UserScript==` 开头，不能只复制其中一段。

**桌面 Tampermonkey**：打开[公开安装脚本链接](https://raw.githubusercontent.com/ToJ112/psnine_next/main/dist/psnine_next.user.js)，由管理器接管安装；也可下载文件后导入，或在“添加新脚本”中以完整文件内容替换模板并保存。启用脚本，打开 `https://psnine.com/`，在网页中的 P9 Next 设置入口调整功能。

**iPhone/iPad Stay**：将该文件保存到“文件”，通过 Stay 的本地文件导入功能导入并在资料库中激活。也可以使用 Stay 的直接编辑方式粘贴完整内容。到 Safari 扩展设置启用 Stay，并允许它访问 PSNINE；刷新网站后使用网页内设置入口。[Stay 官方使用说明](https://github.com/shenruisi/Stay#使用方式)

仓库已公开，无需登录 GitHub。Stay 也可使用上述公开链接从脚本地址导入；本地文件导入或完整复制仍可用。当前脚本未配置专用自动更新地址，可用最新文件覆盖更新。设置和进度默认保存在当前设备，导出设置可用于另一个设备，账号 Cookie 不导出。

## 兼容设计

- 单一 IIFE，自包含代码/CSS/SVG，不需要运行时模块加载与 CDN 脚本。
- 兼容 `GM_getValue`/`GM_setValue` 与 `GM.getValue`/`GM.setValue`；缺失时在本机存储降级。
- 通过页面右下角按钮与网站导航入口打开设置；设置操作在网页内完成。
- Safari 15+ 是编译目标，移动表单至少 16px，弹层适配安全区和窄屏。
- 黑条、个人卡片、回复与 Tips 都有点击操作；不能只依赖 hover。
- 不依赖 `GM_notification`、`window.onurlchange` 等在部分 Stay 版本中不实现的接口。[官方 API 列表](https://github.com/shenruisi/Stay#api)

## 测试边界

自动化测试和最终结果见 `validation.md`。浏览器 WebKit 测试与 iPhone 真机 Stay 是不同层次，后者只有实际安装后才能标记通过。当前任务不自动修改用户已经安装的脚本。

真机应核对：本地文件安装、授予网站权限、页面内设置打开/保存、刷新后设置保持、触屏显隐黑条、奖杯汇总不溢出、内联 Tips 请求成功、前后台返回。自动签到仅在用户主动启用后检查。

## 外观与手机设置（1.0.2）

打开页面右下角设置，在“外观”中统一选择跟随系统、浅色、深色或定时；定时模式才显示开始和结束小时。选择后保存配置，旧版主题设置仍可读取。功能分组可点开，导入、导出及恢复默认位于配置管理。
