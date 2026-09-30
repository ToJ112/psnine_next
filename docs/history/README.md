# 提交历史证据

本目录记录 2026-09-30 抓取的两仓库全部可获取 refs，不只默认分支。

|来源|master 祖先|所有 refs 可达提交|
|---|---:|---:|
|ToJ112/psnine-enhanced-version|712|763|
|swsoyee/psnine-enhanced-version|712|778|
|去重并集|712|778|

fork 的 v2 适配在 `adapt-v2-psnine@304b14e`，含 715 条祖先提交；它的三个新增提交也已出现在上游 PR #140 refs 内，故不能相加重复计数。另有 63 条属于其他实验分支或 PR refs。比如 `use-webpack@5b6c8e8` 不是 master 祖先，不应把该实验分支的功能当作 master 已支持。

- `manifest.json`：完整 SHA、父提交、原始说明、作者、日期、路径、来源、分支归属及 patch SHA-256。
- `commit-patches.jsonl.gz`：按 SHA 保存的完整文本 patch，`git show --root -m --find-renames` 生成，merge 按每个父提交展开，二进制文件以 Git 的二进制变更标记记录。压缩只用于减小体积，不省略文本源码。
- `../reviews/early.json` / `late.json`：Gemini 对互斥批次的逐条阅读记录。
- `../reviews/*-features.md`：功能演变、删除、回退与注意事项。

审阅方法：逐提交查看完整说明和源码差异，依赖锁文件/二进制资产按机器数据归类，merge 不重复计算功能。功能是否存续以 master/v2 源码及祖先关系复核，不以提交标题推定。

抓取可复现命令：

```sh
git clone --mirror https://github.com/ToJ112/psnine-enhanced-version.git fork.git
git clone --mirror https://github.com/swsoyee/psnine-enhanced-version.git upstream.git
git --git-dir=upstream.git rev-list --reverse --topo-order --all
git --git-dir=upstream.git show --root -m --find-renames FULL_SHA
```

这覆盖快照时公开 refs 可达的每条提交；GitHub 不可访问的删除分支/悬空对象无法宣称已读取。未来上游新增提交不自动包含在此快照。
