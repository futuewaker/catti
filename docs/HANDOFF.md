# CATTI 项目交接文档

> 用于新对话继续任务。复制本文档全文作为新对话的 context。

---

## 🎯 项目概况

**CATTI · 猫格测试** — 中文猫咪性格测试单页应用，参考 SBTI/DogTI 风格，15题匹配24只猫。

- **项目路径**：`/Users/leo/Desktop/性格测试/猫猫/catti/`
- **GitHub**：https://github.com/futuewaker/catti （账号 `futuewaker`，gh CLI 已授权）
- **当前部署**：https://catti.caiyuxuan641.workers.dev/ （旧版 Worker，**未绑定 Git**，不自动同步）
- **目标部署**：用户要改成 Cloudflare Pages（`catti.pages.dev`），用户说会在 UI 里手动建 Pages 项目
- **本地服务器**：`python3 -m http.server 8765`

---

## 📁 核心文件

```
catti/
├── index.html           # SPA: intro / quiz / result 三视图
├── styles.css           # 极简像素风
├── app.js               # 状态机 + 雷达图 canvas 绘制 + html-to-image 生成分享图
├── data/
│   ├── questions.json   # 15 题（每题 bubble + avatar + 3 options）
│   └── cats.json        # 24 只猫（name_title / name / breed / slogan / tags / vector / interpretation）
├── images/              # 24 张像素猫 PNG
└── docs/
    ├── 2026-04-22-catti-design.md   # 初始设计 spec
    ├── CATS_PROFILES.md             # 刚生成的 SBTI 风格档案手册（715 行）
    └── HANDOFF.md                   # 本文件
```

---

## 🧮 核心机制

- **4 维度**：EI 社牛浓度 / PL 发动机转速 / TF 冷静抬杠度 / JS 强迫症指数
- **15 题**分布：EI×4 + PL×4 + TF×4 + JS×3
- 每题 3 选项：A +1 / B 0 / C -1，累加到对应维度 → 生成 `[E,P,T,J]` 向量（范围 -4 ~ +4）
- **匹配算法**：欧氏距离找最近的猫（24只猫的 vector 在 `data/cats.json`）

---

## 🎨 当前视觉/交互状态

**封面页**
- 3行像素猫滚动 marquee（交替方向+不同速度）
- 大像素字体 "CatTi"（Press Start 2P + 橘色 drop shadow）

**题目页**
- 宽黑色进度条 + "3/15" 文字
- 每题独立猫咪头像 + 独立旁白气泡
- 点选项 → 闪黑反馈 → 自动跳题
- 底部：上一题 / 下一题 双按钮（支持回溯改答）

**结果页当前顺序**
1. 大像素猫头像
2. "你的本命猫是" + `{name_title} {name}` （如 "WILD 野性基因-孟加拉猫"）
3. Slogan（已自带引号）
4. 引用气泡（解读首句）
5. 性格标签（2x2 网格 × 4个）
6. 喵格解读（段落）
7. 维度分析（canvas 雷达图，维度标签已 SBTI 化）
8. 保存/分享图（自动生成 + 内联显示 + 长按保存提示）
9. 复制链接 / 再测一次

---

## 📋 进行中的任务（未完成）

用户说："**我觉得md文档很不错，直接应用到网站上吧**"

指的是把 `docs/CATS_PROFILES.md` 的信息架构搬到网页结果页。MD 里每只猫的结构：

```
### 01 · TRIC 轮岗者-三花猫
- **代号**：`TRIC`
- **品种原型**：三花猫
- **Slogan**：*"..."*

**性格标签**
- tag 1
- tag 2
...

**维度雷达**
（bar 可视化）

**喵格解读**
> ...
```

**要做的具体改动**：
1. **结果页新增 meta 信息行**（放在 name 下方、slogan 上方）：
   - `代号: WILD`
   - `品种原型: 孟加拉豹猫`
2. 把 section 标题 `维度分析` 改为 `维度雷达`
3. **分享卡（share-card）也同步加 meta 信息行**
4. 样式要克制——两行小字 + 细分隔线即可，不要抢 name 的视觉焦点

**实现位置**：
- `index.html` 第 115-119 行（name 之后、result-quote 之前插入 meta row）
- `app.js` 的 `renderResult()` 函数要填充新字段（`el.resultCode.textContent = cat.name_title`, `el.resultBreed.textContent = cat.breed`）
- `styles.css` 加 `.result-meta` 样式
- 分享卡同样位置：`index.html` 的 share-card 部分 + `app.js` 的 `generateShareImage()`

---

## 📦 待办清单（优先级从高到低）

1. ✅ **SBTI 风格内容重写** — 24 只猫的 name_title / name / slogan / interpretation 已全量改写成 SBTI 调性（最近一次 agent 改）
2. ✅ **雷达图 SBTI 化** — 维度标签改为 "社牛浓度 / 发动机转速 / 冷静抬杠度 / 强迫症指数"
3. ✅ **breed 字段回填** — data/cats.json 里 24 只猫都有 breed 字段（如 `"breed": "孟加拉豹猫"`）
4. ✅ **CATS_PROFILES.md 文档生成** — `docs/CATS_PROFILES.md` 已写好 715 行
5. 🔄 **结果页加 meta 信息行**（当前进行中，**是下一个对话要做的**）
6. ⏳ **本地 Playwright 测试** — meta 行加完后验证
7. ⏳ **commit + push 到 GitHub**（用户要先过一遍再 push）
8. ⏳ **用户自行在 Cloudflare UI 里建 Pages 项目**（参考旧消息里给过的 UI 步骤）

---

## 🔑 关键历史决策

1. **名字格式**：`{英文code} {SBTI中文名}-{品种}`（如 `WILD 野性基因-孟加拉猫`）
   - `name_title` = 英文code（"WILD"）
   - `name` = SBTI中文名 + 品种（Agent 已合并为 "野性基因-孟加拉猫"）
   - `breed` = 完整品种原名（"孟加拉豹猫"）
2. **调性**：SBTI 风格（戏剧化开场 + "您"尊称 + 网络/游戏梗密植 + 小事哲学化 + 金句收尾），不再是温柔散文
3. **UI 风格**：极简黑白灰 + 像素字体点缀（Press Start 2P）+ 像素猫头像
4. **交互**：点选项自动跳题（FLASH_MS 320 + NEXT_DELAY 260 + ANIM_MS 280）
5. **分享图**：用 html-to-image CDN，720px 宽 @2x DPR，只含 logo+猫图+名字+slogan+解读（无标签无雷达）
6. **部署授权**：gh 已登录（账号 futuewaker），wrangler 未登录，Cloudflare MCP 403

---

## ⚠️ 注意事项

- **推送前必须让用户先过目**（用户原话："完成后给我先过一遍再推送到github"）
- **Cloudflare 旧 Worker 不自动同步** — 就算 push 到 GitHub，线上还是 v3 老版本，除非用户在 UI 建 Pages 项目
- **Playwright MCP 经常断连**，不可靠；优先用 `curl` / Python 脚本 / Bash 工具验证
- **html-to-image 跨域 CSS 警告**是正常的（Google Fonts 不能被 CSSOM 读取），不影响图片生成
- **图片命名** `images/{id}.png`，id 和 cats.json 的 id 字段一致

---

## 📝 近期 commit 历史

```
2bc4398 feat(v4): 滚动封面 + 雷达图下移 + 内联分享图 + 内容锐化
9b77be6 feat(v3): 像素封面 + 每题独立头像/旁白 + 自动跳题 + 雷达图 + 结果图下载
588831e feat(ui): 重构为极简像素风
d162338 feat(questions): 重写15题, 注入SBTI风格
aeb9f58 init: CATTI 猫格测试 v1
```

**未 commit 的改动**（在 working tree 里）：
- `data/cats.json`: SBTI 风格全量重写 + 加 breed 字段
- `app.js`: DIM_LABELS 改 SBTI 化 + name_title 后加空格
- `docs/CATS_PROFILES.md`: 新增 715 行档案手册

---

## 🚀 新对话启动建议

新对话开始时，先说：

> "继续 CATTI 项目任务。项目路径 `/Users/leo/Desktop/性格测试/猫猫/catti/`。
> 读一下 `docs/HANDOFF.md` 了解当前进度，然后完成里面第 5 项「结果页加 meta 信息行」的改动。改完给我过目再 push。"

Agent 会读这个文件，然后：
1. 读 HANDOFF.md
2. 做 meta 行改造（HTML + CSS + JS + share card）
3. 本地跑 http.server + 截图验证
4. 给你看改后效果
5. 你确认后再 commit + push
