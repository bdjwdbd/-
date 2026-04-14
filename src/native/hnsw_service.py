#!/usr/bin/env python3
"""
HNSW 高性能服务
通过子进程调用，提供 100% 性能

使用方式:
1. 作为服务运行: python3 hnsw_service.py
2. 通过 stdin/stdout 通信（JSON 协议）

GPU 支持:
- 自动检测 GPU 可用性
- 有 GPU 时自动使用 GPU 加速
- 无 GPU 时使用 CPU (FAISS/scipy/numpy)
"""

import sys
import json
import numpy as np
from typing import List, Dict, Any, Optional
import time
import os

# 尝试导入 FAISS（最优）
try:
    import faiss
    HAS_FAISS = True
    
    # 尝试 GPU 支持
    try:
        # 检查是否有 GPU
        if hasattr(faiss, 'get_num_gpus') and faiss.get_num_gpus() > 0:
            HAS_FAISS_GPU = True
            GPU_COUNT = faiss.get_num_gpus()
        else:
            HAS_FAISS_GPU = False
            GPU_COUNT = 0
    except:
        HAS_FAISS_GPU = False
        GPU_COUNT = 0
        
except ImportError:
    HAS_FAISS = False
    HAS_FAISS_GPU = False
    GPU_COUNT = 0

# 尝试导入 scipy 加速
try:
    from scipy.spatial.distance import cdist
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

# 尝试导入 hnswlib
try:
    import hnswlib
    HAS_HNSWLIB = True
except ImportError:
    HAS_HNSWLIB = False

# 确定后端
if HAS_FAISS_GPU:
    BACKEND = "faiss-gpu"
elif HAS_FAISS:
    BACKEND = "faiss"
elif HAS_HNSWLIB:
    BACKEND = "hnswlib"
elif HAS_SCIPY:
    BACKEND = "scipy"
else:
    BACKEND = "numpy"

print(f"[HNSWService] 启动 (backend: {BACKEND}, gpu: {GPU_COUNT})", file=sys.stderr)


class HNSWIndex:
    """HNSW 索引封装（支持 GPU/FAISS/hnswlib/scipy/numpy）"""
    
    def __init__(self, dim: int, max_elements: int = 10000, 
                 M: int = 16, ef_construction: int = 200, ef_search: int = 50,
                 use_gpu: bool = True):
        self.dim = dim
        self.max_elements = max_elements
        self.M = M
        self.ef_construction = ef_construction
        self.ef_search = ef_search
        self.id_map: Dict[int, str] = {}
        self.reverse_map: Dict[str, int] = {}
        self.next_id = 0
        self.use_gpu = use_gpu and HAS_FAISS_GPU
        self.gpu_resources = None
        
        if HAS_FAISS:
            # 使用 FAISS IVF 索引
            nlist = min(100, max(max_elements // 10, 1))
            quantizer = faiss.IndexFlatL2(dim)
            self.index = faiss.IndexIVFFlat(quantizer, dim, nlist)
            self.index.nprobe = 10
            self._trained = False
            self._vectors = []
            
            # GPU 加速
            if self.use_gpu:
                self.gpu_resources = faiss.StandardGpuResources()
                self.index = faiss.index_cpu_to_gpu(self.gpu_resources, 0, self.index)
                print(f"[HNSWService] GPU 加速已启用 (GPU 0)", file=sys.stderr)
                
        elif HAS_HNSWLIB:
            self.index = hnswlib.Index(space='l2', dim=dim)
            self.index.init_index(max_elements=max_elements, ef_construction=ef_construction, M=M)
            self.index.set_ef(ef_search)
        else:
            # 纯 numpy/scipy 实现
            self.vectors: List[np.ndarray] = []
            self.ids: List[str] = []
    
    def add(self, id: str, vector: List[float]) -> None:
        """添加向量"""
        vec = np.array(vector, dtype=np.float32)
        
        if HAS_FAISS:
            internal_id = self.next_id
            self.id_map[internal_id] = id
            self.reverse_map[id] = internal_id
            self._vectors.append(vec)
            self.next_id += 1
            
            # 批量训练和添加
            if len(self._vectors) >= 100 or self.next_id >= self.max_elements:
                self._flush_vectors()
        elif HAS_HNSWLIB:
            internal_id = self.next_id
            self.id_map[internal_id] = id
            self.reverse_map[id] = internal_id
            self.index.add_items(vec, [internal_id])
            self.next_id += 1
        else:
            self.vectors.append(vec)
            self.ids.append(id)
    
    def _flush_vectors(self) -> None:
        """刷新向量到 FAISS 索引"""
        if not self._vectors:
            return
        
        vectors = np.array(self._vectors, dtype=np.float32)
        
        if not self._trained:
            self.index.train(vectors)
            self._trained = True
        
        self.index.add(vectors)
        self._vectors = []
    
    def add_batch(self, items: List[Dict[str, Any]]) -> None:
        """批量添加"""
        for item in items:
            self.add(item['id'], item['vector'])
        
        if HAS_FAISS:
            self._flush_vectors()
    
    def search(self, query: List[float], k: int = 10) -> List[Dict[str, Any]]:
        """搜索"""
        query_vec = np.array(query, dtype=np.float32)
        
        if HAS_FAISS:
            # 刷新未添加的向量
            if self._vectors:
                self._flush_vectors()
            
            # 获取索引（GPU 或 CPU）
            if self.use_gpu:
                # GPU 索引直接搜索
                index = self.index
            else:
                index = self.index
            
            if index.ntotal == 0:
                return []
            
            D, I = index.search(np.array([query_vec]), k)
            results = []
            for dist, idx in zip(D[0], I[0]):
                if idx in self.id_map:
                    results.append({
                        'id': self.id_map[idx],
                        'distance': float(dist),
                        'score': 1.0 / (1.0 + float(dist))
                    })
            return results
        
        elif HAS_HNSWLIB:
            labels, distances = self.index.knn_query(query_vec, k=k)
            results = []
            for label, dist in zip(labels[0], distances[0]):
                if label in self.id_map:
                    results.append({
                        'id': self.id_map[label],
                        'distance': float(dist),
                        'score': 1.0 / (1.0 + float(dist))
                    })
            return results
        
        else:
            # 使用 scipy 或 numpy 加速
            if not self.vectors:
                return []
            
            # 使用预存的 numpy 数组
            if not hasattr(self, '_vectors_array') or len(self._vectors_array) != len(self.vectors):
                self._vectors_array = np.array(self.vectors, dtype=np.float32)
            
            if HAS_SCIPY:
                # scipy 加速（更快）
                distances = cdist([query_vec], self._vectors_array, 'euclidean')[0]
            else:
                # numpy 暴力搜索
                distances = np.linalg.norm(self._vectors_array - query_vec, axis=1)
            
            # 使用 argpartition 加速 top-k
            if k < len(distances):
                indices = np.argpartition(distances, k)[:k]
                indices = indices[np.argsort(distances[indices])]
            else:
                indices = np.argsort(distances)[:k]
            
            results = []
            for idx in indices:
                results.append({
                    'id': self.ids[idx],
                    'distance': float(distances[idx]),
                    'score': 1.0 / (1.0 + float(distances[idx]))
                })
            return results
    
    def save(self, path: str) -> None:
        """保存索引"""
        if HAS_HNSWLIB:
            self.index.save_index(path)
        
        # 保存映射
        import pickle
        with open(path + '.map', 'wb') as f:
            pickle.dump({
                'id_map': self.id_map,
                'reverse_map': self.reverse_map,
                'next_id': self.next_id
            }, f)
    
    def load(self, path: str) -> None:
        """加载索引"""
        if HAS_HNSWLIB:
            self.index.load_index(path)
        
        import pickle
        with open(path + '.map', 'rb') as f:
            data = pickle.load(f)
            self.id_map = data['id_map']
            self.reverse_map = data['reverse_map']
            self.next_id = data['next_id']
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        if HAS_FAISS:
            return {
                'count': self.index.ntotal,
                'max_elements': self.max_elements,
                'dim': self.dim,
                'nlist': self.index.nlist if hasattr(self.index, 'nlist') else 0,
                'nprobe': self.index.nprobe if hasattr(self.index, 'nprobe') else 0,
                'backend': 'faiss-gpu' if self.use_gpu else 'faiss',
                'gpu_enabled': self.use_gpu,
                'gpu_count': GPU_COUNT if self.use_gpu else 0
            }
        elif HAS_HNSWLIB:
            return {
                'count': self.next_id,
                'max_elements': self.max_elements,
                'dim': self.dim,
                'M': self.M,
                'ef_construction': self.ef_construction,
                'ef_search': self.ef_search,
                'backend': 'hnswlib',
                'gpu_enabled': False
            }
        else:
            return {
                'count': len(self.vectors),
                'dim': self.dim,
                'backend': 'scipy' if HAS_SCIPY else 'numpy',
                'gpu_enabled': False
            }


class HNSWService:
    """HNSW 服务"""
    
    def __init__(self):
        self.indices: Dict[str, HNSWIndex] = {}
    
    def handle_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """处理命令"""
        action = command.get('action')
        index_name = command.get('index', 'default')
        
        try:
            if action == 'create':
                dim = command.get('dim', 128)
                max_elements = command.get('max_elements', 10000)
                M = command.get('M', 16)
                ef_construction = command.get('ef_construction', 200)
                ef_search = command.get('ef_search', 50)
                
                self.indices[index_name] = HNSWIndex(
                    dim=dim,
                    max_elements=max_elements,
                    M=M,
                    ef_construction=ef_construction,
                    ef_search=ef_search
                )
                
                return {'success': True, 'message': f'Index {index_name} created'}
            
            elif action == 'add':
                if index_name not in self.indices:
                    return {'success': False, 'error': f'Index {index_name} not found'}
                
                index = self.indices[index_name]
                id = command.get('id')
                vector = command.get('vector')
                
                index.add(id, vector)
                return {'success': True}
            
            elif action == 'add_batch':
                if index_name not in self.indices:
                    return {'success': False, 'error': f'Index {index_name} not found'}
                
                index = self.indices[index_name]
                items = command.get('items', [])
                index.add_batch(items)
                return {'success': True, 'count': len(items)}
            
            elif action == 'search':
                if index_name not in self.indices:
                    return {'success': False, 'error': f'Index {index_name} not found'}
                
                index = self.indices[index_name]
                query = command.get('query')
                k = command.get('k', 10)
                
                start = time.time()
                results = index.search(query, k)
                elapsed = (time.time() - start) * 1000
                
                return {
                    'success': True,
                    'results': results,
                    'time_ms': elapsed
                }
            
            elif action == 'stats':
                if index_name not in self.indices:
                    return {'success': False, 'error': f'Index {index_name} not found'}
                
                index = self.indices[index_name]
                return {'success': True, 'stats': index.get_stats()}
            
            elif action == 'save':
                if index_name not in self.indices:
                    return {'success': False, 'error': f'Index {index_name} not found'}
                
                index = self.indices[index_name]
                path = command.get('path')
                index.save(path)
                return {'success': True}
            
            elif action == 'load':
                dim = command.get('dim', 128)
                self.indices[index_name] = HNSWIndex(dim=dim)
                index = self.indices[index_name]
                path = command.get('path')
                index.load(path)
                return {'success': True}
            
            elif action == 'benchmark':
                return self.run_benchmark(command)
            
            else:
                return {'success': False, 'error': f'Unknown action: {action}'}
        
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def run_benchmark(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """运行性能基准测试"""
        dim = config.get('dim', 4096)
        count = config.get('count', 1000)
        k = config.get('k', 10)
        
        # 创建索引
        index = HNSWIndex(dim=dim, max_elements=count * 2)
        
        # 构建测试
        vectors = [np.random.randn(dim).tolist() for _ in range(count)]
        
        start = time.time()
        for i, vec in enumerate(vectors):
            index.add(f'vec-{i}', vec)
        build_time = (time.time() - start) * 1000
        
        # 搜索测试
        query = np.random.randn(dim).tolist()
        
        start = time.time()
        for _ in range(100):
            index.search(query, k)
        search_time = (time.time() - start) * 1000
        
        return {
            'success': True,
            'benchmark': {
                'dim': dim,
                'count': count,
                'build_time_ms': build_time,
                'search_100_ms': search_time,
                'avg_search_ms': search_time / 100,
                'backend': 'hnswlib' if HAS_HNSWLIB else 'numpy'
            }
        }
    
    def run(self):
        """运行服务"""
        print(f"[HNSWService] 启动 (backend: {'hnswlib' if HAS_HNSWLIB else 'numpy'})", file=sys.stderr)
        
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            
            try:
                command = json.loads(line)
                result = self.handle_command(command)
                print(json.dumps(result), flush=True)
            except json.JSONDecodeError as e:
                print(json.dumps({'success': False, 'error': f'Invalid JSON: {e}'}), flush=True)


if __name__ == '__main__':
    service = HNSWService()
    
    # 如果有命令行参数，执行单次命令
    if len(sys.argv) > 1:
        command = json.loads(sys.argv[1])
        result = service.handle_command(command)
        print(json.dumps(result, indent=2))
    else:
        # 否则运行服务模式
        service.run()
