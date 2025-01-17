sap.ui.define(["exports", "sap/ui/webc/common/thirdparty/base/asset-registries/Themes", "sap/ui/webc/common/thirdparty/theming/generated/themes/sap_fiori_3/parameters-bundle.css", "./sap_fiori_3/parameters-bundle.css"], function (_exports, _Themes, _parametersBundle, _parametersBundle2) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  _parametersBundle = _interopRequireDefault(_parametersBundle);
  _parametersBundle2 = _interopRequireDefault(_parametersBundle2);
  function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
  (0, _Themes.registerThemePropertiesLoader)("@ui5/webcomponents-theming", "sap_fiori_3", () => _parametersBundle.default);
  (0, _Themes.registerThemePropertiesLoader)("@ui5/webcomponents-fiori", "sap_fiori_3", () => _parametersBundle2.default);
  var _default = {
    packageName: "@ui5/webcomponents-fiori",
    fileName: "themes/UploadCollection.css",
    content: ":host(:not([hidden])){display:block}.ui5-uc-content{position:relative}.uc-no-files{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1rem;background-color:var(--sapGroup_ContentBackground)}.uc-no-files .icon-container{display:flex;align-items:center;justify-content:center;width:100%;height:8rem}.uc-no-files .icon-container [ui5-icon]{width:6rem;height:6rem;color:var(--sapContent_NonInteractiveIconColor);opacity:.5}.uc-no-files .title{font-size:var(--sapFontHeader2Size);color:var(--sapGroup_TitleTextColor);margin:1rem 0}.uc-no-files .subtitle{font-size:var(--sapFontHeader5Size);color:var(--sapContent_LabelColor);margin-bottom:2rem}.uc-dnd-overlay{position:absolute;top:.5rem;right:.5rem;left:.5rem;bottom:.5rem;display:flex;flex-direction:column;align-items:center;justify-content:center}.uc-drag-overlay{border:var(--ui5_upload_collection_drag_overlay_border)}.uc-drop-overlay{border:var(--ui5_upload_collection_drop_overlay_border)}.uc-dnd-overlay:before{content:\"\";position:absolute;top:0;bottom:0;left:0;right:0;background-color:var(--sapGroup_ContentBackground);opacity:.8}.uc-drop-overlay:after{content:\"\";position:absolute;top:0;bottom:0;left:0;right:0;background-color:var(--ui5_upload_collection_drop_overlay_background);opacity:.05}.uc-dnd-overlay [ui5-icon]{width:4rem;height:4rem;margin-bottom:1rem;color:var(--sapContent_NonInteractiveIconColor)}.uc-dnd-overlay .dnd-overlay-text{font-family:\"72override\",var(--sapFontFamily);font-size:var(--sapFontHeader4Size);color:var(--sapContent_NonInteractiveIconColor)}.uc-dnd-overlay .dnd-overlay-text,.uc-dnd-overlay [ui5-icon]{z-index:1;pointer-events:none}.uc-drop-overlay .dnd-overlay-text,.uc-drop-overlay [ui5-icon]{color:var(--sapContent_DragAndDropActiveColor)}.uc-no-files-dnd-overlay{visibility:hidden}"
  };
  _exports.default = _default;
});