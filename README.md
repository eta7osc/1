# Lover's Secret

情侣双人私密应用（iOS 风 UI），基于 `React + TypeScript + Vite + CloudBase`。

## 已实现能力

- 双人账号绑定（我 / 她）
- 聊天（文本、图片、长视频）
- 表情包系统（上传、从聊天图片保存、发送）
- 私密媒体阅后即焚（可选销毁时间）
- 家页面（原朋友圈）
: 发布日常、点赞、评论，双端同步
- 纪念日（云端同步、倒计时、提醒天数）
- 照片墙（公共墙 + 私密墙）
: 私密墙需要密码进入，支持图片/视频上传

## 本地开发

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

```bash
cp .env.example .env.local
```

`.env.local` 示例：

```env
VITE_CLOUDBASE_ENV_ID=你的云开发环境ID
VITE_ME_INVITE_CODE=我方邀请码
VITE_HER_INVITE_CODE=她方邀请码
VITE_PRIVATE_WALL_PASSWORD=私密墙密码
# VITE_MAX_CHAT_FILE_MB=300
# VITE_PUBLIC_BASE=/lovers-message/
```

3. 启动开发

```bash
npm run dev
```

4. 生产构建

```bash
npm run build
```

## 腾讯云（CloudBase）准备项

需要创建并开放以下集合：

- `messages`
- `emoji_packs`
- `home_posts`
- `anniversaries`
- `wall_items`
- `couple_accounts`

另外请确认：

- 已开启匿名登录
- 存储上传权限允许前端写入
- 静态托管路径与 `VITE_PUBLIC_BASE` 一致（若子路径部署）

## 功能说明

### 1. 家页面（原朋友圈）

- 导航名称已改为“家”
- 支持图文/视频发布
- 对方可点赞与评论，云端同步

### 2. 聊天

- 支持发送图片和长视频（默认 300MB，可通过 `VITE_MAX_CHAT_FILE_MB` 调整）
- 聊天气泡已优化为 iOS 风格
- 图片可一键保存为表情包并发送

### 3. 阅后即焚

- 发送图片/视频时可开启私密模式并选择销毁时间
- 接收方首次查看后启动倒计时，超时自动失效

### 4. 私密照片墙

- 进入私密墙需输入密码（`VITE_PRIVATE_WALL_PASSWORD`）
- 私密墙支持图片与视频上传

## 脚本

```bash
npm run dev
npm run build
npm run preview
```
