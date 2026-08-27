/** 创建 Workbench 使用的静态 DOM 结构 */
export function createWorkbenchElement(): HTMLElement {
  const root = document.createElement('main')
  root.className = 'customforge-workbench'
  root.setAttribute('aria-label', 'Product customization workbench')
  root.innerHTML = `
    <header class="customforge-workbench__topbar" data-layout="header">
      <div class="customforge-workbench__brand" aria-label="CustomForge">
        <span class="customforge-workbench__brand-mark"><i data-customforge-icon="box"></i></span>
        <span class="customforge-workbench__brand-copy">
          <strong data-role="brand-title">CustomForge</strong>
          <span data-role="brand-subtitle">Product customization workbench</span>
        </span>
      </div>
      <div class="customforge-workbench__global-actions">
        <button class="customforge-workbench__button customforge-workbench__button--secondary" data-action="load-remote" data-feature="loadRemoteProduct" type="button">
          <i data-customforge-icon="link-2"></i>
          <span>Load product</span>
        </button>
        <button class="customforge-workbench__button customforge-workbench__button--primary" data-action="export-texture" data-feature="exportTexture" type="button">
          <i data-customforge-icon="download"></i>
          <span>Export PNG</span>
        </button>
      </div>
    </header>

    <section class="customforge-workbench__workspace">
      <section class="customforge-workbench__panel customforge-workbench__panel--editor" aria-label="UV workspace">
        <header class="customforge-workbench__panelbar" data-layout="editorHeader">
          <div class="customforge-workbench__panel-title">
            <span class="customforge-workbench__panel-index">01</span>
            <h1>UV workspace</h1>
          </div>
          <span class="customforge-workbench__resolution" data-role="resolution">1024 x 512</span>
        </header>

        <div class="customforge-workbench__toolbar" data-layout="toolbar" role="toolbar" aria-label="Design tools">
          <button class="customforge-workbench__tool-button" data-action="add-text" data-feature="addText" type="button" title="Add text">
            <i data-customforge-icon="type"></i><span>Add text</span>
          </button>
          <button class="customforge-workbench__tool-button" data-action="add-image" data-feature="addImage" type="button" title="Add image">
            <i data-customforge-icon="image-plus"></i><span>Add image</span>
          </button>
          <span class="customforge-workbench__separator" data-tool-group="design-document" aria-hidden="true"></span>
          <button class="customforge-workbench__icon-button" data-action="save-design" data-feature="saveDesign" type="button" title="Save design JSON" aria-label="Save design JSON">
            <i data-customforge-icon="save"></i>
          </button>
          <button class="customforge-workbench__icon-button" data-action="load-design" data-feature="loadDesign" type="button" title="Load design JSON" aria-label="Load design JSON">
            <i data-customforge-icon="folder-open"></i>
          </button>
          <span class="customforge-workbench__separator" data-tool-group="selection" aria-hidden="true"></span>
          <button class="customforge-workbench__icon-button" data-action="delete-selection" data-feature="deleteSelection" type="button" title="Delete selected object" aria-label="Delete selected object" disabled>
            <i data-customforge-icon="trash-2"></i>
          </button>
        </div>

        <div class="customforge-workbench__editor-body">
          <div class="customforge-workbench__editor-stage" data-role="editor-host"></div>
          <aside class="customforge-workbench__layers" data-layout="layers" aria-label="Object layers">
            <header class="customforge-workbench__layers-header">
              <span><i data-customforge-icon="layers-3"></i>Layers</span>
              <span data-role="layer-count">0</span>
            </header>
            <ol class="customforge-workbench__layer-list" data-role="layer-list"></ol>
          </aside>
        </div>
      </section>

      <section class="customforge-workbench__panel customforge-workbench__panel--viewer" aria-label="Live product">
        <header class="customforge-workbench__panelbar" data-layout="viewerHeader">
          <div class="customforge-workbench__panel-title">
            <span class="customforge-workbench__panel-index">02</span>
            <h2>Live product</h2>
          </div>
          <button class="customforge-workbench__icon-button" data-action="reset-view" data-feature="resetView" type="button" title="Reset 3D view" aria-label="Reset 3D view">
            <i data-customforge-icon="rotate-ccw"></i>
          </button>
        </header>
        <div class="customforge-workbench__viewer-stage" data-role="viewer-host">
          <span class="customforge-workbench__loading">Preparing 3D scene</span>
        </div>
      </section>
    </section>

    <footer class="customforge-workbench__statusbar" data-layout="status">
      <span class="customforge-workbench__status-indicator" aria-hidden="true"></span>
      <span data-role="status-label" role="status">Starting</span>
      <span class="customforge-workbench__object-count" data-role="object-count">0 objects</span>
    </footer>

    <input data-role="image-input" type="file" accept="image/png,image/jpeg,image/webp" hidden>
    <input data-role="design-input" type="file" accept="application/json,.json" hidden>

    <dialog class="customforge-workbench__dialog" data-role="load-dialog">
      <form method="dialog" data-role="remote-form">
        <header class="customforge-workbench__dialog-header">
          <div>
            <span class="customforge-workbench__eyebrow">Product source</span>
            <h2>Load remote product</h2>
          </div>
          <button class="customforge-workbench__icon-button" data-action="close-dialog" type="button" title="Close" aria-label="Close">
            <i data-customforge-icon="x"></i>
          </button>
        </header>
        <div class="customforge-workbench__form-fields">
          <label>
            <span>GLB / GLTF URL</span>
            <div class="customforge-workbench__input-shell">
              <i data-customforge-icon="link-2"></i>
              <input data-role="model-url" name="modelUrl" type="url" placeholder="https://example.com/product.glb" required>
            </div>
          </label>
          <label>
            <span>Base texture URL</span>
            <div class="customforge-workbench__input-shell">
              <i data-customforge-icon="image-plus"></i>
              <input data-role="texture-url" name="textureUrl" type="url" placeholder="https://example.com/texture.png">
            </div>
          </label>
          <label>
            <span>Customizable mesh</span>
            <input data-role="mesh-name" name="meshName" type="text" value="PrintArea" required>
          </label>
          <label class="customforge-workbench__check-field">
            <input data-role="flip-texture" name="flipTexture" type="checkbox">
            <span>Flip texture vertically</span>
          </label>
        </div>
        <footer class="customforge-workbench__dialog-actions">
          <button class="customforge-workbench__button customforge-workbench__button--secondary" data-action="use-demo" type="button">Use built-in demo</button>
          <button class="customforge-workbench__button customforge-workbench__button--primary" data-action="submit-product" type="submit">
            <i data-customforge-icon="upload"></i><span>Load product</span>
          </button>
        </footer>
      </form>
    </dialog>
  `
  return root
}
