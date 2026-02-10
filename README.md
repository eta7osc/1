# Lover's Secret

基于 `React + TypeScript + Vite + CloudBase` 的情侣私密空间项目，包含聊天、纪念日、朋友圈和相册页。

## 1. 本地开发

前置要求：Node.js 18+

1. 安装依赖

```bash
npm install
```

2. 创建环境变量

```bash
cp .env.example .env.local
```

并在 `.env.local` 填入：

```env
VITE_CLOUDBASE_ENV_ID=你的云开发环境ID
# 可选
# VITE_PUBLIC_BASE=/lovers-message/
```

3. 启动开发服务器

```bash
npm run dev
```

## 2. 生产构建

```bash
npm run build
```

构建产物在 `dist/`。

## 3. 腾讯云部署（静态托管）

适用于 COS 静态网站托管或 CloudBase 静态托管。

1. 确认构建时 `VITE_PUBLIC_BASE` 与实际访问路径一致
- 根域名部署：`/`
- 子路径部署（示例）：`/lovers-message/`

2. 上传 `dist/` 全部文件到静态托管目录。

3. 路由模式
- 当前使用 `HashRouter`，不依赖服务端重写规则。
- 访问路径带 `#`，可直接用于静态托管。

4. CloudBase 权限与集合
- 需存在集合：`messages`
- 前端默认匿名登录，请在云开发控制台确认匿名登录已开启。
- 上传文件会写入 `chat-media/` 路径，需确认存储权限。

## 4. 常见问题

1. 页面能打开但聊天请求失败
- 通常是 `VITE_CLOUDBASE_ENV_ID` 未配置或配置错误。

2. 发布后资源 404
- 通常是 `VITE_PUBLIC_BASE` 与部署子路径不一致。

3. 附件上传失败
- 仅支持图片/视频，且单文件最大 20MB。

## 5. 项目脚本

```bash
npm run dev      # 开发
npm run build    # 生产构建
npm run preview  # 本地预览构建结果
```
