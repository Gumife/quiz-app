# SelfQuiz 安全审计报告

**审计日期**: 2026-06-25  
**项目路径**: `C:\Users\17152\Desktop\题库\quiz-app`  
**审计范围**: OWASP Top 10 全面检查

---

## 审计概览

| 严重程度 | 数量 |
|---------|------|
| 🔴 严重 (Critical) | 0 |
| 🟠 高危 (High) | 1 |
| 🟡 中危 (Medium) | 4 |
| 🟢 低危 (Low) | 4 |
| ℹ️ 信息 (Info) | 1 |

---

## 🟠 高危问题

### 1. JSON 反序列化无 Schema 验证

**OWASP 分类**: A08:2021 - Software and Data Integrity Failures  
**文件位置**: `src/utils/parsers/jsonParser.ts:4-6`, `electron/main.cjs:151`

```typescript
// jsonParser.ts
export const parseJsonQuestions = (jsonString: string): Question[] => {
  try {
    const data = JSON.parse(jsonString);  // 无 Schema 验证
    // ...
```

```javascript
// main.cjs:151
const parsed = JSON.parse(result.trim());  // 无 Schema 验证
if (parsed.error) throw new Error(parsed.error);
return parsed.text || '';
```

**问题描述**:  
- `jsonParser.ts` 直接解析用户上传的 JSON 文件，未验证数据结构
- `main.cjs` 解析外部转换器输出的 JSON，同样无验证
- 恶意构造的 JSON 可包含原型污染 payload 或超大字段导致 DoS

**攻击场景**:
```json
{
  "__proto__": {
    "isAdmin": true
  },
  "question": "恶意题目"
}
```

**修复建议**:
```typescript
import { z } from 'zod';

const QuestionSchema = z.object({
  id: z.number().optional(),
  question: z.string().min(1).max(5000),
  options: z.array(z.object({
    key: z.string().regex(/^[A-F]$/),
    text: z.string().max(1000)
  })).optional(),
  answer: z.union([z.string(), z.array(z.string())]),
  questionType: z.enum(['single', 'multiple', 'judge', 'essay']).optional(),
  explanation: z.string().max(2000).optional(),
  questionImage: z.string().url().optional(),
});

const QuestionsSchema = z.union([
  z.array(QuestionSchema),
  z.object({ questions: z.array(QuestionSchema) })
]);

export const parseJsonQuestions = (jsonString: string): Question[] => {
  try {
    const data = JSON.parse(jsonString);
    const validated = QuestionsSchema.parse(data);
    // ... 处理逻辑
  } catch (e) {
    console.error('JSON validation failed:', e);
    return [];
  }
};
```

**严重程度**: 🟠 高危  
**可利用性**: 需要用户导入恶意文件  
**影响**: 原型污染、DoS

---

## 🟡 中危问题

### 3. 缺少 Content Security Policy (CSP)

**OWASP 分类**: A05:2021 - Security Misconfiguration  
**文件位置**: `index.html`, `electron/main.cjs`

**问题描述**:  
- `index.html` 未配置 CSP meta 标签
- Electron BrowserWindow 未设置 CSP
- 无法有效防止 XSS 攻击

**修复建议**:

**index.html**:
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: blob:; 
               font-src 'self';
               connect-src 'self' http://localhost:*;">
```

**electron/main.cjs** (在 createWindow 中):
```javascript
mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:"
      ]
    }
  });
});
```

**严重程度**: 🟡 中危  
**可利用性**: 需要配合 XSS 漏洞  
**影响**: XSS 攻击面扩大

---

### 4. 临时文件竞态条件

**OWASP 分类**: A04:2021 - Insecure Design  
**文件位置**: `electron/main.cjs:137-156`

```javascript
const tmpPath = path.join(os.tmpdir(), `quiz_${Date.now()}${ext}`);
try {
  fs.writeFileSync(tmpPath, Buffer.from(fileBuffer));
  // ... 处理
} finally {
  try { fs.unlinkSync(tmpPath); } catch {}
}
```

**问题描述**:  
- 使用 `Date.now()` 生成临时文件名，可预测
- 多个并发请求可能产生文件名冲突
- `finally` 中的 `unlinkSync` 如果失败会留下临时文件

**修复建议**:
```javascript
const crypto = require('crypto');

ipcMain.handle('convertFile', async (event, fileBuffer, fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  const supported = ['.docx', '.pdf', '.xlsx', '.xls'];
  if (!supported.includes(ext)) {
    throw new Error(`不支持的格式: ${ext}`);
  }

  // 使用 crypto 生成唯一文件名
  const tmpPath = path.join(os.tmpdir(), `quiz_${crypto.randomUUID()}${ext}`);
  let tmpCreated = false;
  
  try {
    await fs.promises.writeFile(tmpPath, Buffer.from(fileBuffer));
    tmpCreated = true;
    
    const converter = getConverterPath();
    const result = await fs.promises.execFile(converter, [tmpPath], {
      timeout: 30000,
      encoding: 'utf-8',
    });

    const parsed = JSON.parse(result.trim());
    if (parsed.error) throw new Error(parsed.error);
    return parsed.text || '';
  } finally {
    if (tmpCreated) {
      await fs.promises.unlink(tmpPath).catch(() => {});
    }
  }
});
```

**严重程度**: 🟡 中危  
**可利用性**: 需要并发请求  
**影响**: 文件覆盖、信息泄露

---

### 5. localStorage 数据完整性无保护

**OWASP 分类**: A04:2021 - Insecure Design  
**文件位置**: `src/context/QuizContext.tsx:40-58`

```typescript
const loadJson = <T,>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;  // 无完整性校验
  } catch { return fallback; }
};

const saveJson = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};
```

**问题描述**:  
- localStorage 中的数据无签名或加密
- 用户可通过 DevTools 或恶意脚本篡改考试成绩、错题记录
- 保存的进度数据可被伪造

**修复建议**:
```typescript
const HMAC_KEY = 'quiz-integrity-key'; // 实际应用中应从安全存储获取

const saveJson = async (key: string, value: unknown) => {
  try {
    const data = JSON.stringify(value);
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(HMAC_KEY),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC', keyMaterial, encoder.encode(data)
    );
    const signed = {
      data: value,
      sig: Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
    };
    localStorage.setItem(key, JSON.stringify(signed));
  } catch {}
};

const loadJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    const { data, sig } = JSON.parse(stored);
    // 验证签名...
    return data as T;
  } catch { return fallback; }
};
```

**严重程度**: 🟡 中危  
**可利用性**: 需要本地访问  
**影响**: 数据篡改

---

### 6. QuestionImage src 未验证

**OWASP 分类**: A03:2021 - Injection  
**文件位置**: `src/components/QuestionImage.tsx:30-31`, `src/pages/Quiz.tsx:158`

```tsx
<img
  src={src}  // src 来自用户上传的 JSON
  alt={alt}
  // ...
/>
```

**问题描述**:  
- `questionImage` 字段直接从用户上传的 JSON 文件解析
- 未验证 URL 是否为合法图片地址
- 可能被利用进行 SSRF（如果图片加载触发网络请求）

**修复建议**:
```typescript
const isValidImageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    // 只允许 data: URI 或 http/https
    if (!['data:', 'http:', 'https:'].some(s => parsed.protocol.startsWith(s))) {
      return false;
    }
    // 对于 http/https，只允许常见图片域名或本地
    if (parsed.protocol.startsWith('http')) {
      // 可添加域名白名单
    }
    return true;
  } catch {
    return false;
  }
};

const QuestionImage: React.FC<QuestionImageProps> = ({ src, alt = '题目图片', className = '' }) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  
  if (!src || !isValidImageUrl(src)) return null;
  // ...
};
```

**严重程度**: 🟡 中危  
**可利用性**: 需要用户导入恶意文件  
**影响**: SSRF、信息泄露

---

## 🟢 低危问题

### 1. Electron IPC 文件读取路径穿越漏洞（已部分修复）

**OWASP 分类**: A01:2021 - Broken Access Control  
**文件位置**: `electron/main.cjs:111-129`

```javascript
ipcMain.handle('readFile', async (event, filePath) => {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('无效的文件路径');
  }
  const resolved = path.resolve(filePath);
  const homeDir = os.homedir();
  if (!resolved.startsWith(homeDir)) {
    throw new Error('不允许访问用户目录以外的文件');
  }
  return new Promise((resolve, reject) => {
    fs.readFile(resolved, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
});
```

**问题描述**:  
`readFile` IPC 处理器包含 3 层保护：(1) 类型/长度检查；(2) `path.resolve` 绝对路径解析；(3) `os.homedir()` 前缀校验，阻止访问用户目录以外的文件。然而，homeDir 内的敏感文件（如 `.ssh/`、浏览器 profile、凭证文件等）仍可被读取，存在信息泄露风险。

**修复建议**: 添加允许目录白名单和文件扩展名白名单。

**严重程度**: 🟢 低危（已有路径限制保护）  
**可利用性**: 需要用户导入恶意文件  
**影响**: 用户目录内敏感文件信息泄露

---

### 7. 开发模式自动打开 DevTools

**OWASP 分类**: A05:2021 - Security Misconfiguration  
**文件位置**: `electron/main.cjs:86`

```javascript
if (isDev) {
  mainWindow.webContents.openDevTools({ mode: 'detach' });
}
```

**问题描述**:  
开发模式下自动打开 DevTools，用户可通过 DevTools 执行任意 JavaScript、查看 localStorage 数据。

**修复建议**:
```javascript
// 仅在明确的开发标志下打开
if (isDev && process.env.ELECTRON_DEVTOOLS === 'true') {
  mainWindow.webContents.openDevTools({ mode: 'detach' });
}
```

**严重程度**: 🟢 低危

---

### 8. 错误信息泄露

**OWASP 分类**: A05:2021 - Security Misconfiguration  
**文件位置**: `electron/main.cjs:70,92`

```javascript
dialog.showErrorBox('错误', `开发服务器启动失败: ${err.message}`);
// ...
dialog.showErrorBox('加载失败', `页面加载失败: ${errorDescription}`);
```

**问题描述**:  
错误对话框直接显示内部错误信息，可能泄露系统路径、技术细节。

**修复建议**:
```javascript
// 生产环境使用通用错误信息
const userMessage = isDev ? err.message : '应用启动失败，请重新安装';
dialog.showErrorBox('错误', userMessage);
```

**严重程度**: 🟢 低危

---

### 9. Service Worker 缓存策略过于宽松

**OWASP 分类**: A04:2021 - Insecure Design  
**文件位置**: `public/sw.js:30-52`

**问题描述**:  
Service Worker 缓存所有 GET 请求的响应，可能导致敏感数据被缓存。

**修复建议**:
```javascript
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // 排除 API 请求和敏感路径
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/') || 
      url.pathname.includes('auth') ||
      url.searchParams.has('token')) {
    return;
  }
  
  // ... 现有缓存逻辑
});
```

**严重程度**: 🟢 低危

---

## ℹ️ 信息

### 10. npm 审计无法执行

**问题描述**:  
`npm audit` 命令因 registry 配置问题无法执行（使用 npmmirror 镜像）。

**建议**:  
```bash
npm config set registry https://registry.npmjs.org/
npm audit
```

---

## ✅ 安全亮点

1. **Electron 安全配置正确** (`electron/main.cjs:54-59`):
   - `contextIsolation: true` ✓
   - `nodeIntegration: false` ✓
   - `sandbox: true` ✓

2. **无 dangerouslySetInnerHTML 使用** - React 自动转义防止 XSS

3. **无硬编码密钥或敏感信息** - `.gitignore` 配置合理

4. **文件上传格式白名单验证** (`src/pages/Upload.tsx:51-58`)

5. **IPC 使用 invoke/handle 模式** - 比 send/on 更安全

---

## 修复优先级

| 优先级 | 问题 | 预计工时 |
|-------|------|---------|
| P2 | #1 路径限制加固 | 1h |
| P0 | #2 JSON Schema 验证 | 3h |
| P1 | #3 CSP 配置 | 1h |
| P1 | #4 临时文件安全 | 1h |
| P2 | #5 localStorage 完整性 | 2h |
| P2 | #6 URL 验证 | 1h |
| P3 | #7-#9 低危问题 | 2h |

---

## 总结

本项目整体安全状况良好，Electron 安全配置正确，无严重漏洞。`readFile` IPC 已有路径限制保护（类型检查 + path.resolve + homeDir 前缀校验），但 homeDir 内的敏感文件仍需加固。建议优先修复 JSON 反序列化 Schema 验证和 CSP 配置。实施上述修复后，应用安全性将显著提升。

**审计完成**  
**审计员**: MiMo Code Agent  
**报告版本**: 1.0
