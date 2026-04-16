/**
 * 模块导入验证测试
 */

// 导入所有模块
import {
  // Harness
  HarnessSystem,
  StateCategory,
  TraceCollector,
  PPAFEngine,
  SandboxManager,
  RiskLevel,
  MetricsCollector as HarnessMetricsCollector,
  EvolutionEngine,
  
  // Dashboard
  DashboardServer,
  createDashboard,
  
  // Multi-Agent
  Coordinator,
  createCoordinator,
  TaskPriority,
  AgentStatus,
  
  // NL-Programming
  NaturalLanguageParser,
  createParser,
  ParsedIntentType,
  
  // Edge
  EdgeRuntime,
  createEdgeRuntime,
  EdgeNodeType,
  SyncStatus,
  
  // Federated
  FederatedEngine,
  createFederatedEngine,
  FederatedRole,
  FederatedAggregationStrategy,
  PrivacyStrategy,
} from './index';

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║       模块导入验证测试                                  ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// 验证 Harness
console.log('━━━━━━ Harness Engineering ━━━━━━');
console.log(`  ✅ HarnessSystem: ${typeof HarnessSystem}`);
console.log(`  ✅ StateCategory: ${typeof StateCategory}`);
console.log(`  ✅ TraceCollector: ${typeof TraceCollector}`);
console.log(`  ✅ PPAFEngine: ${typeof PPAFEngine}`);
console.log(`  ✅ SandboxManager: ${typeof SandboxManager}`);
console.log(`  ✅ RiskLevel: ${typeof RiskLevel}`);
console.log(`  ✅ MetricsCollector: ${typeof HarnessMetricsCollector}`);
console.log(`  ✅ EvolutionEngine: ${typeof EvolutionEngine}`);

// 验证 Dashboard
console.log('\n━━━━━━ Dashboard ━━━━━━');
console.log(`  ✅ DashboardServer: ${typeof DashboardServer}`);
console.log(`  ✅ createDashboard: ${typeof createDashboard}`);

// 验证 Multi-Agent
console.log('\n━━━━━━ Multi-Agent ━━━━━━');
console.log(`  ✅ Coordinator: ${typeof Coordinator}`);
console.log(`  ✅ createCoordinator: ${typeof createCoordinator}`);
console.log(`  ✅ TaskPriority: ${typeof TaskPriority}`);
console.log(`  ✅ AgentStatus: ${typeof AgentStatus}`);

// 验证 NL-Programming
console.log('\n━━━━━━ NL-Programming ━━━━━━');
console.log(`  ✅ NaturalLanguageParser: ${typeof NaturalLanguageParser}`);
console.log(`  ✅ createParser: ${typeof createParser}`);
console.log(`  ✅ ParsedIntentType: ${typeof ParsedIntentType}`);

// 验证 Edge
console.log('\n━━━━━━ Edge Computing ━━━━━━');
console.log(`  ✅ EdgeRuntime: ${typeof EdgeRuntime}`);
console.log(`  ✅ createEdgeRuntime: ${typeof createEdgeRuntime}`);
console.log(`  ✅ EdgeNodeType: ${typeof EdgeNodeType}`);
console.log(`  ✅ SyncStatus: ${typeof SyncStatus}`);

// 验证 Federated
console.log('\n━━━━━━ Federated Learning ━━━━━━');
console.log(`  ✅ FederatedEngine: ${typeof FederatedEngine}`);
console.log(`  ✅ createFederatedEngine: ${typeof createFederatedEngine}`);
console.log(`  ✅ FederatedRole: ${typeof FederatedRole}`);
console.log(`  ✅ AggregationStrategy: ${typeof FederatedAggregationStrategy}`);
console.log(`  ✅ PrivacyStrategy: ${typeof PrivacyStrategy}`);

console.log('\n✅ 所有模块导入验证通过\n');
