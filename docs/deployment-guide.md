# v4 部署指南

> **本文件目的：** 把本地已跑通的 v4 项目推到公开网络，给手机扫码 + Vercel Cron + Resend 邮件全部跑起来。**完全免费**路径。

最后更新：2026-05-20

---

## 0. 一句话总览

| 需求 | 答案 |
|------|------|
| 邮件发件 | Resend + 发件人写 `onboarding@resend.dev`（无需域名） |
| 生产域名 | 部署到 Vercel → 自动获得 `https://<project>.vercel.app` 免费子域 |
| Cron | Vercel Cron 自动从 `vercel.json` 读配置 |

---

## 1. Resend 邮件配置

### 1.1 你的 API Key 已就位

已写入本地 `.env.local`：
```
RESEND_API_KEY=
```

> ⚠ **安全提示**：你在对话中粘贴过这个 key，建议演出结束后到 [resend.com/api-keys](https://resend.com/api-keys) 重新生成一次。

### 1.2 没有域名怎么发件？

**答：用 Resend 官方测试发件地址。**

Resend 免费账户**不需要**验证任何域名就能用：
- 发件地址：`onboarding@resend.dev`
- 限制：免费层每天 100 封 / 月 3000 封；测试发件人只能发到**已验证的邮箱**（你注册 Resend 时填的那个邮箱可直接收）

对于 v4 装置：
- 现场预计 50-100 个观众同时填邮箱
- 每人 5 封邮件 = 250-500 封/天
- 接近免费额度上限，但够用

如果未来要发到任意邮箱、撑更大流量，再考虑：
- **方案 A（推荐）**：注册一个便宜域名（Namecheap / Cloudflare Registrar 一年 9-12 RMB），在 Resend 后台 Domain 页加 DNS 记录验证（5 分钟），然后改 `EMAIL_FROM=system@your-domain.xyz`
- **方案 B**：升级 Resend Pro（$20/月，可发到任意邮箱）

### 1.3 本地测试

无 Resend key 时项目自动进 mock 模式（控制台 log）。**已有 key**时，本地 dev 也会真发邮件，但发件人是 `onboarding@resend.dev`，且只能发到你注册 Resend 用的那个邮箱。

---

## 2. 免费生产域名

### 2.1 三个全免费方案

| 选项 | 域名样式 | 适用场景 |
|------|---------|---------|
| **Vercel**（首选） | `self-distill.vercel.app` | Next.js 一键部署，HTTPS 自动，Cron 内置 |
| Cloudflare Pages | `self-distill.pages.dev` | 静态/边缘函数，免费但 Cron 需要 Workers |
| Netlify | `self-distill.netlify.app` | 跟 Vercel 类似，但 Next.js 16 兼容性略差 |

**强烈推荐 Vercel**——这是 Next.js 官方部署平台，全套配置零摩擦。

### 2.2 Vercel 部署流程

**步骤一：注册 + 连仓库**

1. 浏览器打开 [vercel.com](https://vercel.com)
2. 用 GitHub 账号 Y90133 登录（"Continue with GitHub"）
3. 顶部 `New Project` → 选 `alonzo-f/self_distill_web` 仓库
4. Framework 自动检测为 Next.js → `Deploy`

**步骤二：自动获得免费域名**

部署完成后，Vercel 自动分配：`https://self_distill_web-xxx-y90133.vercel.app`

可以自定义：Project Settings → Domains → 改成更短的 `self-distill.vercel.app`（仅当未被占用）

**步骤三：配置环境变量**

Project Settings → Environment Variables，**逐条填以下**：

| Key | Value | 说明 |
|-----|-------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 生产 Supabase URL | 见下文 4. Supabase 段 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 生产 anon key | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | 生产 service role key | 同上 |
| `AI_API_KEY` | OpenAI key（可选，留空则 mock） | |
| `RESEND_API_KEY` | `re_6NsoGKco_Mtz4QFh8Qcq3sYowFtJimDGM` | 你的 Resend key |
| `EMAIL_FROM` | `onboarding@resend.dev` | 无域名时的发件人 |
| `SITE_ORIGIN` | `https://self-distill.vercel.app` | 实际部署后的 URL |
| `CRON_SECRET` | `11ebddcc41687563d4d16d93725f599fa3e144ed3c6dcf236d72e0f585a67bfe` | 已生成的随机串 |

配完后 Project → Deployments → 最新 deployment 右上 `Redeploy`。

**步骤四：Cron 自动启用**

`vercel.json` 里已配好：
```json
{ "crons": [{ "path": "/api/cron/post-session", "schedule": "0 * * * *" }] }
```

Vercel 部署时自动注册。Project → Settings → Cron Jobs 可以看到。每小时 hh:00 触发。

---

## 3. Supabase 生产配置

本地用的是 `npx supabase start` 起的本地数据库。生产需要 Supabase 云端（免费层够用）：

1. [supabase.com](https://supabase.com) → New Project
2. 项目创建后从 Settings → API 拷贝：
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` → `SUPABASE_SERVICE_ROLE_KEY`
3. 推送 migrations 到云端：
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   会执行 `supabase/migrations/*.sql` 共 4 个文件，包括 Phase 0 的 v4 schema + Builder seed。
4. 在 Storage 页面创建 bucket：`participant-photos`，设为 public read。

> 免费层限制：500 MB DB + 1 GB 文件存储 + 2 GB 月带宽。装置短期演出绰绰有余。

---

## 4. 完整生产 env 配置示例

```bash
# Supabase (从 Supabase 项目 Settings 拷贝)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# AI (可选)
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
AI_API_KEY=sk-...

# Email + Cron
RESEND_API_KEY=re_6NsoGKco_Mtz4QFh8Qcq3sYowFtJimDGM
EMAIL_FROM=onboarding@resend.dev
SITE_ORIGIN=https://self-distill.vercel.app
CRON_SECRET=11ebddcc41687563d4d16d93725f599fa3e144ed3c6dcf236d72e0f585a67bfe
```

---

## 5. 部署后 smoke test

```bash
# 1. 注册流程
浏览器打开 https://self-distill.vercel.app
扫码 → PSA → register → 填邮箱 + 勾两个 consent

# 2. 数字护照
打开 https://self-distill.vercel.app/api/passport/<your-user-id>
应该看到 1080x1920 PNG

# 3. 后遗症邮件 (一小时内会收到第一封)
Vercel Logs → 找 "cron/post-session" 看是否被触发

# 4. 一键退订
邮件底部点 Unsubscribe → 看到"You have been removed..."页面 = 成功
```

---

## 6. 现场演出建议

- 演出前 24h 做完整端到端测试：注册 → 完整流程 → 等收第一封邮件
- 准备一个备用 OpenAI key（avoid mock mode 让 AI 蒸馏更有戏剧性）
- 投影墙用 `https://self-distill.vercel.app/wall` 在大屏全屏打开（按 F11）
- 装置开始前在 Supabase Dashboard → SQL Editor 跑一次清空（保留 Builder）：
  ```sql
  delete from public.participants where is_permanent = false;
  delete from public.scheduled_messages;
  delete from public.backdoor_attacks;
  ```

---

## 7. 故障排查

| 症状 | 排查 |
|------|------|
| 邮件没发 | Vercel Logs → 找 `cron/post-session` 时间戳；检查 RESEND_API_KEY 是否填了 |
| 邮件发了但收不到 | Resend 后台 → Emails 标签 → 看 status；测试发件人只能发到注册邮箱 |
| 投影墙没刷新 | Realtime 是否启用：Supabase Dashboard → Database → Replication 应该看到 `participants` 表有 publication |
| 数字护照 404 | 用户 ID 必须是 UUID 格式；用 Vercel Logs 看 `/api/passport/...` 报错 |
| 摄像头无法启动 | 必须 HTTPS——Vercel 自动启用 HTTPS；本地用 `npm run dev:local`（mkcert 证书） |

---

## 8. 安全清单（演出前过一遍）

- [ ] Resend API key 演出后到 [resend.com/api-keys](https://resend.com/api-keys) 重新生成
- [ ] Supabase service role key 不暴露在客户端（已确认仅 `app/api/*` 服务端使用）
- [ ] `public/psa.mp4` 在 .gitignore 中，不会推到 GitHub（已配置）
- [ ] 体验完成后 7 天 / 演出结束后立刻：手动清空 `participants` 表照片字段（保留 Builder）
- [ ] GDPR 联系邮箱 `info@self-distill.art` 准备一个真实可达的转发地址（如 Resend 接收转发到你的 Gmail）
