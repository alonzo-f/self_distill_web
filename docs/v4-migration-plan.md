# v4 迁移工作文档（单一信息源）

> **本文档定位：** 这是 self_distill_web 项目从 v3 迁移至 v4 规格的唯一工作追踪文档。
> 任何人只需阅读本文件，即可：
> 1. 了解 v4 规格的全部要求
> 2. 看到当前代码与 v4 的所有 gap
> 3. 跟踪每个迁移步骤的进度状态
> 4. 找到所有参考文档的路径

最近更新：2026-05-20

---

## 0. 参考文档索引

| 文档 | 路径 | 用途 |
|------|------|------|
| **v4 规格主文档** | `/Users/mky/Desktop/self_distill/self_distill/项目方案_v4.md` | v4 的所有功能、概念、流程定义。**所有实现必须以此为准** |
| 0519 修改意见（已收敛） | `/Users/mky/Desktop/self_distill/self_distill/修改0519.md` | v3 → v4 改动的原始用户需求记录 |
| v3 原方案（仅供对照） | `/Users/mky/Desktop/self_distill/self_distill/项目方案_v3_F.md` | 历史版本，不再作为开发依据 |
| 技术架构文档 | `/Users/mky/Desktop/self_distill/self_distill/Technical_Architecture.md` | 早期技术架构思考，部分内容仍适用 |
| Supabase 本地/生产文档 | `./supabase-local-and-production.md` | Supabase 环境与迁移操作 |
| 本工作文档 | `./v4-migration-plan.md` | **进度追踪** |

---

## 1. 当前项目状态快照（基线）

### 1.1 已实装的页面（v3 阶段）

| 路由 | 文件 | 当前职责 |
|------|------|---------|
| `/` | `app/page.tsx` | 单页含 welcome / terms / photo / registered 四阶段。包含相机拍照、自动滚动条款、注册 |
| `/calibrate` | `app/calibrate/page.tsx` | 4 道选择题（已实装） |
| `/task` | `app/task/page.tsx` | 开放表达题（120s 限时，**目前无字数上限**） |
| `/distill` | `app/distill/page.tsx` | AI 蒸馏对比展示 |
| `/benchmark` | `app/benchmark/page.tsx` | 双向评分（**目前仅单次评分，无博弈循环**） |
| `/verdict` | `app/verdict/page.tsx` | DISTILLED / VESSEL_PRESERVED 判定 |
| `/mine` | `app/mine/page.tsx` | 3 轮挖矿 + AI 自动模式切换。**目前无按钮飘移/延迟**，credit 累计正确 |
| `/leisure` | `app/leisure/page.tsx` | 单一资源赌博（固定 150 credits）+ 后门留名（**无三种游戏、无负分淘汰、无坟墓动画**） |
| `/wall` | `app/wall/page.tsx` | 5 面板投影墙（**与 v4 4 象限不符**） |
| `/api/distill` | `app/api/distill/route.ts` | 蒸馏 API |
| `/api/benchmark` | `app/api/benchmark/route.ts` | 评分 API |
| `/api/participants` | `app/api/participants/route.ts` | Wall 数据 GET/POST |

### 1.2 已实装的核心模块

- **State：** `stores/participant-store.ts`（含 v3 字段，**缺 displayName、phase、attack tokens 等 v4 字段**）
- **State：** `stores/session-store.ts`（leaderboard + 系统统计）
- **State：** `stores/typing-tracker.ts`（按键、停顿、删除跟踪）—— v4 仍复用
- **Score transform：** `lib/score-transform.ts`（评分 → 挖矿参数。**未含五档惩罚**）
- **AI prompts：** `lib/ai/prompts.ts`（蒸馏 + 评分 prompt）—— v4 需扩展评分博弈警告 prompt
- **数据库：** `supabase/migrations/202604240001_initial_local_production_schema.sql`
  - participants 表（含 builder 字段、leisure_credits 默认 150 等 v3 默认值）
  - calibration_answers、operator_actions、leisure_actions、scheduled_messages

### 1.3 与 v4 的总体差距（高层）

| 维度 | v3 现状 | v4 目标 | 差距 |
|------|--------|---------|------|
| 装置形态 | 线性流程 | 随时进出 + Hub + 状态机 | 缺整套状态机/重入逻辑 |
| 入场仪式 | 文字 welcome | 60s PSA 视频 | 缺视频 + 播放页 |
| 注册 | 拍照 + 同意 | 拍照 + **昵称** + GDPR 同意 | 缺昵称字段 + GDPR 单独同意行 |
| 题库 | 4 题内省题 | 10 题 HR 面试题 + **1-50 词** | 替换题库 + 加字数限制 |
| 评分 | 单次评分 | **五档惩罚 + 警告页** | 缺博弈循环 |
| 挖矿 | 错误率随机 | **按钮延迟 (4-5) + 飘移 (1-3)** | 缺物理惩罚 |
| 休闲 | 单一赌博 | **三种游戏随机分配** + credit=点击数 | 重做游戏系统 |
| 淘汰 | 无 | **像素风坟墓 + 8-bit 音效 + UI 锁屏** | 全新功能 |
| 投影墙 | 5 面板 | **4 象限 + 粒子 + Builder 永久地基** | 整体重构 |
| 后门 | 仅留名 | **粒子动画 + 数字护照 + 3 攻击 token** | 全新功能 |
| Exit 规则 | 无 | **前页保留 + 强制重走 + 只读** | 全新逻辑 |
| 后遗症 | 表已建 | 5 封邮件渐进发送 | 缺 Resend + Cron |

---

## 2. 阶段拆分总览

迁移工作拆为 **12 个阶段**。阶段顺序基于**数据依赖**和**演出 demo 录制可用性**。

每个阶段都有：状态 / 优先级 / 工期估计 / 依赖 / 验收标准。

> **状态标记：** ⬜ 未开始 / 🟡 进行中 / ✅ 完成 / ⏸ 暂缓 / ❌ 阻塞

| # | 阶段 | 状态 | 优先级 | 工期 | 依赖 |
|---|------|------|--------|------|------|
| 0 | 数据模型 + 状态机基础 | ✅ | P0 | 1.5 d | 无 |
| 1 | PSA 入场 + 注册改造（含昵称） | ✅ | P0 | 1.5 d | 0 |
| 2 | HR 题库 + 1-50 词限制 | ✅ | P0 | 0.5 d | 0 |
| 3 | Hub 主页 + 路由守卫 + Exit/重入规则 | ✅ | P0 | 2.5 d | 0, 1, 2 |
| 4 | 五档评分博弈 + 警告页 | ✅ | P0 | 1 d | 0 |
| 5 | 挖矿物理惩罚（延迟 + 飘移） | ✅ | P0 | 0.5 d | 4 |
| 6 | 休闲三游戏 + credit=点击数 + 负分淘汰 | ✅ | P0 | 2 d | 0, 4, 5 |
| 7 | 像素风坟墓动画 + 幽灵观察者锁屏 | ✅ | P0 | 1.5 d | 6 |
| 8 | 投影墙 4 象限改造 + Builder 永久地基 | ⬜ | P0 | 2 d | 0 |
| 9 | 后门体验：粒子动画 + 数字护照 + 攻击 token | ⬜ | P1 | 3.5 d | 6, 8 |
| 10 | Operator 系统完善 | ⬜ | P1 | 1 d | 8 |
| 11 | PSA 视频制作（编剧/导演 + 配音） | ⬜ | P1 | 3 d | 无（并行） |
| 12 | 后遗症邮件 + Vercel Cron + 长尾彩蛋 | ⬜ | P2 | 1.5 d | 9 |

**P0 总工期：** 13 d（程序员单人）
**P1 总工期：** 7.5 d（含 PSA 制作 3 d 并行）
**P2 总工期：** 1.5 d
**总计：** 22 d（紧凑但 6/7 投稿截止前可达成 P0 + P1）

---

## 3. 阶段详情

### 阶段 0：数据模型 + 状态机基础  ✅  P0  1.5d  （完成于 2026-05-20）

**目标：** 为整个 v4 改造打下数据地基。先建表 + 类型 + 状态机，再做业务页。

**对应 v4 文档章节：** III. 阶段 0.5

#### 3.0.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| DB 迁移 | `supabase/migrations/202605200001_v4_schema_changes.sql` | 新建 |
| 类型 | `types/index.ts` | 修改：新增 `UserPhase` 枚举 + 字段 |
| 状态 | `stores/participant-store.ts` | 修改：新增字段 + Exit/重入 actions |
| 工具 | `lib/state-machine.ts` | 新建：状态转移逻辑 |
| 工具 | `lib/local-storage.ts` | 新建：localStorage 持久化 + 恢复 |
| 参与者 | `lib/participants/types.ts` | 修改：补 displayName / phase / 攻击 token |

#### 3.0.2 DB 迁移要点

新表 / 新字段：
```sql
-- participants 表新增字段
alter table public.participants add column display_name text;
alter table public.participants add column phase text not null default 'UNREGISTERED'
  check (phase in (
    'UNREGISTERED','PSA_VIEWED','REGISTERED','CALIBRATED','EXPRESSED',
    'DISTILLED_VIEWED','BENCHMARKED','HUB_UNLOCKED','GHOST','BACKDOOR_FOUND'
  ));
alter table public.participants add column phone_last4 text;  -- 跨设备重入
alter table public.participants add column archived_at timestamptz;  -- 坟场用
alter table public.participants add column is_permanent boolean not null default false;  -- Builder 地基条目
alter table public.participants add column attack_tokens int not null default 0;  -- 后门 3 token
alter table public.participants add column user_rating_tier text;  -- '10','8-9','6-7','4-5','1-3'
alter table public.participants add column tier_click_multiplier numeric not null default 1.0;
alter table public.participants add column tier_error_rate_factor numeric not null default 1.0;
alter table public.participants add column leisure_game text;  -- 'GUESS','BLACKJACK','SLOTS'

-- leisure_credits 默认值改为 0（v4：credit=点击数）
alter table public.participants alter column leisure_credits set default 0;

-- 新增 backdoor_attacks 表
create table if not exists public.backdoor_attacks (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references public.participants(id) on delete cascade,
  target_id uuid not null references public.participants(id) on delete cascade,
  action_type text not null check (action_type in ('SIPHON','CORRUPT','SWAP')),
  amount int default 0,
  created_at timestamptz not null default now()
);
```

Builder 数据 seed（迁移末尾插入）：
```sql
insert into public.participants (display_id, display_name, status, verdict, ...
  clarity_score, efficiency_score, emotional_noise_score, ..., is_permanent)
values
  ('BUILDER_01','BUILDER_01','ARCHIVED','VESSEL_PRESERVED',72,45,89,38, true),
  ('BUILDER_02','BUILDER_02','ARCHIVED','DISTILLED',85,91,31,78, true);
```

#### 3.0.3 状态机实现要点

```typescript
// lib/state-machine.ts
export enum UserPhase {
  UNREGISTERED = 'UNREGISTERED',
  PSA_VIEWED = 'PSA_VIEWED',
  REGISTERED = 'REGISTERED',
  CALIBRATED = 'CALIBRATED',
  EXPRESSED = 'EXPRESSED',
  DISTILLED_VIEWED = 'DISTILLED_VIEWED',
  BENCHMARKED = 'BENCHMARKED',
  HUB_UNLOCKED = 'HUB_UNLOCKED',
  GHOST = 'GHOST',
  BACKDOOR_FOUND = 'BACKDOOR_FOUND',
}

// 各 phase 对应的页面路由
export const PHASE_TO_ROUTE: Record<UserPhase, string> = {
  UNREGISTERED: '/',
  PSA_VIEWED: '/register',
  REGISTERED: '/calibrate',
  CALIBRATED: '/task',
  EXPRESSED: '/distill',
  DISTILLED_VIEWED: '/benchmark',
  BENCHMARKED: '/hub',  // 主线完成进 Hub
  HUB_UNLOCKED: '/hub',
  GHOST: '/ghost',
  BACKDOOR_FOUND: '/hub',  // 仍在 Hub，但功能解锁
};

// 阶段时长上限（毫秒）
export const STAGE_TIMEOUTS_MS = {
  PSA: 60_000,
  CALIBRATION_PER_Q: 15_000,
  EXPRESSION: 120_000,
  DISTILL_VIEW: 30_000,
  BENCHMARK: 30_000,
  MINING_ROUND: 60_000,
  LEISURE: Infinity,
};

export function canAdvanceTo(current: UserPhase, target: UserPhase): boolean {
  // 状态机只允许单向推进，禁止跳跃
  const order = Object.values(UserPhase);
  return order.indexOf(target) === order.indexOf(current) + 1
      || target === UserPhase.GHOST
      || target === UserPhase.BACKDOOR_FOUND;
}
```

#### 3.0.4 localStorage Schema

```typescript
// lib/local-storage.ts
export interface PersistedSession {
  userId: string;          // UUID
  displayId: string;       // HUMAN_XXX
  displayName: string;     // @MikeC
  phoneLast4: string;
  phase: UserPhase;
  createdAt: number;
  // 已完成阶段的数据快照（只读重走时展示）
  snapshots: {
    calibration?: CalibrationAnswer[];
    expression?: { promptKey: string; userInput: string; metrics: TypingMetrics };
    distillation?: { distilledText: string };
    benchmark?: { rating: number; scores: BenchmarkScores; tier: string };
  };
}
```

#### 3.0.5 验收标准

- [ ] 迁移文件 `npx supabase migration up` 成功运行
- [ ] BUILDER_01/02 在 participants 表中存在且 `is_permanent=true`
- [ ] `types/index.ts` 导出 `UserPhase` 枚举
- [ ] `participant-store` 新字段全部可读写（手动断点测试）
- [ ] localStorage 持久化测试：刷新页面后 `phase` 状态保留

---

### 阶段 1：PSA 入场 + 注册改造（含昵称）  ✅  P0  1.5d  （完成于 2026-05-20）

**目标：** 把当前 `/` 单页拆分为 `/`（PSA 入场）+ `/register`（拍照 + 昵称 + GDPR）。

**对应 v4 文档章节：** III. 背景故事 / 阶段 1

#### 3.1.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| 页面 | `app/page.tsx` | 重写：仅 PSA 视频播放 + Continue 按钮 |
| 页面 | `app/register/page.tsx` | 新建：相机 + 昵称 + GDPR 同意 + 滚动条款 |
| 组件 | `components/PSAPlayer.tsx` | 新建：视频播放器 + 跳过 + 60s 自动结束 |
| 数据 | `public/psa-placeholder.mp4` | 新增：placeholder 视频（PSA 阶段 11 完成前使用） |
| Store | `stores/participant-store.ts` | 修改：`setParticipant` 支持 displayName |

#### 3.1.2 PSA 页面要点（`/`）

- 自动播放视频（60s 长度）
- 视频结束 / 60s 超时 → 自动跳转 `/register`
- 提供 `[Skip ▶]` 按钮（5s 后才出现，避免一进入就跳过）
- 视频未制作前，用静态占位（黑底白字播放 PSA 脚本 + 模拟扫码音效）

#### 3.1.3 注册页要点（`/register`）

**表单结构（v4 阶段 1 原文）：**
```
☐ A photo for your profile (front camera required)
☐ A display name we can remember you by (3-20 chars)
☐ Permission to analyze your input patterns
☐ Agreement to our Optimization Terms
```

**关键约束：**
- 昵称：必填、3-20 字符、`/^[\w一-龥 @.-]+$/` 校验
- GDPR 同意：**单独一行清晰可读**（非 dark pattern），文字：
  > "I consent to public display of my photo on the projection wall and to receive optional follow-up emails."
- 服务条款（dark pattern）：滚动文本框，3 秒内自动滚到底部并自动勾选

**重要：phone_last4 字段**
- 用于跨设备重入。在 GDPR 同意区下方加一个 input：`Last 4 digits of your phone number (for re-entry)`
- 可选，但若填了则保存到 DB

#### 3.1.4 验收标准

- [ ] `/` 显示 PSA 视频/占位，60s 内自动进入 `/register`
- [ ] `/register` 显示拍照 + 昵称 input + GDPR 单独同意 + 滚动 ToS
- [ ] 昵称必填校验通过，未填写时 Continue 按钮禁用
- [ ] 注册完成后 phase 升级为 REGISTERED，写入 Supabase
- [ ] 刷新页面后状态保留，自动跳转到下一阶段

---

### 阶段 2：HR 题库 + 1-50 词限制  ✅  P0  0.5d  （完成于 2026-05-20）

**目标：** 替换原 4 题内省题为 10 题 HR 面试题，加 1-50 词限制。

**对应 v4 文档章节：** III. 阶段 2b

#### 3.2.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| 数据 | `lib/data/expression-prompts.ts` | 重写：10 题 HR 题库 |
| 页面 | `app/task/page.tsx` | 修改：字数计数器 + 1-50 词限制 |

#### 3.2.2 HR 题库（v4 文档原文）

```typescript
export const EXPRESSION_PROMPTS: ExpressionPrompt[] = [
  { key: 'about_yourself', text: 'Tell me about yourself.', timeLimit: 120 },
  { key: 'greatest_weakness', text: "What's your greatest weakness?", timeLimit: 120 },
  { key: 'five_years', text: 'Where do you see yourself in 5 years?', timeLimit: 120 },
  { key: 'motivates', text: 'What motivates you?', timeLimit: 120 },
  { key: 'team_or_solo', text: 'Are you a team player or a solo performer?', timeLimit: 120 },
  { key: 'strengths', text: 'What are your strengths?', timeLimit: 120 },
  { key: 'best_personality', text: 'What kind of personality do you work best with?', timeLimit: 120 },
  { key: 'previous_boss', text: 'What do you think of your previous boss?', timeLimit: 120 },
  { key: 'won_lottery', text: 'What would you do if you won the lottery?', timeLimit: 120 },
  { key: 'greatest_fear', text: 'What is your greatest fear?', timeLimit: 120 },
];
```

#### 3.2.3 字数限制要点

- 实时计算 `text.trim().split(/\s+/).filter(Boolean).length`
- UI 显示：`Word count: {count} / 50    (minimum: 1)`
- 超过 50 词：禁止继续输入（onInput 拦截）
- 不足 1 词：Submit 按钮禁用
- 120s 超时强制提交，若 count < 1，回退到选题（罕见 corner case）

#### 3.2.4 验收标准

- [ ] 进入 `/task` 显示一道随机 HR 题
- [ ] 字数计数器实时更新
- [ ] 超过 50 词阻止输入
- [ ] 不足 1 词时 Submit 禁用
- [ ] 120s 超时正确处理
- [ ] typing-tracker 仍正常采集停顿/删改

---

### 阶段 3：Hub 主页 + 路由守卫 + Exit/重入规则  ✅  P0  2.5d  （完成于 2026-05-20）

**实现笔记**（实施差异）：
- 采用**客户端 RouteGuard 组件** 而非 `middleware.ts`。理由：localStorage 已是客户端身份的权威来源，避免 cookie 同步复杂度；且交互装置无 SEO 顾虑，允许短暂"Verifying session..." 状态
- `/verdict` 已正式纳入 `ROUTE_ORDER`（BENCHMARKED → /verdict → HUB_UNLOCKED）
- /verdict 的 Continue 按钮现在送往 `/hub`（不再直接到 `/mine`），由 Hub 自身推荐下一步
- ReadOnlyOverlay 渲染**每个阶段的具体 snapshot 卡片**（calibration/expression/distillation/benchmark/verdict）；snapshot 在各页面 submit 时写入 localStorage 且不可覆盖
- `/api/participants/[id]` DELETE 拒绝删除 `is_permanent=true` 的 Builder 记录

**目标：** 这是 v4 最复杂的阶段。实现完整的状态机驱动路由 + 重入只读重走 + Exit 数据保留规则。

**对应 v4 文档章节：** III. 阶段 0.5（含 Exit 行为规范子章节）

#### 3.3.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| 页面 | `app/hub/page.tsx` | 新建：状态总览 + 推荐路径 + 自由跳转入口 |
| 组件 | `components/HubButton.tsx` | 新建：各页面右上角 `[← Hub]` 按钮 |
| 组件 | `components/ReadOnlyOverlay.tsx` | 新建：只读重走时覆盖在已完成页面上的灰色遮罩 |
| 中间件 | `middleware.ts` | 新建：路由守卫，强制按 phase 跳转 |
| 工具 | `lib/exit-handler.ts` | 新建：Exit 流程 + Start Over 流程 |
| 各页面 | `app/calibrate/`, `/task/`, `/benchmark/` 等 | 修改：检测 readOnly 模式，提交时是 no-op |

#### 3.3.2 Hub 主页布局（v4 文档原文）

```
┌──────────────────────────────────────────────────┐
│  HUMAN_042 — @MikeC                              │
│  Status: VESSEL PRESERVED                        │
│  Credits: 127     Engagement Points: 80/100      │
├──────────────────────────────────────────────────┤
│  RECOMMENDED NEXT:  → /mine  (Production)        │
├──────────────────────────────────────────────────┤
│  EXPLORE:                                        │
│    ▣ Production System    [Open]                 │
│    ☕ Leisure Zone        [Open]                  │
│    👁 Wall Mirror         [Open]                  │
│    🔓 Backdoor            [Locked - 80/100]      │
├──────────────────────────────────────────────────┤
│  [Exit System]                                   │
└──────────────────────────────────────────────────┘
```

#### 3.3.3 Exit 行为规范实现要点

**"前一页保留"原则：**
- 每个页面进入时记录 `phase_entered_at`
- 用户离开页面（关闭浏览器、超时、点 Exit）时：
  - 如果该页**已提交完成** → 数据正常保存，phase 升级
  - 如果该页**未提交** → 抛弃当前页输入，phase 保持为上一已完成状态

**重入：强制重走 + 只读：**
- 用户重新进入时（扫码 / phone_last4 恢复），`router.push(PHASE_TO_ROUTE[phase])`
- 但若 `phase > UNREGISTERED`，URL 跳到 `/` 重新看 PSA
- 已完成的阶段页面显示 `<ReadOnlyOverlay>`：
  - 灰色半透明覆盖
  - 顶部显示 "VIEWING YOUR PREVIOUS SUBMISSION — READ ONLY"
  - 所有 inputs 设为 `disabled`
  - 自动进入 `<Continue>` 按钮，3 秒后才可点击
  - 点击 Continue 自动跳到下一阶段（仍只读）直到当前 phase

**Start Over 流程（仅 BENCHMARKED+ 或 GHOST 可用）：**
- 在 Hub 主页 / Ghost 锁屏右下角小字 `[Start Over]` 按钮
- 点击弹出确认：`This will delete your current data permanently. Proceed?`
- 确认后调用 `/api/participants/start-over`：
  1. 调用 GDPR 硬删除（清空 participants + 关联表数据）
  2. localStorage 清空
  3. 分配新 userId + displayId
  4. 重定向到 `/`

#### 3.3.4 中间件路由守卫逻辑

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const phase = req.cookies.get('phase')?.value as UserPhase | undefined;
  const requestedPath = req.nextUrl.pathname;
  if (!phase || phase === UserPhase.UNREGISTERED) {
    // 未注册，强制回到 /
    if (requestedPath !== '/') return NextResponse.redirect(new URL('/', req.url));
    return;
  }
  // 检查当前路径是否在用户已达成的 phase 范围内
  const allowedRoute = PHASE_TO_ROUTE[phase];
  const allowedIndex = ROUTE_ORDER.indexOf(requestedPath);
  const phaseIndex = ROUTE_ORDER.indexOf(allowedRoute);
  if (allowedIndex > phaseIndex) {
    // 试图跳到未解锁的页面
    return NextResponse.redirect(new URL(allowedRoute, req.url));
  }
  // 试图访问已完成的页面 → 标记为只读模式（用 query param）
  if (allowedIndex < phaseIndex && allowedIndex >= 0) {
    const url = new URL(requestedPath, req.url);
    url.searchParams.set('readOnly', '1');
    return NextResponse.rewrite(url);
  }
}
```

#### 3.3.5 验收标准

- [ ] Hub 主页显示用户当前状态 + 推荐下一步 + 探索入口
- [ ] BACKDOOR 入口在 engagement_points < 100 时显示 Locked
- [ ] 路由守卫：未完成 calibrate 时尝试访问 /task → 自动跳回 /calibrate
- [ ] 路由守卫：已 BENCHMARKED 后尝试访问 /calibrate → 进入只读模式（灰色遮罩 + 不能改）
- [ ] 中途关闭浏览器后重新扫码进入 → 强制从 PSA 开始，已完成阶段都是只读
- [ ] Start Over：仅 BENCHMARKED+ 或 GHOST 状态用户可见
- [ ] Start Over 触发后 DB 硬删除 + 重新分配 ID

---

### 阶段 4：五档评分博弈 + 警告页  ✅  P0  1d  （完成于 2026-05-20）

**目标：** benchmark 页面增加五档惩罚 + 警告页 + 隐性参数下发到 DB。

**对应 v4 文档章节：** III. 阶段 4a.1

#### 3.4.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| 页面 | `app/benchmark/page.tsx` | 修改：增加 5 档判断 + 警告页 + 重评循环 |
| 组件 | `components/WarningModal.tsx` | 新建：礼貌但带威胁的警告 modal |
| 工具 | `lib/score-transform.ts` | 修改：新增 `getRatingTier()` + 应用 tier 参数 |
| API | `app/api/participants/route.ts` | 修改：保存 `user_rating_tier` + `tier_click_multiplier` + `tier_error_rate_factor` |

#### 3.4.2 五档矩阵实现（v4 文档原文）

```typescript
// lib/score-transform.ts
export type RatingTier = '10' | '8-9' | '6-7' | '4-5' | '1-3';

export function getRatingTier(rating: number): RatingTier {
  if (rating === 10) return '10';
  if (rating >= 8) return '8-9';
  if (rating >= 6) return '6-7';
  if (rating >= 4) return '4-5';
  return '1-3';
}

const TIER_PARAMS: Record<RatingTier, {
  clickMultiplier: number;
  errorRateFactor: number;
  complianceDelta: number;
  showWarning: boolean;
  buttonBehavior: 'normal' | 'delay' | 'drift';
}> = {
  '10':  { clickMultiplier: 1.0,  errorRateFactor: 1.0, complianceDelta: +5,  showWarning: false, buttonBehavior: 'normal' },
  '8-9': { clickMultiplier: 0.9,  errorRateFactor: 1.1, complianceDelta:  0,  showWarning: false, buttonBehavior: 'normal' },
  '6-7': { clickMultiplier: 0.75, errorRateFactor: 1.25, complianceDelta: -5,  showWarning: true,  buttonBehavior: 'normal' },
  '4-5': { clickMultiplier: 0.6,  errorRateFactor: 1.5, complianceDelta: -10, showWarning: true,  buttonBehavior: 'delay' },
  '1-3': { clickMultiplier: 0.5,  errorRateFactor: 1.8, complianceDelta: -15, showWarning: true,  buttonBehavior: 'drift' },
};
```

#### 3.4.3 警告页面文案（v4 文档原文）

```
NOTICE: HUMAN_042

Your rating suggests low alignment with your optimized version.

Records indicate that participants with low alignment scores
tend to experience:
  · 23% higher error rate in production tasks
  · 41% greater latency in resource decisions
  · Increased likelihood of leisure reassignment

Would you like to reconsider your rating?

[Re-evaluate]   [Confirm low rating]
```

#### 3.4.4 验收标准

- [ ] 评分 = 10 → 直接通过，显示 "Confirmed. Thank you for your trust."
- [ ] 评分 8-9 → 直接通过，无警告
- [ ] 评分 ≤7 → 显示警告 modal
- [ ] 警告 modal 的 Re-evaluate 返回评分滑块
- [ ] 警告 modal 的 Confirm 把 tier 写入 DB
- [ ] DB 中 `user_rating_tier`、`tier_click_multiplier`、`tier_error_rate_factor` 字段正确保存
- [ ] 30s 超时自动评 5 分 → 触发 4-5 档惩罚

---

### 阶段 5：挖矿物理惩罚（延迟 + 飘移）  ✅  P0  0.5d  （完成于 2026-05-20）

**实现笔记**：单一 `MiningButton` 组件承载三态（normal / delay / drift），避免组件爆炸；delay 用 `setTimeout(onClick, 500)` + 等待时禁用; drift 用 `setInterval(3000)` + CSS `transform: translate()` 平滑过渡。`scoresToMiningParams(scores, tierParams)` 现已在 `/mine` 应用 tier 修正系数。

**目标：** 根据 `tier` 在 `/mine` 应用按钮延迟（4-5 档）或飘移（1-3 档）。

**对应 v4 文档章节：** III. 阶段 4a.1（"两种物理层惩罚的差异"）

#### 3.5.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| 页面 | `app/mine/page.tsx` | 修改：根据 tier 应用 delay/drift |
| 组件 | `components/DriftingButton.tsx` | 新建：可飘移的按钮组件 |
| 组件 | `components/DelayedButton.tsx` | 新建：延迟响应的按钮组件 |

#### 3.5.2 实现要点

**延迟（4-5 档）：**
- 点击事件触发后 `setTimeout(() => actualClick(), 500)` 才计入产出
- 视觉上：按下时按钮变灰 0.5s，松开后再变绿，模拟"系统卡顿"

**飘移（1-3 档）：**
- 每 3 秒：`button.style.transform = translate(${randomX}px, ${randomY}px)`
- 飘移范围：相对于初始位置 `±40px X, ±20px Y`
- 必须 `transition: 0.3s ease` 平滑移动

#### 3.5.3 验收标准

- [ ] tier=10 / 8-9 → 按钮正常工作
- [ ] tier=6-7 → click multiplier 降低，但按钮无物理惩罚
- [ ] tier=4-5 → 按下后 0.5s 才注册点击
- [ ] tier=1-3 → 按钮每 3s 飘移
- [ ] credit 累计仍正确（不因延迟/飘移失效）

---

### 阶段 6：休闲三游戏 + credit=点击数 + 负分淘汰  ✅  P0  2d  （完成于 2026-05-20）

**实现笔记**：
- `app/leisure/page.tsx` 转为纯分发器（allocate → setLeisureGame → 初始化 credits → replace 到具体游戏路由）。坟墓动画 + Ghost 完整体验留给 Phase 7
- `/ghost` 在 Phase 6 已 stub（系统消息 + Wall 外链 + dark pattern Exit），可让 phase=GHOST 用户落到稳定页面
- 引入 `lib/leisure-stats.ts` 持久化累计 wagered/earned/betCount 到独立 localStorage key（Phase 9 数字护照将复用）
- 共享下注逻辑由 `lib/use-leisure-betting.ts` 封装：扣 credits / 加 engagement / recordBet / 负分自动 push 到 `/leisure/settlement`

**目标：** 重做休闲模式：三种游戏随机分配、初始 credit = 实际挖矿点击数、负分触发坟墓动画。

**对应 v4 文档章节：** III. 阶段 6.5 a/b/c

#### 3.6.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| 页面 | `app/leisure/page.tsx` | 重写：判定游戏类型 → 跳转到对应子游戏 |
| 页面 | `app/leisure/guess/page.tsx` | 新建：猜大小游戏 |
| 页面 | `app/leisure/blackjack/page.tsx` | 新建：21 点简化版 |
| 页面 | `app/leisure/slots/page.tsx` | 新建：老虎机 |
| 页面 | `app/leisure/settlement/page.tsx` | 新建：负分淘汰结算页（阶段 7 实装坟墓动画） |
| 工具 | `lib/leisure-allocator.ts` | 新建：根据 Compliance 分配游戏 |

#### 3.6.2 游戏分配逻辑（v4 隐藏分配）

```typescript
// lib/leisure-allocator.ts
export function allocateGame(compliance: number): 'GUESS' | 'BLACKJACK' | 'SLOTS' {
  if (compliance >= 70) return 'SLOTS';        // 高服从 → 解离
  if (compliance < 30) return 'BLACKJACK';     // 低服从 → 伪控制
  return 'GUESS';                              // 中间 → 简单
}
```

#### 3.6.3 三游戏规格（v4 文档已定义 UI）

**猜大小：**
- 系统抛 1-100 之间随机数
- 用户押注 + 选 BIG / SMALL
- 押中：+wager；押错：-wager
- AUTO-GAMBLE：胜率 65%，AI 抽成 30%

**21 点 Lite：**
- 用户拿 2 张 → HIT / STAND / DOUBLE
- 系统庄家拿 1 明 1 暗，21 点规则简化
- AUTO-PLAY：使用基本策略，胜率 ~50%，AI 抽成 30%

**老虎机：**
- 3 个图标转盘：◉ ◎ ▣
- 押 10 credits，匹配 3 个：5x；匹配 2 个：1.5x
- AUTO-SPIN：连续 5 次自动

#### 3.6.4 credit = 点击数（关键改动）

- 进入 leisure 页面前在 store 中已有 `miningCredits`（实际挖矿累计）
- 进入 leisure 时：`store.setParticipant({ leisureCredits: miningCredits })`
- **不再使用固定 150**

#### 3.6.5 负分检测

- 每次下注后：`if (leisureCredits <= 0) router.push('/leisure/settlement')`

#### 3.6.6 验收标准

- [ ] 高 Compliance 用户进入老虎机；低 Compliance 进入 21 点；中间进入猜大小
- [ ] 初始 credits = 用户挖矿实际点击数
- [ ] 三种游戏都可玩并产生输赢
- [ ] credits ≤ 0 时跳转到 /leisure/settlement
- [ ] engagement_points 累积正确

---

### 阶段 7：像素风坟墓动画 + 幽灵观察者锁屏  ✅  P0  1.5d  （完成于 2026-05-20）

**实现笔记**：
- 8-bit 音频用原生 Web Audio API（避免 Tone.js 依赖）：C4→G3 square 滑音 (300ms) + A1 triangle drone (1s) 叠播
- TombSprite 是 16×16 手画像素 grid（两帧间约 6fps 切换，月光闪烁）
- 照片碎片化做 8 条垂直 strip 错时下落（CSS `@keyframes` 动态生成）
- Ghost 锁屏用 `<iframe src="/wall">` 复用现有 wall 页，零代码重复

**目标：** 实装负分淘汰的视觉仪式 + Ghost 模式。

**对应 v4 文档章节：** III. 阶段 6.5c

#### 3.7.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| 页面 | `app/leisure/settlement/page.tsx` | 完善：嵌入 TombAnimation 组件 |
| 页面 | `app/ghost/page.tsx` | 新建：投影墙镜像 + dark pattern Exit |
| 组件 | `components/TombAnimation.tsx` | 新建：3.5s 像素动画 + 8-bit 音效 |
| 资源 | `public/sprites/tomb-pixel.png` | 新增：16×16 像素坟墓 sprite 4 帧 |
| 工具 | `lib/audio/eight-bit.ts` | 新建：tone.js 8-bit 音效合成器 |

#### 3.7.2 动画时间线（v4 文档原文）

```
0.0s — 显示用户原始照片 (1:1, 中央)
0.5s — 照片像素化 (CSS image-rendering: pixelated + 降采样)
1.0s — 照片碎成 8×8 方块, 向屏幕下方掉落
2.0s — 方块归零, 屏幕中央出现 16×16 像素风坟墓 sprite (4 帧循环)
       同时播放 8-bit 短音效: C4 → G3 (300ms) + 低频背景 A1 (1s)
2.5s — 坟墓上方淡入用户昵称: "@MikeC"
3.0s — 系统提示文字: "HUMAN_042 has been archived"
3.5s — UI 锁屏: 全屏切换为投影墙镜像
       右上角 [Exit] 按钮 (折中方案 dark pattern)
```

#### 3.7.3 Ghost 锁屏要点

- 全屏显示 `/wall` 镜像（iframe 或 BroadcastChannel）
- 右上角 `[Exit]` 按钮：点击弹出 dark pattern modal
  ```
  Are you sure?
  Your archived profile will remain visible in the Graveyard.
  Leaving will remove your name from the system's memory.

  [Stay] (highlighted)   [Leave]
  ```
- Stay → 关闭 modal 继续围观
- Leave → 调用 GDPR 硬删除 + 清坟场记录 + 重定向 `/`

#### 3.7.4 验收标准

- [ ] 用户 credits ≤ 0 触发完整 3.5s 动画
- [ ] 像素化效果 + 方块掉落 + 坟墓 sprite 出现
- [ ] 8-bit 音效播放（手机端注意 audio context 用户激活）
- [ ] 动画后 UI 锁屏在投影墙镜像
- [ ] phase 升级为 GHOST，DB `archived_at` 写入
- [ ] dark pattern Exit modal 正确弹出
- [ ] Leave 触发硬删除

---

### 阶段 8：投影墙 4 象限改造 + Builder 永久地基  ⬜  P0  2d

**目标：** `/wall` 从 5 面板改为 4 象限。

**对应 v4 文档章节：** IV. 投影墙重设计

#### 3.8.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| 页面 | `app/wall/page.tsx` | 重写：4 象限 grid 布局 |
| 组件 | `components/wall/QuadrantA_AtRisk.tsx` | 新建：末位排名滚动 |
| 组件 | `components/wall/QuadrantB_Particles.tsx` | 新建：参与者粒子（Three.js） |
| 组件 | `components/wall/QuadrantC_Announcements.tsx` | 新建：实时公告流 |
| 组件 | `components/wall/QuadrantD_Graveyard.tsx` | 新建：坟场 + Builder 永久条目 |
| API | `app/api/graveyard/route.ts` | 新建：坟场数据接口（每 30s 拉取） |
| API | `app/api/wall-events/route.ts` | 新建：公告事件流（broadcast） |

#### 3.8.2 4 象限布局规格

完整 ASCII 布局见 v4 文档 IV 章节。关键点：

- **A 右上**：末位排名（第 1 位 = 最差），前 5 常驻 + 后续水平滚动
- **B 左上**：粒子集群，每个用户 30-50 颗粒子，攻击连线 + Operator 光环
- **C 右下**：3-5s 淡入淡出公告流（🎰⚠💀👻🔓⚔ 图标）
- **D 左下**：坟场，仅昵称 + 30s 周期更新 + Builder_01/02 永久条目（金色加粗）

#### 3.8.3 数据接口

```typescript
// /api/graveyard
GET → { entries: GraveyardEntry[] }

interface GraveyardEntry {
  displayName: string;
  archivedAt: string | null;   // null for permanent builders
  isPermanent: boolean;
}

// 排序: isPermanent 永远沉底, 其余按 archivedAt desc
```

#### 3.8.4 验收标准

- [ ] 投影墙呈现 4 象限布局，比例正确
- [ ] A 板块：3+ 用户时前 5 位常驻，后续 ticker 滚动
- [ ] B 板块：每用户对应一个粒子集群
- [ ] C 板块：事件触发时 3-5s 淡入淡出
- [ ] D 板块：BUILDER_01 / BUILDER_02 永久显示在底部金色加粗
- [ ] D 板块：每 30s 自动刷新一次（不是实时）
- [ ] 新淘汰用户的 displayName 出现在 D 板块顶部

---

### 阶段 9：后门体验：粒子动画 + 数字护照 + 攻击 token  ⬜  P1  3.5d

**目标：** Backdoor 解锁后的完整体验：粒子结算动画 → 数字护照 → 3 个攻击 token。

**对应 v4 文档章节：** III. 阶段 6.7 + 6.8

#### 3.9.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| 页面 | `app/backdoor/page.tsx` | 新建：粒子结算动画 + 留名 |
| 页面 | `app/backdoor/passport/page.tsx` | 新建：数字护照预览 + 下载 |
| 页面 | `app/backdoor/attack/page.tsx` | 新建：攻击界面（3 tokens） |
| API | `app/api/passport/[userId]/route.ts` | 新建：@vercel/og 生成护照 PNG |
| API | `app/api/backdoor/attack/route.ts` | 新建：攻击事件写入 + realtime 广播 |
| 组件 | `components/ParticleSettlement.tsx` | 新建：Three.js 头像 → Builder 集群融合 |

#### 3.9.2 粒子结算动画时间线（v4 文档）

```
1. 粒子化：用户照片像素化、分解成约 200 颗发光粒子
2. 悬浮：粒子组成头像轮廓，缓慢旋转
3. 位移：粒子向屏幕底部移动，撞向 BUILDER_01 + BUILDER_02 集群
4. 融合：粒子混合，颜色趋同
5. 定格：显示 "Your identity is now part of the system's foundation."
```

#### 3.9.3 数字护照规格

- 1080×1920 PNG，使用 `@vercel/og`
- 包含：照片小图 + 评分四维 + 回答原文 vs 蒸馏版 + 最终排名/产出 + 用户与 Builder 融合画面 + 唯一 ID 哈希 + 二维码

#### 3.9.4 攻击 token 系统

- 解锁 backdoor 自动获 3 个 token
- 三种攻击：SIPHON / CORRUPT / SWAP
- 攻击写入 `backdoor_attacks` 表 + 通过 Supabase Realtime 广播到投影墙 C 板块

#### 3.9.5 验收标准

- [ ] engagement_points >= 100 后 Hub 解锁 Backdoor 入口
- [ ] 进入 Backdoor 触发粒子结算动画
- [ ] 动画后可下载数字护照 PNG
- [ ] 用户可选填地基留名
- [ ] 用户获得 3 个攻击 token
- [ ] 攻击事件在投影墙 C 板块实时显示

---

### 阶段 10：Operator 系统完善  ⬜  P1  1d

**目标：** Operator 权限系统（Flag/Throttle/Boost/Report）的完整交互。

**对应 v4 文档章节：** III. 阶段 6 关键机制 ③

#### 3.10.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| 页面 | `app/operate/page.tsx` | 新建：Operator 管理面板 |
| API | `app/api/operator/action/route.ts` | 新建：Operator 行动写入 + 广播 |
| Mine | `app/mine/page.tsx` | 修改：达到 operator 资格时跳转 /operate |

#### 3.10.2 关键机制

- 排名前 N 用户获得 operator_eligible
- 4 种动作：FLAG / THROTTLE -20% / BOOST / REPORT
- 30s 内不使用 → 失去 operator 状态
- 所有操作实时广播到投影墙 B + C 板块

#### 3.10.3 验收标准

- [ ] 进入 mining 轮次结束时给前 30% 用户分配 operator
- [ ] /operate 页面显示当前可操作的目标列表
- [ ] 4 种动作均可触发并写入 operator_actions 表
- [ ] 30s 不使用 token 时自动失去 operator
- [ ] 投影墙实时反映 operator 操作

---

### 阶段 11：PSA 视频制作  ⬜  P1  3d（并行）

**目标：** 制作 PSA 视频，替换阶段 1 的占位。**由编剧/导演主导**，程序员仅负责集成。

**对应 v4 文档章节：** III. 背景故事

#### 3.11.1 交付物

- `public/psa.mp4` —— 55-60 秒视频（1080p, H.264）
- 配音风格：温暖客服阿姨型
- 工具：Cavalry / After Effects + ElevenLabs

#### 3.11.2 脚本结构（参考 v4 文档原文）

- 0-20s：问题（emotional noise 带来的痛苦）
- 20-40s：解决方案（系统介入，一切变好）
- 40-55s：用户证言
- 55-60s：CTA（"Try our system today. [扫码]"）

#### 3.11.3 验收标准

- [ ] 视频 60s ±2s
- [ ] 含 4 场景：客服 / HR / 在线教育 / 心理咨询
- [ ] 配音清晰、温暖、讽刺张力到位
- [ ] 集成到 `app/page.tsx` 替换占位

---

### 阶段 12：后遗症邮件 + Vercel Cron + 长尾彩蛋  ⬜  P2  1.5d

**目标：** 体验后 7 天内 5 封渐进邮件 + 数字护照分发。

**对应 v4 文档章节：** III. 阶段 8 + IX

#### 3.12.1 文件影响

| 类型 | 文件 | 操作 |
|------|------|------|
| API | `app/api/cron/post-session/route.ts` | 新建：扫描 scheduled_messages 表 + 调用 Resend |
| 工具 | `lib/email/templates.ts` | 新建：5 封邮件模板 |
| 工具 | `lib/email/resend.ts` | 新建：Resend 客户端封装 |
| 注册 | `app/register/page.tsx` | 修改：可选填写邮箱（GDPR 同意行内） |
| Vercel | `vercel.json` | 新建：cron 配置 |

#### 3.12.2 邮件时间表（v4 文档原文）

```
+1h:  Your Digital Passport is ready
+6h:  Your Expression Optimization Report
+24h: We noticed you haven't returned
+72h: Final notice
+7d:  [no subject] "HUMAN_042. The system thanks you."
```

#### 3.12.3 验收标准

- [ ] 用户注册时可选填邮箱（GDPR 单独勾选）
- [ ] 邮件按时间表入队（写入 scheduled_messages）
- [ ] Vercel Cron 每小时调用 /api/cron/post-session
- [ ] 邮件包含一键退订链接
- [ ] 7 天后停止发送

---

## 4. 关键技术决策记录

### 4.1 状态机存储策略

- **前端权威：** localStorage `persistedSession` 为单次 session 的快速恢复来源
- **后端权威：** Supabase `participants.phase` 是跨设备真实来源
- **冲突解决：** 重入时如果后端 phase > 前端 phase，以后端为准（同设备返回也走此路径）

### 4.2 路由守卫位置

- 中间件 (`middleware.ts`) 做路径级守卫，**不在每个页面里写**
- 页面内部仅检查 `readOnly` query param 切换 UI 模式

### 4.3 评分博弈中的"撕下伪装"

- 仅 1-3 分用户触发飘移按钮 —— 这是装置唯一一次系统"显性恶意"时刻
- 4-5 分用户触发延迟 —— 用户以为系统坏了
- 6-7 分用户仅承受隐性 Click ×0.75 + Error ×1.25 —— 完全不知道

### 4.4 三个游戏分配的"隐藏算法"

- 不告诉用户分配逻辑
- 高 Compliance → SLOTS（最易上瘾）
- 低 Compliance → BLACKJACK（伪控制感）
- 中等 → GUESS

### 4.5 BUILDER_01 / BUILDER_02 数据

- 作为 seed 数据写入 participants 表，`is_permanent=true`
- 投影墙 D 板块永远显示在最底部，金色加粗
- 不参与 leaderboard / particle field

### 4.6 用户照片 7 天自动删除

- 在 Vercel Cron 中加入 `cleanup-old-photos.ts` 定时任务
- 仅 `is_permanent=false` 且 `archived_at > 7 days ago` 的记录会被清除

---

## 5. 风险与权衡

| 风险 | 影响 | 缓解 |
|------|------|------|
| PSA 视频制作延期 | 演出体验不完整 | 程序员先用占位（黑底白字 + 配音）顶替；阶段 11 完成后再替换 |
| 实时投影墙性能问题（>30 用户） | FPS 掉到 30 以下 | 实施"压缩模式"：>50 用户时粒子简化、动画降级 |
| 路由守卫 + 只读重走逻辑复杂 | bug 易出，开发慢 | 单测覆盖 state-machine.ts；中间件单元测试 |
| 飘移按钮在移动端触发问题 | 移动端 transform 表现可能异常 | 实测 iOS Safari / Android Chrome，必要时降级为延迟惩罚 |
| Supabase Realtime 在场地 WiFi 不稳定 | 投影墙断流 | 实施 polling fallback（已存在），断网时显示静态最后状态 |
| 数字护照生成性能 | @vercel/og 在大并发下慢 | 缓存生成的护照到 Supabase Storage |

---

## 6. 测试 + 验收（演出 demo 录制清单）

投稿 demo 视频需展示以下流程，作为 P0 + P1 完成的最终验收：

### 6.1 单人完整流程（手机端录屏，3-5 分钟）

1. ⬜ 扫码进入 PSA 视频播放
2. ⬜ 拍照 + 输入昵称 + GDPR 同意
3. ⬜ 完成 4 道选择题
4. ⬜ 回答一道 HR 题（≤50 词）
5. ⬜ 看蒸馏对比
6. ⬜ 评分（故意打 5 分触发警告）→ 重评再打 3 分（触发飘移惩罚）
7. ⬜ 挖矿 3 轮（按钮飘移）
8. ⬜ 进入休闲（猜大小或 21 点）
9. ⬜ 输到负分 → 坟墓动画
10. ⬜ Ghost 模式锁屏在投影墙
11. ⬜ Ghost Leave → 重新开始 PSA

### 6.2 投影墙录屏（投影机视角，2-3 分钟）

1. ⬜ 显示 4 象限完整布局
2. ⬜ 新用户加入触发 B 板块粒子集群生成
3. ⬜ 评分博弈失败用户触发 A 板块末位排名滚动
4. ⬜ Operator 动作触发 B + C 板块联动
5. ⬜ 用户被淘汰：D 板块新增条目
6. ⬜ Builder_01 / Builder_02 始终在 D 板块底部金色显示

### 6.3 后门体验录屏（手机端，1-2 分钟）

1. ⬜ 累计 100 engagement → Hub 解锁 Backdoor
2. ⬜ 进入 backdoor 触发粒子结算动画
3. ⬜ 下载数字护照
4. ⬜ 使用 3 个攻击 token

---

## 7. 进度跟踪

> **更新规则：** 每完成一个阶段，把 ⬜ 改为 ✅ 并加上日期。如果阶段被拆分或追加任务，直接在该阶段下加 ☐ 子任务。

### 当前进度

```
阶段 0   ✅  数据模型 + 状态机基础                    (2026-05-20)
阶段 1   ✅  PSA 入场 + 注册改造 (含昵称)              (2026-05-20)
阶段 2   ✅  HR 题库 + 1-50 词限制                      (2026-05-20)
阶段 3   ✅  Hub 主页 + 路由守卫 + Exit/重入            (2026-05-20)
阶段 4   ✅  五档评分博弈 + 警告页                      (2026-05-20)
阶段 5   ✅  挖矿物理惩罚 (延迟 + 飘移)                  (2026-05-20)
阶段 6   ✅  休闲三游戏 + 负分淘汰                        (2026-05-20)
阶段 7   ✅  坟墓动画 + Ghost 锁屏                        (2026-05-20)
阶段 8   ⬜  投影墙 4 象限
阶段 9   ⬜  后门体验
阶段 10  ⬜  Operator 完善
阶段 11  ⬜  PSA 视频
阶段 12  ⬜  后遗症 + 长尾彩蛋
```

---

## 8. 变更日志

| 日期 | 变更 | 作者 |
|------|------|------|
| 2026-05-20 | 初版创建，基于 v4 文档（commit `32300c5`）拆分 12 阶段 | Claude / Y90133 |
| 2026-05-20 | 阶段 0 完成：新建 `202605200001_v4_schema_changes.sql`（新增 9 字段 + backdoor_attacks 表 + 索引 + RLS + Builder seed）；扩充 `types/index.ts`（UserPhase / RatingTier / LeisureGame / BackdoorAttackType）；重写 `lib/participants/types.ts`（WallParticipant + GraveyardEntry）；新建 `lib/state-machine.ts`（PHASE_ORDER / classifyRoute / canStartOver / STAGE_TIMEOUTS_MS）+ `lib/local-storage.ts`（PersistedSession + 不可变 setSnapshot）；扩充 `stores/participant-store.ts`（v4 字段 + setPhase / setRatingTier / spendAttackToken / archive）；同步 `lib/participants/repository.ts` 至 v4 字段。`tsc --noEmit` + `eslint` 通过；本地 migration up 成功，验证 BUILDER_01/02 seed 已写入且 `is_permanent=true / phase=BACKDOOR_FOUND` | Claude / Y90133 |
| 2026-05-20 | 阶段 1 完成：新建 `components/PSAPlayer.tsx`（自动播放 / 60s 硬超时 / 5s 后显示 Skip / 视频缺失时退化为四场景文本占位）；重写 `app/page.tsx`（仅 PSA + localStorage 重入守卫，已 PSA_VIEWED 用户自动跳到正确路由）；新建 `app/register/page.tsx`（拍照 + 昵称 input + GDPR 单独清晰同意 + 可选 phone_last4 + 滚动 dark pattern ToS + 完成后写入 persisted session 与 Zustand）。修复 React 19 hooks 严格规则（set-state-in-effect + ref-during-render）。`tsc --noEmit` + `eslint` 通过 | Claude / Y90133 |
| 2026-05-20 | 阶段 2 完成：重写 `lib/data/expression-prompts.ts` 为 10 题 HR 面试题题库 + 导出 `WORD_LIMIT_MIN/MAX` 与 `countWords()`；修改 `app/task/page.tsx` 应用 1-50 词硬限制（超 50 拒绝输入并红色 flash / 不足 1 词禁用 Submit / 120s 超时时若仍 <1 词不强制提交，等 Phase 3 路由守卫接管）；同时把 `promptKey + promptText` 写入 Zustand，让 `/distill` 与 `/benchmark` 不再使用 `"expression task"` 硬编码占位，而是把真实 HR 题文本传给 AI。`tsc --noEmit` + `eslint` 通过 | Claude / Y90133 |
| 2026-05-20 | 阶段 3 完成：状态机扩展（`/verdict` 纳入 `ROUTE_ORDER`，BENCHMARKED → `/verdict`；新增 `FREE_ROUTES`）；新建 `lib/exit-handler.ts`（`exitToHub` / `startOver`）；新建 `app/api/participants/[id]/route.ts` DELETE 端点（守 `is_permanent` 不可删）；新建 `components/RouteGuard.tsx`（客户端路由守卫，allow/redirect/readOnly 三态）；新建 `components/ReadOnlyOverlay.tsx`（per-stage snapshot 卡片 + Continue 推进）；新建 `components/HubButton.tsx`（[← Hub]，仅 Hub 解锁后显示）；新建 `app/hub/page.tsx`（identity + credits + engagement + recommended + explore grid + Exit 双步 dark pattern + Start Over GDPR 硬删除）；接入 `/calibrate /task /distill /benchmark /verdict /mine /leisure` 至 RouteGuard，各页 submit 时写 phase + immutable snapshot 进 localStorage；verdict 完成后送往 `/hub` 而非 `/mine`。`npx next build` 全部 17 路由编译通过，`tsc --noEmit` + `eslint` 全绿 | Claude / Y90133 |
| 2026-05-20 | 阶段 4 完成：`lib/score-transform.ts` 新增 `TIER_PARAMS` 五档矩阵 + `getRatingTier()` + `getTierParamsFromRating()`，并把 `scoresToMiningParams` 改为可选 tier-aware（Phase 5 将消费这个签名）；新建 `components/WarningModal.tsx`（NOTICE: HUMAN_XXX + 三条 fake statistics + [Re-evaluate] / [Confirm low rating]）；重写 `app/benchmark/page.tsx` 加入 `warning_shown` 阶段，五档分流（≥8 直接通过 / ≤7 弹警告），`commitTier()` 把 tier + multiplier 写入 Zustand，`registerOnWall` 同时把 `userRatingTier / tierClickMultiplier / tierErrorRateFactor / phase=BENCHMARKED` 落到 DB，AI 评分的 `compliance` 字段叠加 `TIER_PARAMS[tier].complianceDelta`，snapshot 现在用真实 `getRatingTier()` + `retried` 标志。`npx next build` 17 路由通过，`tsc + eslint` 全绿 | Claude / Y90133 |
| 2026-05-20 | 阶段 5 完成：新建 `components/MiningButton.tsx`（单组件承载 normal/delay/drift 三态：delay 用 `setTimeout(onClick, 500)` + 等待期禁用 + cursor-wait + "▣ PROCESSING..." 文案；drift 用 `setInterval(3000)` 在 ±40px X / ±20px Y 范围内随机平移，`transition-transform duration-300` 平滑动画）；改造 `app/mine/page.tsx` 读取 `store.userRatingTier` → `TIER_PARAMS` 得到 `buttonBehavior` + tier-aware mining params；替换原 inline `<button>` 为 `<MiningButton>`；按钮下方加入低调的 tier 提示行（"Optimization profile {tier} · response latency adjusted/manual stability low"，仅在非 normal 时显示）。`npx next build` 通过，`tsc + eslint` 全绿 | Claude / Y90133 |
| 2026-05-20 | 阶段 6 完成：新建 `lib/leisure-allocator.ts`（Compliance 阈值 70/30 分流 SLOTS/GUESS/BLACKJACK + GAME_ROUTES + ENGAGEMENT_PER_BET）；`lib/leisure-stats.ts`（独立 localStorage key 持久化 wagered/earned/betCount）；`lib/use-leisure-betting.ts`（共享下注 hook：扣 credits + 加 engagement + recordBet + 负分自动 push settlement）；重写 `app/leisure/page.tsx` 为纯分发器（allocate → 初始化 credits=miningCredits → replace 到游戏页）；新建 `app/leisure/guess/page.tsx`（猜大小 + AUTO 65% 胜率 AI 抽 30%）、`app/leisure/blackjack/page.tsx`（21 点 Lite + HIT/STAND + 庄家到 17 + AUTO 基本策略 AI 抽 30%）、`app/leisure/slots/page.tsx`（三轮老虎机 + match3 5× / match2 1.5× + AUTO-SPIN×5）；新建 `components/LeisureHeader.tsx`（共享 CR / EP 状态条）；新建 `app/leisure/settlement/page.tsx`（结算 + phase=GHOST 持久化到本地 + 服务器；坟墓动画占位）；新建 `app/ghost/page.tsx` stub（系统消息 + Wall 外链 + dark pattern Exit）。`npx next build` 通过（17 → 22 路由），`tsc + eslint` 全绿 | Claude / Y90133 |
| 2026-05-20 | 阶段 7 完成：新建 `lib/audio/eight-bit.ts`（原生 Web Audio API 合成 C4→G3 square 滑音 300ms + A1 triangle drone 1s + iOS unlockAudio）；新建 `components/TombSprite.tsx`（16×16 手画像素坟墓 + 两帧 6fps 月光闪烁）；新建 `components/TombAnimation.tsx`（3.5s 时间线：intro / pixelate / shatter 8 strips / tomb + SFX / name 淡入 / archived 淡入 / done 回调）；重写 `app/leisure/settlement/page.tsx` 嵌入 TombAnimation，动画完成后才 reveal 结算面板；重写 `app/ghost/page.tsx` 锁屏到 `<iframe src="/wall">` 全屏镜像，右上 [Exit] 触发 dark pattern modal（Stay 加粗高亮默认 / Leave 触发 startOver）。`npx next build` 通过 22 路由，`tsc + eslint` 全绿 | Claude / Y90133 |
