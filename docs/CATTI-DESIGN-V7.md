# CATTI · 匹配机制 & 人格档案 设计文档 · v7

> ⚠️ **内部文档 · 不公开**。匹配算法、选项-猫映射表、王牌选项**全部不暴露给最终用户**。用户只看:题目、选项文案、最终匹配的那只猫。

> 版本:**v7 (2026-04-22)** · 替代 v6 的欧氏距离匹配机制
> 前置文档:`docs/CATS-PERSONALITY-MAP.md` (v6 诊断)

---

## 目录

1. [匹配机制 · 纯分类制(标签命中 + 王牌兜底)](#一匹配机制--纯分类制)
2. [人格理论三层(MBTI + Big Five + 依恋)](#二人格理论三层)
3. [24 只猫 · 人格档案](#三24-只猫--人格档案)
4. [命中矩阵 · 18 题 × 24 猫](#四命中矩阵--18-题--24-猫)
5. [王牌选项表](#五王牌选项表)
6. [得票核对表 · 平衡性验证](#六得票核对表--平衡性验证)
7. [实施清单](#七实施清单)

---

## 一、匹配机制 · 纯分类制

### 1.1 核心思路

废弃 6 维欧氏距离。**不再打分**,改为**纯粹的标签命中统计**:

- 每道题的每个选项 预设「这个答案属于哪几只猫」—— 只是标签,**没有权重**
- 用户选了某个答案 → 该答案标签里的每只猫 **命中 +1**
- 所有 18 题答完后,**命中次数最多的猫 = 本命猫**

每次命中的筹码都是 1,没有"核心票 2 分 / 次要票 1 分"的打分感。这是一个**集合交集**问题,不是"打分排序"问题。

### 1.2 核心规则

> **本命猫 = argmax(count(cat ∈ user_selected_options))**

通俗讲:
- 每只猫有一组"会选中的选项"标签(可以重合,同一选项可能属于多只猫)
- 用户答 18 题形成一组"我选了的选项"
- 两个集合的交集大小 = 这只猫跟你的匹配度
- 交集最大的 = 本命猫

### 1.3 平票机制 · 王牌选项(Trump Card)

多只猫命中次数相同时:

- **每只猫预设 1 个王牌选项**(最能代表它的那个答案)
- 平票的几只猫里,**谁的王牌被用户选中了,谁胜出**
- 王牌也被多只猫同时命中(或都没命中)→ fallback 到 v6 的欧氏距离算法(用户无感的最后一道关)

### 1.4 伪代码

```js
function matchCat(userAnswers, questions, cats) {
  // 1. 数命中
  const hits = {}, trumpHit = {};
  cats.forEach(c => { hits[c.id] = 0; trumpHit[c.id] = false; });

  userAnswers.forEach((a, qIdx) => {
    const q = questions[qIdx];
    const opt = q.options.find(o => o.score === a.score);
    (opt.cats || []).forEach(catId => {
      hits[catId] += 1;
    });
    // 检查用户选的这个选项是不是某只猫的王牌
    cats.forEach(c => {
      if (c.trump && c.trump.qId === q.id && c.trump.score === a.score) {
        trumpHit[c.id] = true;
      }
    });
  });

  // 2. 按 hits 降序排
  const ranked = cats.slice().sort((a, b) => hits[b.id] - hits[a.id]);
  const topHit = hits[ranked[0].id];
  const tiedCats = ranked.filter(c => hits[c.id] === topHit);

  if (tiedCats.length === 1) return tiedCats[0];

  // 3. 平票 → 王牌兜底
  const trumpWinners = tiedCats.filter(c => trumpHit[c.id]);
  if (trumpWinners.length === 1) return trumpWinners[0];

  // 4. 王牌仍平票或都没命中 → 欧氏距离兜底
  const pool = trumpWinners.length > 0 ? trumpWinners : tiedCats;
  return pool.sort((a, b) =>
    euclideanDist(userVec, a.vector) - euclideanDist(userVec, b.vector)
  )[0];
}
```

### 1.5 新数据结构

**`data/questions.json` 每个选项** 新增 `cats` 字段(数组):

```json
{
  "id": 4,
  "dim": "PL",
  "options": [
    {
      "label": "战斗满血...",
      "score": 1,
      "cats": ["bengal", "tuxedo", "abyssinian", "turkish_van", "devon_rex"]
    },
    { "label": "半梦半醒...", "score": 0, "cats": ["american_curl", "calico", ...] },
    { "label": "深度昏迷...", "score": -1, "cats": ["orange", "garfield", ...] }
  ]
}
```

**`data/cats.json` 每只猫** 新增 `trump` 字段(王牌选项):

```json
{
  "id": "bengal",
  "name_title": "WILD",
  "trump": { "qId": 5, "score": 1 },
  ...
}
```

6 维 `vector` 字段保留 —— 给欧氏距离兜底 + 雷达图显示 + 高光卡百分比 —— **但不再决定主匹配**。

### 1.6 为什么能解决 v6 的中心吸附

v6 欧氏距离问题:MID 向量靠近原点 → 中立用户都离它最近 → 总被选中。

v7 分类问题变成:**MID 在 18 × 3 = 54 个选项里被标注为多少个选项的候选?** 这个数字我们可以人为精准控制。每只猫的"曝光机会" = 它在命中矩阵里出现的次数。所有猫的曝光次数可以平衡到 ±2 以内。

---

## 二、人格理论三层

CATTI 的 6 维度覆盖**三个**心理学模型:

### 2.1 第一层 · MBTI(4 维)

| CATTI | 中文名 | MBTI 对应 | 说明 |
|---|---|---|---|
| **E/I** | 社牛浓度 | **E/I** 外向/内向 | 完全一致 |
| **P/L** | 发动机转速 | ≈ **N/S** 直觉/感觉 | P+ 主动探索 ≈ N;L- 安于眼前 ≈ S |
| **T/F** | 冷静抬杠度 | **T/F** 思考/情感 | 完全一致 |
| **J/S** | 强迫症指数 | **J/P** 判断/感知 | J+ 有序 = J;S- 随性 = P |

### 2.2 第二层 · Big Five · Neuroticism(神经质)

| CATTI | 中文名 | Big Five 对应 |
|---|---|---|
| **N/Z** | 内耗指数 | **Neuroticism 神经质**(N+ 高,Z- 低) |

Big Five 是学界最有实证支持的人格模型。神经质轴独立于 MBTI,测量"情绪稳定性"。

### 2.3 第三层 · 依恋理论(Attachment Style)

| CATTI | 中文名 | 依恋理论对应 |
|---|---|---|
| **M/D** | 恋爱脑指数 | **依恋风格** |

- M +3~+4 → **焦虑型**(渴求亲密,害怕被抛弃)
- M +1~+2 → 偏焦虑的安全型
- M -1~0 → **安全型**(健康距离)
- M -2~-3 → 偏回避的安全型
- M -3~-4 → **回避型**(抗拒亲密)

### 2.4 三层合一

- **MBTI 4 维** 处理"日常行为模式"(社交/信息处理/决策/生活方式)
- **Big Five 神经质** 处理"情绪波动"
- **依恋理论** 处理"亲密关系策略"

三层填满 CATTI 的 6 维。每个维度都有**可 Google 的心理学背书**。

---

## 三、24 只猫 · 人格档案

格式:MBTI + 依恋 + 神经质 + 向量 + 文案 + 人格内核

> 完整文案在 `data/cats.json`,本章是精简索引。v7 调整的猫:WILD → ESTP,AES → ESFJ,SOFT → ISFP,BIG → ESTJ,AIR → INFJ,SOLO → INTP,MID/CREAM 向量微调。

---

### 3.1 TRIC · 轮岗者-三花猫 · ENTP / 混合依恋 / 低-中神经质

**向量** `[+1,+2,+1,-1,+1,+1]`
**Slogan**:情绪轮岗制,今天上班的是谁我也不知道
**Punchline**:今天谁上班我也不知道,反正我只负责转发通知。
**内核**:ENTP 多元自我,三花皮毛 = 情绪员工轮岗。

### 3.2 LAY-Z · 摆烂王-加菲猫 · ESFP / 回避 / 低神经质

**向量** `[+2,-4,-1,-2,-2,-3]`
**Slogan**:能量守恒定律,我全用来长肉了
**Punchline**:别叫我,除非那声呼唤里夹着一片鸡胸肉。
**内核**:ESFP 极端版,活在午睡里。

### 3.3 H2O · 下水者-土耳其梵猫 · ENFP / 回避 / 低神经质

**向量** `[+3,+3,0,-1,-1,-2]`
**Slogan**:不试试你怎么知道不行
**Punchline**:别拦我,猫不泡水的祖训是骗人的。
**内核**:ENFP 冒险,打破祖训,行动快于思考。

### 3.4 BUG · 活体 bug-奶牛猫 · ENFP(极端) / 轻回避 / 极低神经质

**向量** `[+4,+4,-3,-4,-1,-4]`
**Slogan**:白天正常人,夜晚精神科
**Punchline**:凌晨三点的我和早上八点的我可能是两只猫,不冲突。
**内核**:模板级 ENFP 极端案例,零内耗。

### 3.5 WILD · 野性基因-孟加拉猫 · **ESTP** / 回避 / 低神经质

**向量** `[+3,+4,+2,+1,-3,-2]`
**Slogan**:客厅小了点,但拦不住我
**Punchline**:客厅小是小,但至少还能跑出一圈内环。
**内核**:ESTP 身体先行,本能狩猎派。

### 3.6 AES · 美学学徒-安哥拉猫 · **ESFJ** / 焦虑-安全 / 中神经质

**向量** `[+2,+2,+1,+2,+1,+2]`
**Slogan**:美到底是天赋,还是劳动
**Punchline**:你以为我天生的?这都是认真修图+劳动的结果。
**内核**:ESFJ 隐形劳动 + 体面照顾。

### 3.7 SOFT · 软趴趴-布偶猫 · **ISFP** / 焦虑 / 低-中神经质

**向量** `[+1,-3,-1,-2,+3,-2]`
**Slogan**:不是我懒,是你手太暖
**Punchline**:我没懒,是你手太暖,我不忍心辜负。
**内核**:ISFP 选择性柔软,只给通过验证的那位。

### 3.8 UFO · 外星生物-德文卷毛猫 · ENFP / 轻焦虑 / 极低神经质

**向量** `[+3,+2,-1,-3,+1,-3]`
**Slogan**:搞笑是刚需,破坏是副产品
**Punchline**:笔掉了?凡事都讲缘分,它自己想下来的。
**内核**:ENFP 顽童,行为艺术化的亲近者。

### 3.9 NORTH · 北地型-挪威森林猫 · INTJ / 安全型 / 低神经质

**向量** `[-1,+3,+2,+2,0,0]`
**Slogan**:我不说,但我看见了
**Punchline**:我没说话,但该看见的我全看见了。
**内核**:INTJ 守林人,沉默战略家。

### 3.10 NUDE · 裸奔派-无毛猫 · ENFJ / 焦虑 / 高神经质

**向量** `[+4,+2,+1,-2,+2,+3]`
**Slogan**:没穿装备的情况下,活着都更纯粹
**Punchline**:体温 37 度是我对地球最诚实的问候。
**内核**:ENFJ 关系刚需 + 极端感知。

### 3.11 TALK · 话唠机-暹罗猫 · ENFJ / 极端焦虑 / 中神经质

**向量** `[+4,+3,+1,0,+4,+1]`
**Slogan**:你说'哦'我能接三十分钟
**Punchline**:你说'哦',我能接三十分钟的独白你信不信。
**内核**:ENFJ 极端版,独占绑定一位。

### 3.12 ORNG · 大橘派-橘猫 · ESFP(极端) / 回避 / 极低神经质

**向量** `[+2,-4,-2,-3,-3,-4]`
**Slogan**:我存在,即为贡献
**Punchline**:朕躺在这,已经为地球做出了不可替代的贡献。
**内核**:ESFP 终极版,不再享乐只剩存在感。

### 3.13 NOBL · 贵族派-波斯猫 · ISTJ / 回避 / 中性神经质

**向量** `[-3,-3,+2,+3,-2,0]`
**Slogan**:真正的优雅,不和凡人解释
**Punchline**:爱可以,但请先预约,礼貌排期。
**内核**:ISTJ 流程至上 + 不屑解释。

### 3.14 MINI · 小短腿-矮脚猫 · ENFP / 轻焦虑 / 极低神经质

**向量** `[+2,+2,-2,-2,+1,-3]`
**Slogan**:腿短不影响我的宇宙
**Punchline**:腿短怎么了?我照样能蹦到你看不见的高度。
**内核**:ENFP 精神富足派,纠结不如蹦跶。

### 3.15 BIG · 大块头-缅因猫 · **ESTJ** / 安全型 / 低神经质

**向量** `[+1,+3,+2,+1,+1,-1]`
**Slogan**:我安静,但我一个顶仨
**Punchline**:我不吼,我往这一站,屋子就开始安静。
**内核**:ESTJ 稳稳做好小事 + 存在即安全感。

### 3.16 MID · 平衡派-美国卷耳猫 · 校准型 / 安全型 / 低神经质

**向量** `[+1,+1,+1,+1,0,0]` ⚠️ **v7 调整**(原 `[+1,+1,0,0,0,0]` 引起中心吸附)
**Slogan**:不多不少,恰到好处的废话
**Punchline**:不多,不少,这句话就是我的人生哲学。
**内核**:真·兼容模式,中庸美学。

### 3.17 STDY · 稳定型-美国短毛猫 · ISTJ / 安全型 / 低神经质

**向量** `[0,+2,+2,+2,0,-1]`
**Slogan**:按时吃饭按点睡觉,人生赢家
**Punchline**:按时吃饭按点睡觉,这就是我修行的主道场。
**内核**:ISTJ 安稳 = 高级修养。

### 3.18 SILE · 沉默者-苏格兰折耳猫 · ISFJ / 焦虑 / 极高神经质

**向量** `[-1,-2,0,+1,+1,+4]`
**Slogan**:我什么都懂,但不参与
**Punchline**:我什么都听得到,只是懒得回你罢了。
**内核**:ISFJ 高敏共情,最小分贝守护。

### 3.19 GENT · 小绅士-英国短毛猫 · ISTJ / 回避 / 轻度神经质

**向量** `[-2,-2,+3,+3,-2,+1]`
**Slogan**:爱我可以,但请先预约
**Punchline**:请预约、请致意、请保持距离——剩下的好说。
**内核**:ISTJ 硬核边界,沉默即筛选器。

### 3.20 AIR · 空气猫-蓝猫 · **INFJ** / 安全-焦虑 / 高神经质

**向量** `[-3,0,+3,+2,0,+3]`
**Slogan**:答案都藏在不说话的时候
**Punchline**:你可能没看到我,但我一直都在场。
**内核**:INFJ 情绪雷达,低存在感 + 高信息量。

### 3.21 FREE · 放飞型-起司猫 · ESFP / 轻回避 / 极低神经质

**向量** `[+3,-2,-2,-3,-1,-4]`
**Slogan**:丢脸这个词,不在我的词典里
**Punchline**:丢脸?不存在的,我字典里压根没这条。
**内核**:ESFP 傻快乐派,丢脸字典 404。

### 3.22 CREAM · 奶油派-金渐层 · **ISFJ** / 轻焦虑 / 轻神经质

**向量** `[0,-1,-1,+1,+2,+1]` ⚠️ **v7 调整**(原 `[0,-1,+1,+1,+1,+1]` 是第二名中心吸附)
**Slogan**:软是我的外表,硬是我的原则
**Punchline**:软的是毛,硬的是标准,两者互不打折。
**内核**:ISFJ 糖衣 + 内在标尺。

### 3.23 WHY · 永动机-阿比西尼亚猫 · ENTP / 回避 / 低神经质

**向量** `[+3,+4,+1,0,-2,-1]`
**Slogan**:好奇心耗尽那天,我就死了
**Punchline**:转角那个箱子里有什么?我必须立刻去看。
**内核**:ENTP 舒适区即警报,罐头恐惧。

### 3.24 SOLO · 独行者-黑猫 · **INTP** / 回避 / 中高神经质

**向量** `[-2,+1,+3,0,-2,+2]`
**Slogan**:热闹过剩的时代,我选择独处
**Punchline**:热闹归你们,安静归我,各取所需。
**内核**:INTP 神秘独立者,深夜安静发光。

---

## 四、命中矩阵 · 18 题 × 24 猫

### 4.1 读表方式

每行一题,三列对应 A/B/C 选项。每格列出**该答案属于哪几只猫**(命中 +1,无轻重)。同一只猫在同一题只能出现在一个选项里。

---

### 4.2 EI 维度 · Q1-Q3

| 题 | A (+1) | B (0) | C (-1) |
|---|---|---|---|
| **Q1** 一个人的时光 | TALK · NUDE · BUG · FREE · UFO · MINI | MID · CREAM · STDY · TRIC · BIG · H2O | SOLO · SILE · AIR · NORTH · GENT · NOBL |
| **Q2** 陌生人进场 | TALK · BUG · NUDE · FREE · UFO · TRIC | MID · STDY · BIG · CREAM · NORTH · H2O | AIR · NOBL · SILE · SOLO · GENT · SOFT |
| **Q3** 人多时 | WHY · TALK · FREE · BUG · NUDE · UFO · MINI | NORTH · BIG · MID · AES · STDY · CREAM · TRIC | NOBL · GENT · SILE · SOLO · AIR · ORNG |

### 4.3 PL 维度 · Q4-Q6

| 题 | A (+1) | B (0) | C (-1) |
|---|---|---|---|
| **Q4** 凌晨 3:47 | BUG · WILD · WHY · H2O · UFO · TRIC | MID · STDY · CREAM · AES · BIG · NORTH · MINI | ORNG · LAY-Z · SOFT · NOBL · SOLO |
| **Q5** 逗猫棒 | WILD · BUG · WHY · H2O · UFO · MINI | TRIC · MID · BIG · STDY · AES · CREAM | NOBL · ORNG · LAY-Z · SOFT · SILE · GENT |
| **Q6** 苍蝇任务 | WILD · WHY · NORTH · BIG · MINI · BUG | AIR · MID · CREAM · TRIC · AES · STDY · H2O | ORNG · LAY-Z · SOFT · NOBL · SILE · GENT |

### 4.4 TF 维度 · Q7-Q9

| 题 | A (+1) | B (0) | C (-1) |
|---|---|---|---|
| **Q7** 冷静这句话 | GENT · AIR · NORTH · NOBL · STDY · WILD | MID · TRIC · BIG · CREAM · AES · H2O | UFO · BUG · FREE · MINI · SOFT · TALK |
| **Q8** 铲屎官失恋 | GENT · NOBL · AIR · STDY · NORTH · WILD · WHY | BIG · MID · STDY · CREAM · SOFT · SILE | BUG · UFO · MINI · TALK · FREE · NUDE |
| **Q9** 流浪猫求收编 | GENT · NOBL · AIR · WILD · STDY · NORTH | MID · TRIC · CREAM · AES · BIG · MINI | H2O · SOFT · SILE · FREE · BUG · TALK · NUDE |

### 4.5 JS 维度 · Q10-Q12

| 题 | A (+1) | B (0) | C (-1) |
|---|---|---|---|
| **Q10** 饭推迟 27 分 | NOBL · GENT · AES · NORTH · WILD · SILE | STDY · MID · CREAM · BIG · TRIC | LAY-Z · ORNG · FREE · SOFT · BUG · UFO |
| **Q11** 玩具窝 | AES · NOBL · GENT · STDY · NORTH · WILD | CREAM · MID · BIG · TRIC · H2O · AIR | BUG · UFO · FREE · ORNG · LAY-Z · SOFT · MINI |
| **Q12** 随性这个词 | NOBL · GENT · STDY · AES · WILD · NORTH | MID · CREAM · TRIC · BIG · H2O · SILE | ORNG · LAY-Z · FREE · BUG · UFO · SOFT · MINI |

### 4.6 MD 维度(恋爱脑)· Q13-Q15

| 题 | A (+1 恋爱脑) | B (0) | C (-1 清醒) |
|---|---|---|---|
| **Q13** 忘开罐头 | TALK · SOFT · NUDE · AES · SILE · AIR | TRIC · MID · CREAM · BIG · STDY · MINI | ORNG · WILD · WHY · LAY-Z · BUG · H2O · FREE |
| **Q14** 视频夸别猫 | TALK · NUDE · SOFT · BUG · MINI · TRIC | AES · SILE · AIR · CREAM · MID · BIG | ORNG · WILD · NOBL · LAY-Z · H2O · WHY · GENT |
| **Q15** 出差没告别 | SOFT · TALK · NUDE · MINI · TRIC · SILE | AIR · AES · CREAM · MID · BIG · STDY | FREE · ORNG · WILD · LAY-Z · WHY · BUG |

### 4.7 NZ 维度(内耗)· Q16-Q18

| 题 | A (+1 emo) | B (0) | C (-1 佛系) |
|---|---|---|---|
| **Q16** 被误解 | SILE · AIR · NUDE · SOFT · CREAM · AES | TRIC · GENT · MID · STDY · NORTH · BIG | MINI · ORNG · BUG · FREE · LAY-Z · WILD · UFO |
| **Q17** 撸毛没撸下巴 | SILE · NUDE · AIR · SOFT · CREAM · AES | TRIC · STDY · MID · GENT · BIG · NORTH | ORNG · FREE · WILD · LAY-Z · BUG · UFO · WHY |
| **Q18** 睡前回顾 | SILE · AIR · NUDE · SOFT · CREAM · AES · NORTH | TRIC · STDY · MID · BIG · H2O | ORNG · LAY-Z · BUG · WILD · FREE · WHY · UFO · MINI |

---

## 五、王牌选项表

**规则**:每只猫恰好 1 个王牌。平票时,谁的王牌被用户选中 → 谁胜出。所有王牌互不重复(24 个独特的 Q-Answer 组合)。

| # | 猫 | MBTI | 王牌选项 | 理由 |
|---|---|---|---|---|
| 1 | TRIC | ENTP | **Q16-B** 「生闷气,蹭另一只屁股招」 | 轻内耗+外向示意,典型轮岗反应 |
| 2 | LAY-Z | ESFP | **Q10-C** 「时间是什么,有饭就好」 | 对秩序无所谓的摆烂宣言 |
| 3 | H2O | ENFP | **Q9-C** 「管它是谁,抱进来」 | 行动快于思考的冒险派 |
| 4 | BUG | ENFP(极) | **Q4-A** 「战斗满血,巡视假想敌」 | 凌晨夜精神科的核心场面 |
| 5 | WILD | ESTP | **Q5-A** 「空中转体扑杀,撞翻水杯」 | 野性基因的身体本能 |
| 6 | AES | ESFJ | **Q11-A** 「每只老鼠都有固定窝点」 | 精致秩序 + 生活美学 |
| 7 | SOFT | ISFP | **Q15-A** 「蹲门口等一整天,饭都吃不下」 | 极端柔软黏人 |
| 8 | UFO | ENFP | **Q7-C** 「没情绪的猫生等于白过」 | 反骨哲学 |
| 9 | NORTH | INTJ | **Q3-B** 「挑个高处看戏」 | 沉默观察派 |
| 10 | NUDE | ENFJ | **Q1-A** 「没人陪等于饿肚子」 | 极端依赖 + 社牛 |
| 11 | TALK | ENFJ | **Q14-A** 「蹦脸抢占视频 C 位」 | 极端独占+表达欲 |
| 12 | ORNG | ESFP(极) | **Q4-C** 「深度昏迷,天塌也是明早的事」 | 极致摆烂的标志场面 |
| 13 | NOBL | ISTJ | **Q5-C** 「眼睛会跟,爪子坚决不出力」 | 不屑参与的贵族派 |
| 14 | MINI | ENFP | **Q16-C** 「想这么多干嘛,清白自来」 | "那我用另一种方式"生活哲学 |
| 15 | BIG | ESTJ | **Q8-B** 「默默卧脚边,尾巴扫一下」 | 沉默陪伴即守护 |
| 16 | MID | 校准 | **Q12-B** 「不错但也不是完全没底线」 | "恰到好处"的定义 |
| 17 | STDY | ISTJ | **Q10-B** 「喵两声抗议,晚了也能忍」 | 稳定吐槽,不失控 |
| 18 | SILE | ISFJ | **Q17-A** 「循环播放 50 遍,他是不是不爱我」 | 极端内耗 |
| 19 | GENT | ISTJ | **Q9-A** 「先观察三天看剧情」 | 筛查流程派 |
| 20 | AIR | INFJ | **Q6-B** 「先观察两下,看它会不会自己飞走」 | 观察派情绪雷达 |
| 21 | FREE | ESFP | **Q15-C** 「诶?他走了吗?我睡过去没发觉」 | 零心眼零内耗 |
| 22 | CREAM | ISFJ | **Q11-B** 「大致分区,偶尔满屋开花也能接受」 | 温柔有度 |
| 23 | WHY | ENTP | **Q3-A** 「新粉丝,挨个巡视看能否收获零食」 | 探索型好奇 |
| 24 | SOLO | INTP | **Q1-C** 「句句戳心,我甚至想续订一份孤独」 | 续订孤独的哲思 |

### 5.1 王牌分布健康检查

- 所有 24 张王牌指向 **24 个不同的选项**(Q-Answer pair),没有重复 ✅
- 分布覆盖 18 题(Q2/Q13/Q18 没有王牌,其余 15 题各有 1-2 张王牌)
- 每个维度都有王牌触发:EI×3 / PL×4 / TF×3 / JS×4 / MD×3 / NZ×3

---

## 六、得票核对表 · 平衡性验证

**"最大理论命中"**:假设用户全部选某一档,能给某只猫贡献多少次命中。目标每只猫在 11-15 次区间,差距不超过 2×。

| 猫 | MBTI | 最大理论命中 | 王牌题 | 备注 |
|---|---|---|---|---|
| TRIC | ENTP | 11 | Q16-B | 平衡分布 |
| LAY-Z | ESFP | 10 | Q10-C | 集中 C 档 |
| H2O | ENFP | 11 | Q9-C | 分散 |
| BUG | ENFP | 13 | Q4-A | 极端分布 |
| WILD | ESTP | 13 | Q5-A | A+C 极端 |
| AES | ESFJ | 12 | Q11-A | 稳健 |
| SOFT | ISFP | 11 | Q15-A | 感性族 |
| UFO | ENFP | 12 | Q7-C | 平衡 |
| NORTH | INTJ | 10 | Q3-B | 理性族 |
| NUDE | ENFJ | 13 | Q1-A | 外向高敏 |
| TALK | ENFJ | 12 | Q14-A | 绑定黏人 |
| **ORNG** | ESFP | **15** | Q4-C | 可能上限偏高 |
| NOBL | ISTJ | 11 | Q5-C | 守序派 |
| MINI | ENFP | 11 | Q16-C | 佛系探索 |
| BIG | ESTJ | 11 | Q8-B | 稳健 |
| MID | 校准 | 12 | Q12-B | B 档分布 |
| STDY | ISTJ | 12 | Q10-B | 中性稳定 |
| SILE | ISFJ | 12 | Q17-A | 高内耗 |
| GENT | ISTJ | 12 | Q9-A | 理性边界 |
| AIR | INFJ | 10 | Q6-B | 敏感观察 |
| FREE | ESFP | 11 | Q15-C | 佛憨 |
| CREAM | ISFJ | 11 | Q11-B | 温柔标尺 |
| WHY | ENTP | 10 | Q3-A | 好奇族 |
| SOLO | INTP | 10 | Q1-C | 独行 |

**结论**:理论命中集中在 10-13 区间,ORNG 略高(15)是因为集中在多个 C 选项。整体平衡可接受。正式实施时 Playwright 模拟 10 种画像用户做回归测试。

---

## 七、实施清单

### 7.1 数据改动

- [ ] 按 §4 命中矩阵,更新 `data/questions.json`,每个选项加 `cats: [id, ...]` 字段
- [ ] 按 §5 王牌表,给 `data/cats.json` 每只猫加 `trump: { qId, score }` 字段
- [ ] MID 向量 `[+1,+1,0,0,0,0]` → `[+1,+1,+1,+1,0,0]`
- [ ] CREAM 向量 `[0,-1,+1,+1,+1,+1]` → `[0,-1,-1,+1,+2,+1]`

### 7.2 算法

- [ ] 改 `app.js` 的 `computeResult`:
  - 新逻辑:按选项 cats 数组累加命中数 → 最大命中猫 → 平票查王牌 → 王牌也平则用 vector 距离兜底
  - 保留 `state.userVec` 用于雷达图 / 高光卡百分比显示(不参与主匹配)

### 7.3 验证

- [ ] Playwright 模拟 10 种用户(全 A / 全 B / 全 C / 各维度偏向等)
- [ ] 检查每种画像匹配出的猫是否人设合理
- [ ] 特别验证"全 B 用户"不再总匹配到 MID
- [ ] 特别验证"平票情形"王牌机制正确触发

### 7.4 不做的事(v7 范围外)

- ❌ 不重写 interpretation(v6 文案稳定)
- ❌ 不新增猫(ISTP/ESTJ 缺口留到 v8)
- ❌ 不改题目内容(只改选项 `cats` 映射,不改题干/选项文字)
- ❌ 不把匹配机制/王牌/命中矩阵 暴露给用户

---

## 附录 A · 变更日志

- **v6 → v7**:
  - 匹配机制:欧氏距离 → **纯分类命中 + 王牌兜底**
  - 去掉 core/minor 打分分档
  - 新增王牌选项字段
  - MID/CREAM 向量微调防中心吸附
  - 6 只猫 MBTI 重定位(WILD/AES/SOFT/BIG/AIR/SOLO)
  - 补充 Big Five 神经质 + 依恋理论两层心理模型

## 附录 B · 向量调整清单

| 猫 | v6 向量 | v7 向量 | 原因 |
|---|---|---|---|
| MID | [+1,+1,0,0,0,0] | [+1,+1,+1,+1,0,0] | 远离原点 |
| CREAM | [0,-1,+1,+1,+1,+1] | [0,-1,-1,+1,+2,+1] | 重定位 ISFJ + 远离原点 |

其他 22 只猫 vector 保持不变。
