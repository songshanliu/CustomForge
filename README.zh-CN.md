<div align="center">

# Open Product Customizer

**让二维纹理画布实时呈现在三维产品上**

一个轻量、与前端框架无关的产品定制原型，基于 Fabric.js 和 Three.js 构建浏览器端 2D 到 3D 定制体验

<p>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-r185-111111?logo=threedotjs&logoColor=white">
  <img alt="Fabric.js" src="https://img.shields.io/badge/Fabric.js-7-DB4D6D">
  <img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-2F6F9F">
</p>

<p>
  <a href="./README.md">English</a> |
  <strong>中文简体</strong>
</p>

</div>

---

## 项目能力

Open Product Customizer 将常见的二维设计界面与带 UV 的三维模型连接起来：

- 在二维纹理画布上添加和编辑文字
- 上传、移动、缩放和旋转图片
- 将画布的每次变化实时呈现在三维产品上
- 加载远程 GLB/GLTF 模型和可选的基础纹理
- 通过 Mesh 名称指定可定制表面
- 使用 OrbitControls 旋转和缩放三维预览
- 将合成后的纹理导出为 PNG

工作台内置了一个程序生成的杯子，无需准备外部资源即可直接运行

## 快速开始

环境要求：Node.js 22+ 和 pnpm 11+

```bash
pnpm install
pnpm dev
```

打开 Vite 输出的地址

内置演示的左侧是 UV 编辑区，右侧是实时三维预览

## 加载你的产品

在演示页面中选择 **Load remote**，然后填写：

| 字段 | 用途 |
| --- | --- |
| GLB / GLTF URL | 带 UV 的三维产品模型地址 |
| Base texture URL | 显示在可编辑对象下方的可选基础纹理 |
| Customizable mesh | 接收实时画布纹理的 Mesh 名称 |
| Flip texture vertically | 在模型需要时修正纹理的垂直方向 |

UV 坐标应当保存在三维模型中

可选的纹理图片只是二维编辑器的基础图层，不能替代模型中的 UV 数据

> [!IMPORTANT]
> 远程模型、纹理、贴图和字体必须提供允许当前页面来源访问的 CORS 响应头
>
> 被浏览器阻止或污染 Canvas 的资源可能无法加载，也会导致 PNG 导出失败

## 基本用法

与框架无关的源码入口是 [`src/index.ts`](./src/index.ts)，可以挂载到任意两个 DOM 容器中：

```html
<div id="texture-editor"></div>
<div id="product-viewer"></div>
```

```ts
import { createCustomizer } from './src'

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
  color: '#172126',
})

await customizer.addImage({
  src: 'https://example.com/logo.png',
  x: 720,
  y: 240,
  width: 220,
})
```

本仓库目前尚未发布 npm 包或独立的库制品

当前 Vite 构建生成的是演示应用，`src/index.ts` 是未来计划使用的库边界

## 实例 API

| 方法 | 说明 |
| --- | --- |
| `addText(options)` | 添加并选中一个可编辑的文字对象 |
| `addImage(options)` | 加载、添加并选中一个图片对象 |
| `deleteSelected()` | 删除当前对象或选区 |
| `loadProduct(product)` | 更换模型、基础纹理和目标 Mesh |
| `exportTexture(filename?)` | 将合成纹理下载为 PNG |
| `resetView()` | 恢复默认三维相机位置 |
| `on(event, listener)` | 订阅实例事件，并返回取消订阅函数 |
| `destroy()` | 释放 DOM 事件、Fabric 状态和 WebGL 资源 |

当前事件包括 `ready`、`change`、`selectionchange`、`status` 和 `error`

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
    H --> I[可定制 Mesh]
```

```text
ProductCustomizer
|-- DesignEditor      Fabric.js 渲染和对象交互
|-- ProductViewer     Three.js 场景、模型、材质和相机
`-- TextureBridge     Canvas 到材质的同步
```

`ProductCustomizer` 负责协调各模块，并将 Fabric.js 和 Three.js 的实现细节隐藏在小型实例 API 后面

演示界面使用原生 TypeScript，核心不依赖 Vue、React 或其他 UI 框架

## 模型约定

当前原型要求：

- GLB 或 GLTF 模型包含有效的 UV 坐标
- 模型未经压缩，能够由标准 Three.js `GLTFLoader` 直接加载
- 模型具有一个用于定制表面的命名 Mesh，例如 `PrintArea`
- 目标纹理位于该 Mesh 的第一个材质槽中
- 浏览器可以在 CORS 策略下访问远程资源地址

内置演示同样遵循 `PrintArea` Mesh 命名约定

## 项目结构

```text
src/
|-- bridge/           Canvas 与 Three.js 纹理同步
|-- core/             公共类型、配置和 DOM 工具
|-- customizer/       公共实例编排
|-- demo/             可运行的工作台界面
|-- editor/           Fabric.js 设计画布
|-- viewer/           Three.js 产品预览
`-- index.ts          与框架无关的源码入口
```

## 开发命令

```bash
pnpm check       # TypeScript 项目检查
pnpm test        # 单元测试
pnpm build       # 类型检查和生产构建
pnpm preview     # 预览生产构建
```

## 当前范围

这是一个早期技术原型

公共 API 和设计文档格式尚未稳定

当前里程碑有意聚焦于一张纹理和一个可定制 Mesh

多定制面、撤销与重做、设计序列化、框架适配器和可分发制品暂不在当前范围内

## 技术栈

- [Fabric.js](https://fabricjs.com/)：二维编辑画布
- [Three.js](https://threejs.org/)：模型加载和实时三维渲染
- [Vite](https://vite.dev/)：开发环境和应用构建
- [TypeScript](https://www.typescriptlang.org/)：启用严格类型检查

## 开源协议

Open Product Customizer 依据 Apache License 2.0 开源

完整协议内容请参阅 [LICENSE](./LICENSE)

第三方依赖和资产仍遵循各自的许可条款
