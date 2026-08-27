/** 创建 Workbench 使用的静态 DOM 结构 */
export function createWorkbenchElement(): HTMLElement {
  const root = document.createElement('main')
  root.className = 'customforge-workbench'
  root.innerHTML = `
    <header class="customforge-workbench__topbar" data-layout="header">
      <div class="customforge-workbench__brand" data-role="brand">
        <img class="customforge-workbench__brand-logo" data-role="brand-logo" alt="">
        <span class="customforge-workbench__brand-copy" data-role="brand-copy">
          <strong data-role="brand-title"></strong>
          <span data-role="brand-subtitle"></span>
        </span>
      </div>
      <div class="customforge-workbench__global-actions">
        <button class="customforge-workbench__button customforge-workbench__button--secondary" data-action="load-remote" data-feature="loadRemoteProduct" data-control-label="loadProduct" type="button">
          <i data-customforge-icon="link-2" data-icon-slot="loadProduct"></i>
          <span data-label="loadProduct"></span>
        </button>
        <button class="customforge-workbench__button customforge-workbench__button--primary" data-action="export-texture" data-feature="exportTexture" data-control-label="exportTexture" type="button">
          <i data-customforge-icon="download" data-icon-slot="exportTexture"></i>
          <span data-label="exportTexture"></span>
        </button>
      </div>
    </header>

    <section class="customforge-workbench__workspace">
      <section class="customforge-workbench__panel customforge-workbench__panel--editor" data-region-label="editorTitle">
        <header class="customforge-workbench__panelbar" data-layout="editorHeader">
          <div class="customforge-workbench__panel-title">
            <span class="customforge-workbench__panel-kicker">2D</span>
            <h1 data-label="editorTitle"></h1>
          </div>
          <span class="customforge-workbench__resolution" data-role="resolution">1024 x 512</span>
        </header>

        <div class="customforge-workbench__toolbar" data-layout="toolbar" data-region-label="workbench" role="toolbar">
          <div class="customforge-workbench__tool-group" data-tool-group="history">
            <button class="customforge-workbench__icon-button" data-action="undo" data-feature="undoRedo" data-control-label="undo" type="button" disabled>
              <i data-customforge-icon="undo-2" data-icon-slot="undo"></i>
              <span class="customforge-workbench__icon-label" data-label="undo"></span>
            </button>
            <button class="customforge-workbench__icon-button" data-action="redo" data-feature="undoRedo" data-control-label="redo" type="button" disabled>
              <i data-customforge-icon="redo-2" data-icon-slot="redo"></i>
              <span class="customforge-workbench__icon-label" data-label="redo"></span>
            </button>
          </div>
          <span class="customforge-workbench__separator" data-tool-group="history-separator" aria-hidden="true"></span>
          <div class="customforge-workbench__tool-group" data-tool-group="insert">
            <button class="customforge-workbench__tool-button" data-action="open-text-dialog" data-feature="addText" data-control-label="addText" type="button">
              <i data-customforge-icon="type" data-icon-slot="addText"></i>
              <span data-label="addText"></span>
            </button>
            <button class="customforge-workbench__tool-button" data-action="open-image-dialog" data-feature="addImage" data-control-label="addImage" type="button">
              <i data-customforge-icon="image-plus" data-icon-slot="addImage"></i>
              <span data-label="addImage"></span>
            </button>
          </div>
          <span class="customforge-workbench__separator" data-tool-group="document-separator" aria-hidden="true"></span>
          <div class="customforge-workbench__tool-group" data-tool-group="document">
            <button class="customforge-workbench__icon-button" data-action="save-design" data-feature="saveDesign" data-control-label="saveDesign" type="button">
              <i data-customforge-icon="save" data-icon-slot="saveDesign"></i>
              <span class="customforge-workbench__icon-label" data-label="saveDesign"></span>
            </button>
            <button class="customforge-workbench__icon-button" data-action="load-design" data-feature="loadDesign" data-control-label="loadDesign" type="button">
              <i data-customforge-icon="folder-open" data-icon-slot="loadDesign"></i>
              <span class="customforge-workbench__icon-label" data-label="loadDesign"></span>
            </button>
          </div>
          <span class="customforge-workbench__separator" data-tool-group="selection-separator" aria-hidden="true"></span>
          <button class="customforge-workbench__icon-button customforge-workbench__icon-button--danger" data-action="delete-selection" data-feature="deleteSelection" data-control-label="deleteSelection" type="button" disabled>
            <i data-customforge-icon="trash-2" data-icon-slot="deleteSelection"></i>
            <span class="customforge-workbench__icon-label" data-label="deleteSelection"></span>
          </button>
        </div>

        <div class="customforge-workbench__editor-body">
          <div class="customforge-workbench__editor-stage" data-role="editor-host"></div>
          <aside class="customforge-workbench__layers" data-layout="layers" data-region-label="layers">
            <header class="customforge-workbench__layers-header">
              <span>
                <i data-customforge-icon="layers-3" data-icon-slot="layers"></i>
                <span data-label="layers"></span>
              </span>
              <span data-role="layer-count">0</span>
            </header>
            <ol class="customforge-workbench__layer-list" data-role="layer-list"></ol>
          </aside>
        </div>
      </section>

      <section class="customforge-workbench__panel customforge-workbench__panel--viewer" data-region-label="viewerTitle">
        <header class="customforge-workbench__panelbar" data-layout="viewerHeader">
          <div class="customforge-workbench__panel-title">
            <span class="customforge-workbench__panel-kicker">3D</span>
            <h2 data-label="viewerTitle"></h2>
          </div>
          <button class="customforge-workbench__icon-button" data-action="reset-view" data-feature="resetView" data-control-label="resetView" type="button">
            <i data-customforge-icon="rotate-ccw" data-icon-slot="resetView"></i>
            <span class="customforge-workbench__icon-label" data-label="resetView"></span>
          </button>
        </header>
        <div class="customforge-workbench__viewer-stage" data-role="viewer-host"></div>
      </section>
    </section>

    <footer class="customforge-workbench__statusbar" data-layout="status">
      <span class="customforge-workbench__status-indicator" aria-hidden="true"></span>
      <span data-role="status-label" role="status" data-label="starting"></span>
      <span class="customforge-workbench__object-count" data-role="object-count"></span>
    </footer>

    <input data-role="image-input" type="file" accept="image/png,image/jpeg,image/webp" hidden>
    <input data-role="design-input" type="file" accept="application/json,.json" hidden>

    <dialog class="customforge-workbench__dialog customforge-workbench__dialog--text" data-role="text-dialog">
      <form data-role="text-form">
        <header class="customforge-workbench__dialog-header">
          <div>
            <span class="customforge-workbench__eyebrow" data-label="textDialogEyebrow"></span>
            <h2 data-label="textDialogTitle"></h2>
          </div>
          <button class="customforge-workbench__icon-button" data-action="close-text-dialog" data-control-label="close" type="button">
            <i data-customforge-icon="x" data-icon-slot="close"></i>
            <span class="customforge-workbench__icon-label" data-label="close"></span>
          </button>
        </header>
        <div class="customforge-workbench__dialog-body">
          <label class="customforge-workbench__field customforge-workbench__field--prominent">
            <span data-label="textInputLabel"></span>
            <input data-role="text-value" type="text" maxlength="160" data-placeholder-label="textInputPlaceholder" required>
          </label>
          <fieldset class="customforge-workbench__fieldset">
            <legend data-label="textPresets"></legend>
            <div class="customforge-workbench__preset-grid customforge-workbench__preset-grid--text" data-role="text-presets"></div>
          </fieldset>
          <label class="customforge-workbench__field customforge-workbench__color-field">
            <span data-label="textColor"></span>
            <input data-role="text-color" type="color" value="#17191c">
          </label>
        </div>
        <footer class="customforge-workbench__dialog-actions">
          <button class="customforge-workbench__button customforge-workbench__button--secondary" data-action="close-text-dialog" data-label="cancel" type="button"></button>
          <button class="customforge-workbench__button customforge-workbench__button--primary" data-action="submit-text" data-label="addTextConfirm" type="submit"></button>
        </footer>
      </form>
    </dialog>

    <dialog class="customforge-workbench__dialog customforge-workbench__dialog--image" data-role="image-dialog">
      <form data-role="image-form">
        <header class="customforge-workbench__dialog-header">
          <div>
            <span class="customforge-workbench__eyebrow" data-label="imageDialogEyebrow"></span>
            <h2 data-label="imageDialogTitle"></h2>
          </div>
          <button class="customforge-workbench__icon-button" data-action="close-image-dialog" data-control-label="close" type="button">
            <i data-customforge-icon="x" data-icon-slot="close"></i>
            <span class="customforge-workbench__icon-label" data-label="close"></span>
          </button>
        </header>
        <div class="customforge-workbench__dialog-body">
          <div class="customforge-workbench__tabs" role="tablist">
            <button data-image-tab="upload" data-label="uploadImageTab" type="button" role="tab"></button>
            <button data-image-tab="backgrounds" data-feature="presetBackgrounds" data-label="backgroundsTab" type="button" role="tab"></button>
            <button data-image-tab="elements" data-feature="presetElements" data-label="elementsTab" type="button" role="tab"></button>
          </div>
          <section class="customforge-workbench__tab-panel" data-image-panel="upload" role="tabpanel">
            <button class="customforge-workbench__upload-field" data-action="choose-image" type="button">
              <span class="customforge-workbench__upload-icon"><i data-customforge-icon="upload" data-icon-slot="upload"></i></span>
              <strong data-label="chooseImage"></strong>
              <span data-role="image-file-name" data-label="noImageSelected"></span>
              <img data-role="image-preview" alt="" hidden>
            </button>
          </section>
          <section class="customforge-workbench__tab-panel" data-image-panel="backgrounds" role="tabpanel" hidden>
            <div class="customforge-workbench__preset-grid customforge-workbench__preset-grid--assets" data-role="background-presets"></div>
          </section>
          <section class="customforge-workbench__tab-panel" data-image-panel="elements" role="tabpanel" hidden>
            <div class="customforge-workbench__preset-grid customforge-workbench__preset-grid--assets" data-role="element-presets"></div>
          </section>
        </div>
        <footer class="customforge-workbench__dialog-actions">
          <button class="customforge-workbench__button customforge-workbench__button--secondary" data-action="close-image-dialog" data-label="cancel" type="button"></button>
          <button class="customforge-workbench__button customforge-workbench__button--primary" data-action="submit-image" data-label="addImageConfirm" type="submit" disabled></button>
        </footer>
      </form>
    </dialog>

    <dialog class="customforge-workbench__dialog" data-role="product-dialog">
      <form data-role="remote-form">
        <header class="customforge-workbench__dialog-header">
          <div>
            <span class="customforge-workbench__eyebrow" data-label="productDialogEyebrow"></span>
            <h2 data-label="productDialogTitle"></h2>
          </div>
          <button class="customforge-workbench__icon-button" data-action="close-product-dialog" data-control-label="close" type="button">
            <i data-customforge-icon="x" data-icon-slot="close"></i>
            <span class="customforge-workbench__icon-label" data-label="close"></span>
          </button>
        </header>
        <div class="customforge-workbench__dialog-body customforge-workbench__form-fields">
          <label class="customforge-workbench__field">
            <span data-label="modelUrl"></span>
            <div class="customforge-workbench__input-shell">
              <i data-customforge-icon="link-2" data-icon-slot="loadProduct"></i>
              <input data-role="model-url" name="modelUrl" type="url" placeholder="https://example.com/product.glb" required>
            </div>
          </label>
          <label class="customforge-workbench__field">
            <span data-label="textureUrl"></span>
            <div class="customforge-workbench__input-shell">
              <i data-customforge-icon="image-plus" data-icon-slot="addImage"></i>
              <input data-role="texture-url" name="textureUrl" type="url" placeholder="https://example.com/texture.png">
            </div>
          </label>
          <label class="customforge-workbench__field">
            <span data-label="surfaceMesh"></span>
            <input data-role="mesh-name" name="meshName" type="text" value="PrintArea" required>
          </label>
          <label class="customforge-workbench__check-field">
            <input data-role="flip-texture" name="flipTexture" type="checkbox">
            <span data-label="flipTexture"></span>
          </label>
        </div>
        <footer class="customforge-workbench__dialog-actions">
          <button class="customforge-workbench__button customforge-workbench__button--secondary" data-action="use-demo" data-label="useDemo" type="button"></button>
          <button class="customforge-workbench__button customforge-workbench__button--primary" data-action="submit-product" data-control-label="loadProduct" type="submit">
            <i data-customforge-icon="upload" data-icon-slot="upload"></i>
            <span data-label="loadProduct"></span>
          </button>
        </footer>
      </form>
    </dialog>
  `
  return root
}
