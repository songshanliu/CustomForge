<div align="center">

<img src="./src/workbench/assets/CustomForgeLogo.png" alt="CustomForge Logo" width="136">

<h1>CustomForge</h1>

<hr>

<p><strong>让二维纹理画布实时呈现在三维产品上</strong></p>

<p>一个轻量、与前端框架无关的产品定制工具，基于 Fabric.js 和 Three.js 构建浏览器端 2D 到 3D 定制体验</p>

<p>
  <a href="./README.md">English</a>
  <span> · </span>
  <strong>简体中文</strong>
</p>

<p>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-2563EB?style=flat-square&logo=typescript&logoColor=white&labelColor=1F2937">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-7C3AED?style=flat-square&logo=vite&logoColor=white&labelColor=1F2937">
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-r185-27272A?style=flat-square&logo=threedotjs&logoColor=white&labelColor=1F2937">
  <img alt="Fabric.js" src="https://img.shields.io/badge/Fabric.js-7-BE185D?style=flat-square&labelColor=1F2937">
  <img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-0F766E?style=flat-square&logo=apache&logoColor=white&labelColor=1F2937">
</p>

</div>

---

## 操作演示

![CustomForge 商品定制操作演示](./.github/assets/demo.gif)

## 项目能力

CustomForge 将常见的二维设计界面与带 UV 的三维模型连接起来：

- 在二维纹理画布上添加和编辑文字
- 通过 Office 风格的上下文格式栏调整选中文字
- 上传、移动、缩放和旋转图片
- 将画布的每次变化实时呈现在三维产品上
- 上传本地 GLB 模型，或加载远程 GLB/GLTF 模型和可选的基础纹理
- 通过 Mesh 名称指定可定制表面
- 将目标 Mesh 的 UV 可打印区域和外边界显示为不会导出的编辑辅助层
- 使用 OrbitControls 旋转和缩放三维预览
- 将合成后的纹理导出为 PNG
- 通过版本化 Design JSON 保存和恢复可编辑对象
- 通过名称、显隐、锁定和顺序管理对象图层
- 使用设计快照撤销和重做修改
- 使用可配置的文字、背景和装饰素材 Dialog
- 通过品牌、文案、主题变量和图标适配默认 Workbench

工作台默认加载随包提供的 `cup_decal_small_margins.glb`，无需请求外部模型即可直接运行

## 仓库开发

环境要求：Node.js 22+ 和 pnpm 11+

```bash
pnpm install
pnpm dev
```

打开 Vite 输出的地址

内置演示的左侧是 UV 编辑区，右侧是实时三维预览

## npm Alpha 制品

CustomForge 已通过 `alpha` dist-tag 发布到 npm Registry，不同 alpha 版本之间的 API 和 Design JSON Schema 可能发生变化

使用以下命令安装当前公开 alpha：

```powershell
pnpm add customforge@alpha
```

Fabric.js 和 Three.js 会作为传递依赖自动安装

pnpm 可能提示可选的原生 `canvas` 构建脚本已被忽略，CustomForge 运行在浏览器中，不使用 Node 原生 canvas，因此不需要执行 `pnpm approve-builds`

消费项目可以在 `package.json` 中明确记录这一浏览器端选择：

```json
{
  "pnpm": {
    "ignoredBuiltDependencies": ["canvas"]
  }
}
```

包页面：[npmjs.com/package/customforge](https://www.npmjs.com/package/customforge)

发布前如需进行独立于仓库源码的验证，可在仓库根目录构建并生成本地包：

```powershell
pnpm pack:local
```

命令依次生成 JavaScript、TypeScript 声明和公开样式，检查 npm 文件清单，并创建：

```text
customforge-0.1.0-alpha.2.tgz
```

在独立 Vite TypeScript 项目中安装该本地制品：

```powershell
pnpm add D:\projects\3DRendering\core_code\customforge-0.1.0-alpha.2.tgz
```

仓库中的 `examples/npm-consumer` 提供了一个只通过该 `.tgz` 导入的消费示例。在该目录中使用 `pnpm install --ignore-workspace`，确保 pnpm 将其作为独立于父级 workspace 的项目安装

## 加载你的产品

在演示页面中选择 **Load product**，然后上传一个资源完整的本地 `.glb` 文件，或填写远程 GLB / GLTF 地址。本地 `.gltf` 文件可能依赖独立的二进制文件和纹理，因此不支持直接上传

以下设置位于默认收起的 **Advanced options** 中：

| 设置 | 用途 |
| --- | --- |
| Base artwork URL | 放在可编辑对象下方，并包含在合成纹理中的可选图片 |
| Printable mesh name | 接收实时画布纹理的 Mesh 名称，默认为 `PrintArea` |
| Flip texture vertically | 仅在设计内容显示为上下颠倒时启用 |

UV 坐标应当保存在三维模型中

可选的纹理图片只是二维编辑器的基础图层，不能替代模型中的 UV 数据；未提供时，设计画布和可打印贴花层保持透明

每次加载产品后，编辑器会读取目标 Mesh 的 UV 坐标，并在设计画布上方显示轻微的可打印区域底纹及其外边界。内部三角剖分保持隐藏，该辅助层不会写入实时纹理、Design JSON 或导出的 PNG

> [!IMPORTANT]
> 远程模型、纹理、贴图和字体必须提供允许当前页面来源访问的 CORS 响应头
>
> 被浏览器阻止或污染 Canvas 的资源可能无法加载，也会导致 PNG 导出失败

## 基本用法

与框架无关的 Library 入口可以挂载到任意两个 DOM 容器中：

CustomForge 仅支持浏览器环境，应在 DOM 挂载容器可用后创建实例

编辑器和查看器必须使用两个不同的容器；页面卸载、组件卸载或不再使用实例时必须调用 `destroy()` 释放 Fabric、WebGL、观察器和事件资源

```html
<div id="texture-editor"></div>
<div id="product-viewer"></div>
```

```ts
import { createCustomizer } from 'customforge'
import 'customforge/style.css'

const customizer = await createCustomizer({
  editor: '#texture-editor',
  viewer: '#product-viewer',
  editorWidth: 1024,
  editorHeight: 512,
  product: {
    modelUrl: 'https://example.com/product.glb',
    textureUrl: 'https://example.com/base-texture.png',
    surfaceMesh: 'PrintArea',
    textureFlipY: false,
  },
})

customizer.addText({
  text: 'Hello world',
  x: 120,
  y: 180,
  fontSize: 64,
  fontWeight: 'bold',
  textAlign: 'center',
  color: '#172126',
})

await customizer.addImage({
  src: 'https://example.com/logo.png',
  x: 720,
  y: 240,
  width: 220,
})

window.addEventListener('beforeunload', () => customizer.destroy(), {
  once: true,
})
```

公开包与本地 `.tgz` 使用相同的根入口和样式入口；需要可重复安装时应固定具体 alpha 版本

## 开箱即用的 Workbench

不希望从零编写控制界面时，可以使用可选的 Workbench 入口

挂载元素必须设置明确高度，设计画布、图层面板和三维区域才能正确计算可用空间

```html
<div id="customforge-workbench" style="height: 720px"></div>
```

```ts
import { createWorkbench } from 'customforge/workbench'
import 'customforge/style.css'

const workbench = await createWorkbench({
  container: '#customforge-workbench',
  product: {
    modelUrl: 'https://example.com/product.glb',
    surfaceMesh: 'PrintArea',
  },
  features: {
    presetBackgrounds: true,
    presetElements: true,
  },
  layout: {
    header: true,
    layers: true,
  },
  branding: {
    logoUrl: '/brand/logo.png',
    title: '定制工作室',
    subtitle: '产品个性化设计',
  },
  labels: {
    addText: '文字设计',
    addImage: '图片素材',
    productDialogTitle: '选择商品模型',
    loadingProduct: '正在加载商品……',
  },
  fontFamilies: [
    { value: 'Arial', label: '无衬线字体' },
    { value: 'Georgia', label: '衬线字体' },
  ],
  formatError: () => '资源加载失败，请检查文件或网络连接',
  theme: {
    accent: '#0057b8',
    accentHover: '#003f87',
    accentContrast: '#ffffff',
  },
  assets: {
    backgrounds: [
      { id: 'floral', name: '花卉背景', url: '/presets/floral.png' },
    ],
    elements: [
      { id: 'flower', name: '小花', url: '/presets/flower.png' },
    ],
  },
})
```

默认使用包内的 CustomForge Logo，可以通过 `branding` 替换或隐藏

`labels` 覆盖 Workbench 中所有固定标签、Dialog 文案、占位符、校验提示、状态、颜色名称、下载文件名和无障碍名称。由配置数据生成的可见名称分别通过 `fontFamilies`、`textPresets`、`assets` 和 `branding` 传入，模型、图片、UV 与 Design JSON 异常则通过 `formatError` 转换为面向用户的提示

CustomForge 提供默认英文文案，但不接管应用的当前语言状态。宿主项目应从自身 i18n 系统生成配置，并使用当前语言包创建 Workbench，从而避免与 Vue I18n、React Intl 或其他国际化方案耦合

编写完整语言包时可以使用导出的 `WorkbenchLabels` 类型进行字段完整性检查；`WorkbenchOptions.labels` 仍保持为可选字段集合，少量改词时无需重复全部默认值

`theme` 映射到限定作用域的 CSS 变量，`icons` 可以关闭内置图标或用图片地址替换指定语义图标

默认界面字体栈优先使用圆润的 `Nunito Sans`，不可用时回退到系统无衬线字体

CustomForge 会随制品提供该字体资源，不会在运行时请求第三方字体服务

文字和图片命令现在会打开专用 Dialog，不会在点击工具栏按钮后立即修改画布

- 文字 Dialog 提供文本输入、颜色选择和可替换的排版预设
- 选中一个或多个文字对象时，现有单行工具栏会在不推动画布的情况下显示上下文格式控件，用于调整字体、字号、粗体、斜体、下划线、对齐、文字色、高亮色、行高和字距
- 上下文格式栏支持多选混合状态，并提供明确的画布内文字编辑入口
- 图片 Dialog 提供本地上传、预设背景和装饰元素
- 设计背景会替换已有设计背景、铺满当前商品的 UV 可打印边界、默认锁定在最底层并保存到 Design JSON
- 选中普通图片后可以将其转换为设计背景，自动适配当前 UV 可打印边界并移动到最底层

功能和布局开关也可以在初始化后动态调整

```ts
workbench.setFeature('addText', true)
workbench.setLayout('header', true)
```

| 功能开关 | 控制内容 |
| --- | --- |
| `addText`、`addImage`、`deleteSelection` | 对象 Dialog 和删除操作 |
| `textFormatting` | 上下文文字格式栏 |
| `undoRedo` | 撤销、重做按钮和 Workbench 键盘快捷键 |
| `saveDesign`、`loadDesign` | Design JSON 操作 |
| `loadRemoteProduct`、`resetView` | 产品加载和预览操作 |
| `reorderObjects`、`toggleObjectVisibility`、`lockObjects`、`renameObjects` | 图层管理 |
| `presetBackgrounds`、`presetElements` | 图片 Dialog 中的预设素材页签 |

| 布局开关 | 控制区域 |
| --- | --- |
| `header` | 品牌和全局产品操作 |
| `editorHeader`、`viewerHeader` | 工作区面板标题栏 |
| `toolbar` | 设计工具栏 |
| `layers` | 对象图层面板 |
| `status` | 运行状态和对象数量 |

所有功能和布局开关默认均为 `true`

功能开关只控制 Workbench 自带控件，不会移除 `workbench.customizer` 上的底层方法。Workbench 顶栏不再提供 PNG 导出入口，仍可通过 `workbench.customizer.exportTexture()` 使用底层导出能力

主题配置用于统一的产品级视觉调整，不提供难以维护的逐按钮颜色配置

```ts
const workbench = await createWorkbench({
  container: '#customforge-workbench',
  icons: {
    enabled: true,
    sources: {
      addText: '/icons/typography.svg',
      loadProduct: '/icons/upload.svg',
    },
  },
  textPresets: [
    {
      id: 'brand-display',
      name: '品牌展示',
      fontFamily: 'Arial',
      fontSize: 72,
      width: 460,
      color: '#17191c',
    },
  ],
})
```

## Design JSON

`saveDesign()` 返回由 Library 自身定义、可安全写入 JSON 的文档，不暴露 Fabric.js 序列化格式。`loadDesign()` 校验未知输入，并异步恢复可编辑对象栈：

```ts
const design = customizer.saveDesign()
localStorage.setItem('customforge-design', JSON.stringify(design))

const savedDesign = localStorage.getItem('customforge-design')
if (savedDesign) {
  await customizer.loadDesign(JSON.parse(savedDesign))
}
```

当前 Schema 版本为 `1`，文档保存逻辑画布尺寸，并按从后到前的渲染顺序保存文字和图片对象，包括稳定对象 ID、名称、显隐、锁定状态、图片用途、基于中心点的变换和丰富的文字排版属性。缺少可选排版字段的旧版 version 1 文档仍按原有的粗体、居中默认值加载

Design JSON 有意排除产品模型、目标 Mesh 和基础纹理。文档只能加载到逻辑宽高完全相同的编辑器中

带有 `role: 'background'` 的图片是设计对象，不是产品基础纹理，只允许存在一个并且必须位于对象数组首位，旧版 v1 文档缺少 `role` 时继续按普通图片元素加载

加载具有事务性：只有文档校验通过且全部引用图片成功加载后，当前设计才会被替换。Blob URL 图片会在添加时转换为 Data URL；远程图片仍保留 URL，恢复时必须继续满足浏览器 CORS 要求

该 Schema 目前仍属于 alpha 契约，后续 alpha 版本可能调整

## 撤销与重做

无界面核心和 Workbench 都支持历史记录，默认保留 50 个撤销步骤

可以在 `createCustomizer` 或 `createWorkbench` 配置中通过 `historyLimit` 调整保留的撤销深度

```ts
if (customizer.canUndo()) {
  await customizer.undo()
}

await customizer.redo()
customizer.clearHistory()

const stop = customizer.on('historychange', ({ canUndo, canRedo }) => {
  console.log({ canUndo, canRedo })
})
```

历史记录覆盖对象添加、删除、画布变换、文字内容与格式编辑、图片转背景、图层排序、名称、显隐、锁定和 Design JSON 加载

Workbench 在焦点不位于表单控件时支持 `Ctrl` 或 `Cmd` + `Z`、`Ctrl` 或 `Cmd` + `Shift` + `Z` 和 `Ctrl` + `Y`

成功更换产品后会保留当前设计对象，但以当前设计重新开始历史记录

## 实例 API

| 方法 | 说明 |
| --- | --- |
| `addText(options)` | 添加并选中文字并自动约束在画布内；`fontSize` 默认为 `22` |
| `addImage(options)` | 加载普通图片元素或替换设计背景 |
| `getObjects()` | 按从后到前的图层顺序返回当前对象 |
| `getSelectedObjectIds()` | 返回当前选区中的稳定对象 ID |
| `selectObject(id)` | 根据稳定 ID 选中可见对象 |
| `clearSelection()` | 清除当前画布选区且不修改设计内容 |
| `removeObject(id)` | 根据稳定 ID 删除对象 |
| `moveObject(id, index)` | 将对象移动到从 0 开始的图层索引 |
| `setImageAsBackground(id)` | 使用现有图片替换设计背景并自动适配当前 UV 可打印边界 |
| `renameObject(id, name)` | 修改图层工具中显示的对象名称 |
| `setObjectVisibility(id, visible)` | 设置对象是否参与渲染 |
| `setObjectLocked(id, locked)` | 锁定或解锁画布变换 |
| `updateText(id, options)` | 按稳定 ID 修改文字内容和排版样式 |
| `editText(id)` | 让未锁定文字进入画布内编辑状态 |
| `deleteSelected()` | 删除当前对象或选区 |
| `saveDesign()` | 返回当前版本化 Design JSON 文档 |
| `loadDesign(value)` | 校验并以事务方式恢复 Design JSON |
| `canUndo()`、`canRedo()` | 查询当前可用的历史方向 |
| `undo()`、`redo()` | 恢复前一个或后一个设计快照 |
| `clearHistory()` | 将当前设计设为新的历史起点 |
| `loadProduct(product)` | 更换模型、基础纹理和目标 Mesh |
| `exportTexture(filename?)` | 将合成纹理下载为 PNG |
| `resetView()` | 恢复默认三维相机位置 |
| `on(event, listener)` | 订阅实例事件，并返回取消订阅函数 |
| `destroy()` | 释放 DOM 事件、Fabric 状态和 WebGL 资源 |

当前事件包括 `ready`、`change`、`selectionchange`、`historychange`、`status` 和 `error`

首个 alpha 的稳定候选边界只包括上表方法、`createCustomizer`、`ProductCustomizer`、`customforge/workbench` 入口，以及从已声明入口导出的配置、事件、Workbench 和 Design JSON 类型

`ProductCustomizer` 不公开 Fabric.js 编辑器和 Three.js 查看器实例，使用方只通过门面 API 操作定制器

不支持从 `core`、`editor`、`viewer`、`bridge` 或其他未声明的包子路径导入模块

## 架构

```mermaid
flowchart LR
    A[文字和图片] --> B[DesignEditor]
    C[基础纹理] --> B
    B --> D[HTML Canvas]
    D --> E[TextureBridge]
    E --> F[Three.js CanvasTexture]
    G[GLB / GLTF 模型] --> H[ProductViewer]
    F --> H
    H --> I[可打印 Mesh]
```

```text
ProductCustomizer
|-- DesignEditor      Fabric.js 渲染和对象交互
|-- ProductViewer     Three.js 场景、模型、材质和相机
`-- TextureBridge     Canvas 到材质的同步
```

`ProductCustomizer` 负责协调各模块，并将 Fabric.js 和 Three.js 的实现细节隐藏在小型实例 API 后面

可选 Workbench 和演示界面使用原生 TypeScript，核心不依赖 Vue、React 或其他 UI 框架

## 模型约定

当前原型要求：

- GLB 或 GLTF 模型包含有效的 UV 坐标
- 模型未经压缩，能够由标准 Three.js `GLTFLoader` 直接加载
- 模型具有一个用于定制表面的命名 Mesh，例如 `PrintArea`
- 目标纹理位于该 Mesh 的第一个材质槽中
- 浏览器可以在 CORS 策略下访问远程资源地址

随包提供的默认模型将完整杯体保存为 `MugBody`，并将带 UV 的可打印贴花层保存为 `PrintArea`。CustomForge 会保留杯体材质，只把实时设计纹理应用到 `PrintArea`

## 项目结构

```text
src/
|-- bridge/           Canvas 与 Three.js 纹理同步
|-- core/             公共类型、配置和 DOM 工具
|-- customizer/       公共实例编排
|-- demo/             可运行的工作台界面
|-- editor/           Fabric.js 设计画布和快照历史
|-- style.css         Library 公开样式入口
|-- styles/           核心和 Workbench 样式
|-- viewer/           Three.js 产品预览
|-- workbench/        可配置界面、Dialog、图标和预设素材
`-- index.ts          与框架无关的源码入口

examples/
`-- npm-consumer/     本地 .tgz 独立消费示例

scripts/
`-- verify-package.mjs  npm 文件和制品边界检查
```

## 开发命令

```bash
pnpm check       # TypeScript 项目检查
pnpm test        # 单元测试
pnpm build       # 类型检查和生产构建
pnpm build:lib   # 构建核心与 Workbench ESM、类型声明和样式
pnpm verify:package # 检查 dist 和 npm 文件清单
pnpm pack:local  # 构建、检查并生成本地 .tgz
pnpm release:check # 执行检查、测试、制品构建、校验和本地打包
pnpm preview     # 预览生产构建
```

## 当前范围

这是一个早期技术原型

公共 API 和设计文档格式尚未稳定

当前里程碑有意聚焦于一张纹理和一个可定制 Mesh

在 API 和 Design JSON 契约进入更稳定阶段前，公开 npm 版本统一使用 `alpha` dist-tag

多定制面、高级对齐工具和框架适配器仍未实现

## 技术栈

- [Fabric.js](https://fabricjs.com/)：二维编辑画布
- [Three.js](https://threejs.org/)：模型加载和实时三维渲染
- [Lucide](https://lucide.dev/)：打包到 Workbench 中的界面图标
- [Vite](https://vite.dev/)：开发环境和应用构建
- [TypeScript](https://www.typescriptlang.org/)：启用严格类型检查

## 开源协议

CustomForge 依据 Apache License 2.0 开源

完整协议内容请参阅 [LICENSE](./LICENSE)

第三方依赖和资产仍遵循各自的许可条款

随包提供的 Nunito Sans 字体遵循 SIL Open Font License 1.1，完整条款见 [NunitoSans-OFL.txt](./LICENSES/NunitoSans-OFL.txt)

随包提供的 Plain Mug 模型由 LightSwitch 创作并采用 CC BY 4.0，署名和来源信息见 [plain-mug-CC-BY-4.0.txt](./LICENSES/plain-mug-CC-BY-4.0.txt)
