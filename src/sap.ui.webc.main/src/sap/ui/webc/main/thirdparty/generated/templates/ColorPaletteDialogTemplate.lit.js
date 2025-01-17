sap.ui.define(["exports", "sap/ui/webc/common/thirdparty/base/renderer/LitRenderer"], function (_exports, _LitRenderer) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  /* eslint no-unused-vars: 0 */

  const block0 = (context, tags, suffix) => suffix ? (0, _LitRenderer.html)`<${(0, _LitRenderer.scopeTag)("ui5-dialog", tags, suffix)} header-text="${(0, _LitRenderer.ifDefined)(context.moreColorsFeature.colorPaletteDialogTitle)}"><div class="ui5-cp-dialog-content"><${(0, _LitRenderer.scopeTag)("ui5-color-picker", tags, suffix)}></${(0, _LitRenderer.scopeTag)("ui5-color-picker", tags, suffix)}></div><div slot="footer" class="ui5-cp-dialog-footer"><${(0, _LitRenderer.scopeTag)("ui5-button", tags, suffix)} design="Emphasized" @click="${context._chooseCustomColor}">${(0, _LitRenderer.ifDefined)(context.moreColorsFeature.colorPaletteDialogOKButton)}</${(0, _LitRenderer.scopeTag)("ui5-button", tags, suffix)}><${(0, _LitRenderer.scopeTag)("ui5-button", tags, suffix)} design="Transparent" @click="${context._closeDialog}">${(0, _LitRenderer.ifDefined)(context.moreColorsFeature.colorPaletteCancelButton)}</${(0, _LitRenderer.scopeTag)("ui5-button", tags, suffix)}></div></${(0, _LitRenderer.scopeTag)("ui5-dialog", tags, suffix)}>` : (0, _LitRenderer.html)`<ui5-dialog header-text="${(0, _LitRenderer.ifDefined)(context.moreColorsFeature.colorPaletteDialogTitle)}"><div class="ui5-cp-dialog-content"><ui5-color-picker></ui5-color-picker></div><div slot="footer" class="ui5-cp-dialog-footer"><ui5-button design="Emphasized" @click="${context._chooseCustomColor}">${(0, _LitRenderer.ifDefined)(context.moreColorsFeature.colorPaletteDialogOKButton)}</ui5-button><ui5-button design="Transparent" @click="${context._closeDialog}">${(0, _LitRenderer.ifDefined)(context.moreColorsFeature.colorPaletteCancelButton)}</ui5-button></div></ui5-dialog>`;
  var _default = block0;
  _exports.default = _default;
});