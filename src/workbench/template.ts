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
        <div class="customforge-workbench__extension-slot" data-extension-slot="globalActions"></div>
        <button class="customforge-workbench__button customforge-workbench__button--secondary" data-action="load-remote" data-feature="loadRemoteProduct" data-control-label="loadProduct" type="button">
          <i data-customforge-icon="upload" data-icon-slot="loadProduct"></i>
          <span data-label="loadProduct"></span>
        </button>
      </div>
    </header>

    <section class="customforge-workbench__workspace">
      <section class="customforge-workbench__panel customforge-workbench__panel--editor" data-region-label="editorTitle">
        <header class="customforge-workbench__panelbar" data-layout="editorHeader">
          <div class="customforge-workbench__panel-title">
            <span class="customforge-workbench__panel-kicker" data-label="editorMode"></span>
            <h1 data-label="editorTitle"></h1>
          </div>
          <span class="customforge-workbench__resolution" data-role="resolution"></span>
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
          <div class="customforge-workbench__extension-slot" data-extension-slot="editorToolbar"></div>
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
          <div class="customforge-workbench__extension-slot" data-extension-slot="selectionToolbar"></div>

          <span class="customforge-workbench__separator" data-tool-group="layers-separator" aria-hidden="true"></span>
          <button class="customforge-workbench__tool-button customforge-workbench__layers-toggle" data-action="toggle-layers" data-control-label="layers" data-role="layers-toggle" type="button" aria-expanded="false">
            <i data-customforge-icon="layers-3" data-icon-slot="layers"></i>
            <span data-label="layers"></span>
            <span class="customforge-workbench__layer-count" data-role="layer-count" aria-hidden="true">0</span>
          </button>

          <div class="customforge-workbench__text-toolbar" data-role="text-toolbar" data-region-label="textFormatting" role="group" hidden>
            <span class="customforge-workbench__format-separator" aria-hidden="true"></span>
            <select class="customforge-workbench__font-select" data-role="text-font-family" data-control-label="fontFamily"></select>
            <label class="customforge-workbench__format-number" data-control-label="fontSize">
              <span class="customforge-workbench__icon-label" data-label="fontSize"></span>
              <input data-role="text-font-size" data-control-label="fontSize" type="number" min="8" max="360" step="1" inputmode="numeric">
            </label>
            <span class="customforge-workbench__format-separator" aria-hidden="true"></span>
            <div class="customforge-workbench__format-group" role="group">
              <button class="customforge-workbench__format-button" data-text-style="bold" data-control-label="bold" type="button" aria-pressed="false">
                <i data-customforge-icon="bold" data-icon-slot="bold"></i>
                <span class="customforge-workbench__icon-label" data-label="bold"></span>
              </button>
              <button class="customforge-workbench__format-button" data-text-style="italic" data-control-label="italic" type="button" aria-pressed="false">
                <i data-customforge-icon="italic" data-icon-slot="italic"></i>
                <span class="customforge-workbench__icon-label" data-label="italic"></span>
              </button>
              <button class="customforge-workbench__format-button" data-text-style="underline" data-control-label="underline" type="button" aria-pressed="false">
                <i data-customforge-icon="underline" data-icon-slot="underline"></i>
                <span class="customforge-workbench__icon-label" data-label="underline"></span>
              </button>
            </div>
            <details class="customforge-workbench__text-options" data-role="text-options">
              <summary class="customforge-workbench__format-button" data-control-label="moreTextOptions">
                <i data-customforge-icon="ellipsis" data-icon-slot="moreTextOptions"></i>
                <span class="customforge-workbench__icon-label" data-label="moreTextOptions"></span>
              </summary>
              <div class="customforge-workbench__text-options-panel">
                <div class="customforge-workbench__text-options-row">
                  <button class="customforge-workbench__format-button" data-action="edit-text" data-control-label="editText" type="button">
                    <i data-customforge-icon="text-cursor-input" data-icon-slot="editText"></i>
                    <span class="customforge-workbench__icon-label" data-label="editText"></span>
                  </button>
                  <span class="customforge-workbench__format-separator" aria-hidden="true"></span>
                  <div class="customforge-workbench__format-group" role="group">
                    <button class="customforge-workbench__format-button" data-text-align="left" data-control-label="alignLeft" type="button" aria-pressed="false">
                      <i data-customforge-icon="align-left" data-icon-slot="alignLeft"></i>
                      <span class="customforge-workbench__icon-label" data-label="alignLeft"></span>
                    </button>
                    <button class="customforge-workbench__format-button" data-text-align="center" data-control-label="alignCenter" type="button" aria-pressed="false">
                      <i data-customforge-icon="align-center" data-icon-slot="alignCenter"></i>
                      <span class="customforge-workbench__icon-label" data-label="alignCenter"></span>
                    </button>
                    <button class="customforge-workbench__format-button" data-text-align="right" data-control-label="alignRight" type="button" aria-pressed="false">
                      <i data-customforge-icon="align-right" data-icon-slot="alignRight"></i>
                      <span class="customforge-workbench__icon-label" data-label="alignRight"></span>
                    </button>
                  </div>
                  <span class="customforge-workbench__format-separator" aria-hidden="true"></span>
                  <label class="customforge-workbench__format-color" data-control-label="textColor">
                    <i data-customforge-icon="palette" data-icon-slot="textColor"></i>
                    <input data-role="text-format-color" data-control-label="textColor" type="color" value="#172126">
                  </label>
                  <div class="customforge-workbench__format-group" role="group">
                    <button class="customforge-workbench__format-button" data-action="toggle-text-background" data-control-label="textBackground" type="button" aria-pressed="false">
                      <i data-customforge-icon="highlighter" data-icon-slot="textBackground"></i>
                      <span class="customforge-workbench__icon-label" data-label="textBackground"></span>
                    </button>
                    <input class="customforge-workbench__background-color" data-role="text-background-color" data-control-label="textBackground" type="color" value="#fff2a8">
                  </div>
                </div>
                <div class="customforge-workbench__text-color-palette" data-role="text-color-palette" data-region-label="textColor" role="group"></div>
                <div class="customforge-workbench__text-options-row customforge-workbench__text-options-row--metrics">
                  <label class="customforge-workbench__format-metric" data-control-label="lineHeight">
                    <i data-customforge-icon="rows-3" data-icon-slot="lineHeight"></i>
                    <input data-role="text-line-height" data-control-label="lineHeight" type="number" min="0.5" max="5" step="0.1" inputmode="decimal">
                  </label>
                  <label class="customforge-workbench__format-metric" data-control-label="letterSpacing">
                    <i data-customforge-icon="stretch-horizontal" data-icon-slot="letterSpacing"></i>
                    <input data-role="text-letter-spacing" data-control-label="letterSpacing" type="number" min="-500" max="2000" step="10" inputmode="numeric">
                  </label>
                </div>
              </div>
            </details>
          </div>

          <div class="customforge-workbench__image-toolbar" data-role="image-toolbar" data-region-label="setImageAsBackground" role="group" hidden>
            <span class="customforge-workbench__format-separator" aria-hidden="true"></span>
            <button class="customforge-workbench__tool-button" data-action="set-image-as-background" data-control-label="setImageAsBackground" type="button">
              <i data-customforge-icon="stretch-horizontal" data-icon-slot="setImageAsBackground"></i>
              <span data-label="setImageAsBackground"></span>
            </button>
          </div>
        </div>

        <div class="customforge-workbench__editor-body">
          <div class="customforge-workbench__editor-stage" data-role="editor-host"></div>
          <aside class="customforge-workbench__layers" data-layout="layers" data-region-label="layers">
            <header class="customforge-workbench__layers-header">
              <span>
                <i data-customforge-icon="layers-3" data-icon-slot="layers"></i>
                <span data-label="layers"></span>
              </span>
            </header>
            <ol class="customforge-workbench__layer-list" data-role="layer-list"></ol>
          </aside>
        </div>
      </section>

      <section class="customforge-workbench__panel customforge-workbench__panel--viewer" data-region-label="viewerTitle">
        <header class="customforge-workbench__panelbar" data-layout="viewerHeader">
          <div class="customforge-workbench__panel-title">
            <span class="customforge-workbench__panel-kicker" data-label="viewerMode"></span>
            <h2 data-label="viewerTitle"></h2>
          </div>
          <button class="customforge-workbench__icon-button" data-action="reset-view" data-feature="resetView" data-control-label="resetView" type="button">
            <i data-customforge-icon="rotate-ccw" data-icon-slot="resetView"></i>
            <span class="customforge-workbench__icon-label" data-label="resetView"></span>
          </button>
        </header>
        <div class="customforge-workbench__viewer-stage">
          <div class="customforge-workbench__viewer-host" data-role="viewer-host"></div>
          <div class="customforge-workbench__status" data-layout="status">
            <span class="customforge-workbench__status-indicator" aria-hidden="true"></span>
            <span data-role="status-label" role="status" data-label="starting"></span>
          </div>
        </div>
      </section>
    </section>

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
        <div class="customforge-workbench__dialog-body customforge-workbench__product-form">
          <div class="customforge-workbench__product-source-switch" data-region-label="productSourceMethod" role="group">
            <button data-product-source="file" data-label="productFileSource" type="button" aria-pressed="true"></button>
            <button data-product-source="url" data-label="productUrlSource" type="button" aria-pressed="false"></button>
          </div>

          <section data-product-source-panel="file">
            <label class="customforge-workbench__field">
              <span data-label="modelFile"></span>
              <span class="customforge-workbench__product-file-picker">
                <input data-role="model-file" name="modelFile" type="file" accept=".glb,model/gltf-binary" required>
                <span class="customforge-workbench__product-file-command" data-label="chooseModelFile"></span>
                <small data-role="model-file-name" data-label="noModelFileSelected"></small>
              </span>
            </label>
          </section>

          <section data-product-source-panel="url" hidden>
            <label class="customforge-workbench__field">
              <span data-label="modelUrl"></span>
              <div class="customforge-workbench__input-shell">
                <i data-customforge-icon="link-2" data-icon-slot="loadProduct"></i>
                <input data-role="model-url" name="modelUrl" type="url" data-placeholder-label="modelUrlPlaceholder" disabled>
              </div>
            </label>
          </section>

          <details class="customforge-workbench__product-options">
            <summary>
              <span data-label="advancedProductOptions"></span>
              <i data-customforge-icon="chevron-down"></i>
            </summary>
            <div class="customforge-workbench__product-options-fields">
              <label class="customforge-workbench__field">
                <span data-label="textureUrl"></span>
                <div class="customforge-workbench__input-shell">
                  <i data-customforge-icon="image-plus" data-icon-slot="addImage"></i>
                  <input data-role="texture-url" name="textureUrl" type="url" data-placeholder-label="textureUrlPlaceholder">
                </div>
                <small data-label="textureUrlHint"></small>
              </label>
              <label class="customforge-workbench__field">
                <span data-label="surfaceMesh"></span>
                <input data-role="mesh-name" name="meshName" type="text" value="PrintArea" required>
                <small data-label="surfaceMeshHint"></small>
              </label>
              <label class="customforge-workbench__check-field">
                <input data-role="flip-texture" name="flipTexture" type="checkbox">
                <span>
                  <strong data-label="flipTexture"></strong>
                  <small data-label="flipTextureHint"></small>
                </span>
              </label>
            </div>
          </details>
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
