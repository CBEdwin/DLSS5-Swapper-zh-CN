# 简体中文汉化说明 / Simplified Chinese Translation

本仓库是 [`rakanki911/DLSS5-Swapper`](https://github.com/rakanki911/DLSS5-Swapper) 的**简体中文独立维护版**，基于上游 v2.2.9。

上游项目以 MIT 协议开源，作者为 **Rakan Alkhaldi**。本仓库仅翻译界面文案，不改动任何功能逻辑。

>本仓库是**独立仓库**（非 fork），因此不受上游仓库删除或转移的影响。
> 上游地址：https://github.com/rakanki911/DLSS5-Swapper

---

## 与上游的关系

| 仓库 | 用途 |
|---|---|
| **`CBEdwin/DLSS5-Swapper-zh-CN`**（本仓库，独立） | 长期维护、发布、给用户下载 |
| `CBEdwin/DLSS5-Swapper`（fork） | 仅用于向[上游](https://github.com/rakanki911/DLSS5-Swapper)提交 PR：[PR #436](https://github.com/rakanki911/DLSS5-Swapper/pull/436) |

本仓库是**独立仓库**（非fork），因此不受上游仓库删除或转移的影响。
上游地址：https://github.com/rakanki911/DLSS5-Swapper

> **为何贡献上游要另用 fork**：GitHub 生成 PR diff 需要两个分支存在**共同祖先**。
> 非fork 的独立仓库不含上游的 git 对象，无法与上游建立共同祖先，
> 因此 `POST /pulls` 会返回 `No commits between rakanki911:main and CBEdwin:main`。
> 故保留一个 fork 专供提 PR 用，本仓库不承担该职责。

## 同步上游新版本

由于本仓库不保留上游 git 历史（首个提交是导入 v2.2.9 文件树的根提交），
**不能用 `git rebase` 同步**。推荐做法：

```bash
# 1. 获取上游最新版
git clone https://github.com/rakanki911/DLSS5-Swapper.git
cd DLSS5-Swapper && git checkout v2.2.X        # 或最新 tag

# 2. 把本仓库的汉化文件覆盖过去
cp /path/to/dlss5-zh-cn/src/renderer/i18n.js        src/renderer/
cp /path/to/dlss5-zh-cn/src/shared/feature-i18n.js   src/shared/
cp /path/to/dlss5-zh-cn/src/renderer/index.html      src/renderer/
# 其余改动文件同理，见下方「改动文件」表

# 3. 校验（关键：新增语种后测试断言需同步更新）
npm test

# 4. 提交并推回本仓库
```

### 校验汉化完整性

新增语种或上游改动 i18n 结构后，用这段脚本核对 `zh` 覆盖率：

```bash
node -e "
const fs=require('fs'),s=fs.readFileSync('src/renderer/i18n.js','utf8');
const block=(l)=>{const m=s.match(new RegExp('^  '+l+': \\\\{\\\\n([\\\\s\\\\S]*?)^  \\\\}','m'));
  return m?new Set([...m[1].matchAll(/^    ([a-zA-Z][a-zA-Z0-9]*):/gm)].map(x=>x[1])):new Set()};
const en=block('en'),zh=block('zh');
console.log('en='+en.size,'zh='+zh.size,'覆盖='+(100*[...en].filter(k=>zh.has(k)).length/en.size).toFixed(1)+'%');
"
```

---

## 为什么需要这个仓库

上游 v2.2.9 虽然在语言列表里已经登记了 `zh`（简体中文），但该语言包**基本是空的**——实测覆盖率仅 **16.5%**（170 个英文键中只翻了 28 个）。用户实际使用时会看到大量英文甚至直接回退。

本仓库把 `zh` 语言包补全到 **100% 覆盖**，因此把语言从"名义上支持"变成"真正可用"。

| 版本 | 英文键数 | 已翻译中文键数 | 覆盖率 |
|---|---|---|---|
|上游 v2.2.9 | 170 | 28 | 16.5% |
| **本仓库** | 173 | 271 | **100%** |

> 说明：中文字符数多于英文键数，是因为部分英文键为模板函数（如 `artFound: (a, b) => ...`），在中文中同样需要多个条目；另有部分键仅在特定版本新增。

## 覆盖范围

补全的内容包括此前缺失的几大模块：

- **反作弊警告** —— 上游 v2.2.9 新增的整套文案：`antiCheatWarningTitle`、`antiCheatWarning`、`errAntiCheatConsent`、`antiCheatRiskAccepted`
- **Mod 管理器冲突与加载器冲突** —— `errManagedModpack`、`errLoaderConflict`、`errRuntimeArchitecture`
- **安装路由与后端** —— `routeFeeder`、`routeRenodx`、`optiHint`、`multipassHint`、`backendHint`
- **游戏筛选与搜索** —— 搜索框、DLSS 状态筛选、图形 API 筛选、筛选结果计数
- **游戏详情面板** —— `sheetFacts`、`sheetSetup`、`sheetFiles`、`sheetCommunityTitle`
- **游戏内 F8 悬浮面板** —— 快捷键设置对话框、主题二（Theme 2）全部界面文案
- **历史、诊断与设置页** —— `historyRecovered`、`saveDiagnostics`、`setAutoScan`、`setTray` 等

## 改动文件

| 文件 | 改动 |
|---|---|
| `src/renderer/i18n.js` | 补全 `zh` 语言块（主界面、路由、错误提示） |
| `src/shared/feature-i18n.js` | 新增完整 `zh` 块（筛选、搜索、社区计数） |
| `src/renderer/index.html` | 为 4 处硬编码文案补 `data-i18n` 属性，使其可被翻译 |
| `src/renderer/chat.js` | 聊天界面接入 i18n |
| `src/renderer/community.js` | 社区页通知文案补 `zh` |
| `src/renderer/renderer.js` | 主渲染进程接入 i18n |
| `src/renderer/overlay-panel.js` | F8 悬浮面板接入 i18n |
| `src/renderer/overlay-gallery.js` | 悬浮面板图库接入 i18n |
| `src/overlay-bridge.js` | 悬浮面板桥接层文案接入 i18n |
| `main.js` | 主进程文案接入 i18n |
| `test/release-227.test.js` | 见下方「测试调整」 |
| `test/release-228.test.js` | 见下方「测试调整」 |

## 测试调整

上游有两处测试用**硬编码数字**校验"某文案在所有语言中都存在"：

```js
assert.equal(count, 2, 'in English and Arabic');  // 期望恰好 2 种语言
```

补全中文后该数量变为 3，断言随即失败。本次改动**没有简单改成 `3`**，因为那样上游下次新增语种时又会全部变红。改为按语种列表推导：

```js
const FULLY_TRANSLATED = ['en', 'ar', 'zh'];
const assertLocalized = (haystack, key) => {
  const count = (haystack.match(new RegExp(`${key}: `, 'g')) || []).length;
  assert.equal(count, FULLY_TRANSLATED.length,
    `${key} in ${FULLY_TRANSLATED.join(', ')}`);
};
```

改动后全量测试（281 项）的失败集合与上游 v2.2.9 **完全一致**，无新增回归。
> 注：上游本身有 27 项失败，均为依赖网络或注册表的用例，在本机环境同样失败，与汉化无关。

## 获取可运行版本

本仓库**只包含源码**，不含任何二进制文件。原因：

- `nvngx_dlssnr.dll` 等 NVIDIA 运行时为 NVIDIA 专有资产，**不可再分发**，其自带的 `.license.txt` 即声明独立授权
- 主程序 `DLSS 5 Swapper.exe` 体积远超 GitHub 单文件100MB 上限

请从官方渠道获取可运行版本，并自行比对 SHA-256：

- 安装版 / 便携版：`https://github.com/rakanki911/DLSS5-Swapper/releases`
- 校验和：`SHA256SUMS.txt`

将本仓库的汉化改动应用到便携版源码后，可自行用 `npm run build:portable` 重新构建。

## 许可与归属

本仓库整体沿用上游的 **MIT 协议**（见 `LICENSE`），原作者与版权声明保持不变。

各第三方组件保留其各自独立许可，详见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)，其中包括但不限于：

| 组件 | 许可 |
|---|---|
| DLSS5-Feeder | MIT |
| RenoDX（ShortFuse） | 独立许可 |
| VORT 着色器 | 见 `payload/feeder/licenses/VORT-LICENSE.txt` |
| OptiScaler DLSS-NR | GNU GPL v3（运行时下载，不随包分发） |
| dgVoodoo2 | 作者自有许可（运行时下载） |
| NVIDIA Streamline / DLSS | NVIDIA 专有许可，**不随本仓库分发** |

本仓库未新增任何第三方代码，仅翻译既有文案。

## 免责声明

DLSS、DLSS 5 及相关运行时为 NVIDIA Corporation 的商标与产品。本项目是**非官方的第三方工具**，与 NVIDIA 无隶属关系，也未获得 NVIDIA 背书或支持。

给游戏注入修改过的渲染文件可能与反作弊系统冲突，导致崩溃或账号风险。本项目**不会禁用或绕过任何反作弊机制**。请自行留意游戏服务条款。