# CATTI · 猫格测试 设计规范

日期：2026-04-22

## 概述
一个中文猫咪性格测试网站，参考SBTI/DogTI形态，15题问答匹配24只猫中的一只，给出slogan+标签+深度解读。

## 核心机制
4维度打分，每题3选项（±1/0），15题共15分钟贡献分布4+4+4+3。

### 维度
| 维度 | 两极 |
|---|---|
| E/I 社交电量 | 外向(+) / 内向(-) |
| P/L 行动驱动 | 主动(+) / 松弛(-) |
| T/F 决策思维 | 理智(+) / 感性(-) |
| J/S 生活节奏 | 有序(+) / 随性(-) |

### 分数映射
- 用户答完得到 `[E, P, T, J]` 4元素向量，每维度 ~[-4, +4]
- 每只猫有预设签名向量（如橘猫 = `[+3, -4, -2, -3]` 懒散外向感性随性）
- 欧氏距离找最近猫匹配

## 数据契约

### `data/questions.json`
```json
[
  {
    "id": 1,
    "dim": "EI",
    "text": "你从午睡中醒来...",
    "options": [
      {"label": "A. ...", "score": 1},
      {"label": "B. ...", "score": 0},
      {"label": "C. ...", "score": -1}
    ]
  }
]
```

### `data/cats.json`
```json
[
  {
    "id": "calico",
    "name": "三花猫",
    "image": "images/calico.png",
    "slogan": "一身三色，心有千机",
    "tags": ["独立", "机灵", "情绪稳定"],
    "vector": [2, 3, 1, -1],
    "interpretation": "300字猫视角解读..."
  }
]
```

## 24只猫列表（图片已准备）
calico, garfield, turkish_van, tuxedo, bengal, angora, ragdoll, devon_rex, norwegian_forest, sphynx, siamese, orange, persian, munchkin, maine_coon, american_curl, american_shorthair, scottish_fold, british_shorthair, russian_blue, cheese, golden_chinchilla, abyssinian, black_cat

## 视觉设计
- 配色：奶白 `#FDF8F2` / 温橘 `#F4A880` / 抹茶绿 `#A8C79C` / 巧克力棕 `#3D2E20`
- 字体：LXGW WenKai（霞鹜文楷）+ 系统字回退
- 进度：15个猫爪🐾，答一题点亮
- 动画：滑入+淡入；选中卡片缩放；结果页猫猫弹出
- 移动端：mobile-first，max-width 480px，>768px居中

## 页面结构（单HTML SPA）
```
.view-intro   首页 — 标题+一句话+开始按钮
.view-quiz    题目页 — 进度/题干/3选项
.view-result  结果页 — 猫图/名字/slogan/标签/解读/按钮
```

## 文件布局
```
catti/
  index.html
  styles.css
  app.js
  data/questions.json
  data/cats.json
  images/*.png (24)
  README.md
```

## 部署
GitHub 公开仓库 `catti` → Cloudflare Pages 静态托管

## 语言调性
温柔治愈+偶尔熬油。全程以"一只老猫在观察你"的视角，后半句突然拉近。题目情境化，避免"你是否常常..."的刻板问法。
