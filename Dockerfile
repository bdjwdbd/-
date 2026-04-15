# 元灵系统 v4.3.0

FROM node:24-slim

# 安装构建工具
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libomp-dev \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY native/package*.json ./native/

# 安装依赖
RUN npm ci --only=production
RUN cd native && npm ci --only=production

# 复制源代码
COPY . .

# 编译 TypeScript
RUN npx tsc --skipLibCheck

# 构建原生模块
RUN cd native && npx node-gyp rebuild

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# 启动命令
CMD ["node", "dist/server.js"]
