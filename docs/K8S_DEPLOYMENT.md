# 元灵系统 v4.3.0 - K8s 部署指南

## 前置条件

- Kubernetes 1.24+
- kubectl 已配置
- Docker 已安装
- 至少 3 个节点

## 快速部署

### 1. 构建镜像

```bash
docker build -t yuanling:4.3.0 .
```

### 2. 推送镜像（可选）

```bash
docker tag yuanling:4.3.0 your-registry/yuanling:4.3.0
docker push your-registry/yuanling:4.3.0
```

### 3. 创建命名空间和配置

```bash
kubectl apply -f k8s/deployment.yaml
```

### 4. 验证部署

```bash
kubectl get pods -n yuanling
kubectl get services -n yuanling
```

## 配置说明

### ConfigMap

| 键 | 默认值 | 说明 |
|----|--------|------|
| NODE_ENV | production | 运行环境 |
| PORT | 3000 | 服务端口 |
| DIMENSIONS | 1024 | 向量维度 |
| THREAD_COUNT | 4 | 线程数 |

### Secret

| 键 | 说明 |
|----|------|
| EMBEDDING_API_KEY | 嵌入模型 API Key |

### 资源配置

| 资源 | 请求 | 限制 |
|------|------|------|
| CPU | 500m | 2000m |
| 内存 | 1Gi | 4Gi |

## 扩缩容

### 手动扩容

```bash
kubectl scale deployment yuanling-api -n yuanling --replicas=5
```

### 自动扩容（HPA）

已配置 HPA：
- 最小副本：3
- 最大副本：10
- CPU 阈值：70%
- 内存阈值：80%

## 监控

### 健康检查

```bash
kubectl port-forward svc/yuanling-service -n yuanling 8080:80
curl http://localhost:8080/health
```

### 日志查看

```bash
kubectl logs -f deployment/yuanling-api -n yuanling
```

### Prometheus 集成

服务暴露 `/metrics` 端点（Prometheus 格式）。

## 故障排除

### Pod 无法启动

```bash
kubectl describe pod <pod-name> -n yuanling
kubectl logs <pod-name> -n yuanling
```

### 服务无法访问

```bash
kubectl get endpoints yuanling-service -n yuanling
kubectl port-forward svc/yuanling-service -n yuanling 8080:80
```

## 清理

```bash
kubectl delete -f k8s/deployment.yaml
```

---

*文档版本: v4.3.0*
