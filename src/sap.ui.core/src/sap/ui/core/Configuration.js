/*!
 * ${copyright}
 */

//Provides class sap.ui.core.Configuration
sap.ui.define([
	'../Device',
	'../base/Object',
	'./Locale',
	"./format/TimezoneUtil",
	"sap/ui/core/_ConfigurationProvider",
	"sap/ui/core/date/CalendarWeekNumbering",
	"sap/ui/core/Theming",
	"sap/base/util/Version",
	"sap/base/Log",
	"sap/base/assert",
	"sap/base/config",
	"sap/base/Event",
	"sap/base/strings/camelize",
	"sap/base/util/deepClone",
	"sap/base/i18n/Localization",
	"sap/base/i18n/Formatting"
],
	function(
		Device,
		BaseObject,
		Locale,
		TimezoneUtil,
		_ConfigurationProvider,
		CalendarWeekNumbering,
		Theming,
		Version,
		Log,
		assert,
		BaseConfig,
		BaseEvent,
		camelize,
		deepClone,
		Localization,
		Formatting
	) {
	"use strict";

	// Singleton instance for configuration
	var oConfiguration;
	var M_SETTINGS;
	var VERSION = "${version}";
	var mCompatVersion;

	// Helper Functions
	var Object_hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);

	function _calcCompatVersions() {
		var PARAM_CVERS = "sapUiCompatversion";

		function _getCVers(key){
			var v = !key ? DEFAULT_CVERS || BASE_CVERS.toString()
					: BaseConfig.get({
						name: camelize(PARAM_CVERS + "-" + key.toLowerCase()),
						type: BaseConfig.Type.String
					}) || DEFAULT_CVERS || M_COMPAT_FEATURES[key] || BASE_CVERS.toString();
			v = Version(v.toLowerCase() === "edge" ? VERSION : v);
			//Only major and minor version are relevant
			return Version(v.getMajor(), v.getMinor());
		}

		var DEFAULT_CVERS = BaseConfig.get({
			name: PARAM_CVERS,
			type: BaseConfig.Type.String
		});
		var BASE_CVERS = Version("1.14");
		mCompatVersion = {};

		mCompatVersion._default = _getCVers();
		for (var n in M_COMPAT_FEATURES) {
			mCompatVersion[n] = _getCVers(n);
		}

		return mCompatVersion;
	}

	function detectLanguage() {

		function navigatorLanguage() {
			if ( Device.os.android ) {
				// on Android, navigator.language is hardcoded to 'en', so check UserAgent string instead
				var match = navigator.userAgent.match(/\s([a-z]{2}-[a-z]{2})[;)]/i);
				if ( match ) {
					return match[1];
				}
				// okay, we couldn't find a language setting. It might be better to fallback to 'en' instead of having no language
			}
			return navigator.language;
		}

		return convertToLocaleOrNull( (navigator.languages && navigator.languages[0]) || navigatorLanguage() || navigator.userLanguage || navigator.browserLanguage ) || new Locale("en");
	}

	function setValue(sName, vValue, config) {
		if ( vValue == null ) {
			return;
		}
		config[sName] = convertToType(sName, vValue);
	}

	function convertToType(sName, vValue) {
		if ( vValue == null ) {
			return;
		}
		switch (M_SETTINGS[sName].type) {
		case "boolean":
			if ( typeof vValue === "string" ) {
				if (M_SETTINGS[sName].defaultValue) {
					return vValue.toLowerCase() != "false";
				} else {
					return vValue.toLowerCase() === "true" || vValue.toLowerCase() === "x";
				}
			} else {
				// boolean etc.
				return !!vValue;
			}
		case "string":
			return "" + vValue; // enforce string
		case "code":
			return typeof vValue === "function" ? vValue : String(vValue);
		case "function":
			if ( typeof vValue !== "function" ) {
				throw new Error("unsupported value");
			}
			return vValue;
		case "function[]":
			vValue.forEach(function(fnFunction) {
				if ( typeof fnFunction !== "function" ) {
					throw new Error("Not a function: " + fnFunction);
				}
			});
			return vValue.slice();
		case "string[]":
			if ( Array.isArray(vValue) ) {
				return vValue;
			} else if ( typeof vValue === "string" ) {
				return vValue.split(/[ ,;]/).map(function(s) {
					return s.trim();
				});
			} else {
				throw new Error("unsupported value");
			}
		case "object":
			if ( typeof vValue !== "object" ) {
				throw new Error("unsupported value");
			}
			return vValue;
		case "Locale":
			var oLocale = convertToLocaleOrNull(vValue);
			if ( oLocale || M_SETTINGS[sName].defaultValue == null ) {
				return oLocale;
			} else {
				throw new Error("unsupported value");
			}
		default:
			// When the type is none of the above types, check if an object as enum is provided to validate the value.
			var vType = M_SETTINGS[sName].type;
			if (typeof vType === "object") {
				BaseConfig._.checkEnum(vType, vValue, sName);
				return vValue;
			} else {
				throw new Error("illegal state");
			}
		}
	}

	function getMetaTagValue(sName) {
		var oMetaTag = document.querySelector("META[name='" + sName + "']"),
			sMetaContent = oMetaTag && oMetaTag.getAttribute("content");
		if (sMetaContent) {
			return sMetaContent;
		}
	}

	var M_ANIMATION_MODE = {
		/**
		 * <code>full</code> represents a mode with unrestricted animation capabilities.
		 * @public
		 */
		full : "full",

		/**
		 * <code>basic</code> can be used for a reduced, more light-weight set of animations.
		 * @public
		 */
		basic : "basic",

		/**
		 * <code>minimal</code> includes animations of fundamental functionality.
		 * @public
		 */
		minimal : "minimal",

		/**
		 * <code>none</code> deactivates the animation completely.
		 * @public
		 */
		none : "none"
	};

	// Definition of supported settings
	// Valid property types are: string, boolean, string[], code, object, function, function[].
	// Objects as an enumeration list of valid values can also be provided (e.g. Configuration.AnimationMode).
	var M_SETTINGS = {
		"theme"                 : { type : "string",   defaultValue : "base" },
		"language"              : { type : "Locale",   defaultValue : detectLanguage() },
		"timezone"              : { type : "string",   defaultValue : TimezoneUtil.getLocalTimezone() },
		"formatLocale"          : { type : "Locale",   defaultValue : null },
		"calendarType"          : { type : "string",   defaultValue : null },
		"calendarWeekNumbering" : { type : CalendarWeekNumbering, defaultValue : CalendarWeekNumbering.Default},
		"trailingCurrencyCode"  : { type : "boolean",  defaultValue : true },
		"accessibility"         : { type : "boolean",  defaultValue : true },
		"autoAriaBodyRole"      : { type : "boolean",  defaultValue : false,     noUrl:true }, //whether the framework automatically adds the ARIA role 'application' to the html body
		"animation"             : { type : "boolean",  defaultValue : true }, // deprecated, please use animationMode
		"animationMode"         : { type : M_ANIMATION_MODE, defaultValue : undefined }, // If no value is provided, animationMode will be set on instantiation depending on the animation setting.
		"rtl"                   : { type : "boolean",  defaultValue : null },
		"debug"                 : { type : "boolean",  defaultValue : false },
		"inspect"               : { type : "boolean",  defaultValue : false },
		"originInfo"            : { type : "boolean",  defaultValue : false },
		"noConflict"            : { type : "boolean",  defaultValue : false,     noUrl:true },
		"noDuplicateIds"        : { type : "boolean",  defaultValue : true },
		"trace"                 : { type : "boolean",  defaultValue : false,     noUrl:true },
		"modules"               : { type : "string[]", defaultValue : [],        noUrl:true },
		"areas"                 : { type : "string[]", defaultValue : null,      noUrl:true },
		"onInit"                : { type : "code",     defaultValue : undefined, noUrl:true }, // could be either a reference to a JavaScript function, the name of a global function (string value) or the name of a module (indicated with prefix "module:")
		"uidPrefix"             : { type : "string",   defaultValue : "__",      noUrl:true },
		"ignoreUrlParams"       : { type : "boolean",  defaultValue : false,     noUrl:true },
		"preload"               : { type : "string",   defaultValue : "auto" },
		"rootComponent"         : { type : "string",   defaultValue : "",        noUrl:true },
		"preloadLibCss"         : { type : "string[]", defaultValue : [] },
		"application"           : { type : "string",   defaultValue : "" },
		"appCacheBuster"        : { type : "string[]", defaultValue : [] },
		"bindingSyntax"         : { type : "string",   defaultValue : "default", noUrl:true }, // default|simple|complex
		"versionedLibCss"       : { type : "boolean",  defaultValue : false },
		"manifestFirst"         : { type : "boolean",  defaultValue : false },
		"flexibilityServices"   : { type : "string",   defaultValue : "/sap/bc/lrep"},
		"whitelistService"      : { type : "string",   defaultValue : null,      noUrl:true }, // deprecated, use allowlistService instead
		"allowlistService"      : { type : "string",   defaultValue : null,      noUrl:true }, // url/to/service
		"frameOptions"          : { type : "string",   defaultValue : "default", noUrl:true }, // default/allow/deny/trusted (default => allow)
		"frameOptionsConfig"    : { type : "object",   defaultValue : undefined, noUrl:true },  // advanced frame options configuration
		"support"               : { type : "string[]", defaultValue : null },
		"testRecorder"          : { type : "string[]", defaultValue : null },
		"activeTerminologies"   : { type : "string[]", defaultValue : undefined},
		"fileShareSupport"      : { type : "string",   defaultValue : undefined, noUrl:true }, // Module name (AMD syntax)
		"securityTokenHandlers"	: { type : "function[]", defaultValue: [],       noUrl:true },
		"productive"			: { type : "boolean",  defaultValue: false,      noUrl:true },
		"themeRoots"			: { type : "object",   defaultValue: {},  noUrl:true },
		"xx-placeholder"		: { type : "boolean",  defaultValue : true },
		"xx-rootComponentNode"  : { type : "string",   defaultValue : "",        noUrl:true },
		"xx-appCacheBusterMode" : { type : "string",   defaultValue : "sync" },
		"xx-appCacheBusterHooks": { type : "object",   defaultValue : undefined, noUrl:true }, // e.g.: { handleURL: fn, onIndexLoad: fn, onIndexLoaded: fn }
		"xx-disableCustomizing" : { type : "boolean",  defaultValue : false,     noUrl:true },
		"xx-viewCache"          : { type : "boolean",  defaultValue : true },
		"xx-depCache"           : { type : "boolean",  defaultValue : false },
		"xx-libraryPreloadFiles": { type : "string[]", defaultValue : [] },
		"xx-componentPreload"   : { type : "string",   defaultValue : "" },
		"xx-designMode"         : { type : "boolean",  defaultValue : false },
		"xx-supportedLanguages" : { type : "string[]", defaultValue : [] }, // *=any, sapui5 or list of locales
		"xx-bootTask"           : { type : "function", defaultValue : undefined, noUrl:true },
		"xx-suppressDeactivationOfControllerCode" : { type : "boolean",  defaultValue : false }, //temporarily to suppress the deactivation of controller code in design mode
		"xx-lesssupport"        : { type : "boolean",  defaultValue : false },
		"xx-handleValidation"   : { type : "boolean",  defaultValue : false },
		"xx-fiori2Adaptation"   : { type : "string[]",  defaultValue : [] },
		"xx-cache-use"          : { type : "boolean",  defaultValue : true},
		"xx-cache-excludedKeys" : { type : "string[]", defaultValue : []},
		"xx-cache-serialization": { type : "boolean",  defaultValue : false},
		"xx-nosync"             : { type : "string",   defaultValue : "" },
		"xx-waitForTheme"       : { type : "string",  defaultValue : ""}, // rendering|init
		"xx-hyphenation" : { type : "string",  defaultValue : ""}, // (empty string)|native|thirdparty|disable
		"xx-flexBundleRequestForced" : { type : "boolean",  defaultValue : false },
		"xx-skipAutomaticFlLibLoading" : { type : "boolean",  defaultValue: false },
		"xx-cssVariables"       : { type : "string",   defaultValue : "false" }, // false|true|additional (additional just includes the css_variables.css in addition)
		"xx-debugModuleLoading"	: { type : "boolean",  defaultValue: false },
		"statistics"            : { type : "boolean",  defaultValue : false },
		"xx-acc-keys"           : { type : "boolean",  defaultValue : false },
		"xx-measure-cards"      : { type : "boolean",  defaultValue : false }
	};

	var M_COMPAT_FEATURES = {
			"xx-test"               : "1.15", //for testing purposes only
			"flexBoxPolyfill"       : "1.14",
			"sapMeTabContainer"     : "1.14",
			"sapMeProgessIndicator" : "1.14",
			"sapMGrowingList"       : "1.14",
			"sapMListAsTable"       : "1.14",
			"sapMDialogWithPadding" : "1.14",
			"sapCoreBindingSyntax"  : "1.24"
	};

	/**
	 * Creates a new Configuration object.
	 *
	 * @class Collects and stores the configuration of the current environment.
	 *
	 * The Configuration is initialized once when the {@link sap.ui.core.Core} is created.
	 * There are different ways to set the environment configuration (in ascending priority):
	 * <ol>
	 * <li>System defined defaults</li>
	 * <li>Server wide defaults, read from /sap-ui-config.json</li>
	 * <li>Properties of the global configuration object window["sap-ui-config"]</li>
	 * <li>A configuration string in the data-sap-ui-config attribute of the bootstrap tag.</li>
	 * <li>Individual data-sap-ui-<i>xyz</i> attributes of the bootstrap tag</li>
	 * <li>Using URL parameters</li>
	 * <li>Setters in this Configuration object (only for some parameters)</li>
	 * </ol>
	 *
	 * That is, attributes of the DOM reference override the system defaults, URL parameters
	 * override the DOM attributes (where empty URL parameters set the parameter back to its
	 * system default). Calling setters at runtime will override any previous settings
	 * calculated during object creation.
	 *
	 * The naming convention for parameters is:
	 * <ul>
	 * <li>in the URL : sap-ui-<i>PARAMETER-NAME</i>="value"</li>
	 * <li>in the DOM : data-sap-ui-<i>PARAMETER-NAME</i>="value"</li>
	 * </ul>
	 * where <i>PARAMETER-NAME</i> is the name of the parameter in lower case.
	 *
	 * Values of boolean parameters are case insensitive where "true" and "x" are interpreted as true.
	 *
	 * @hideconstructor
	 * @extends sap.ui.base.Object
	 * @author Frank Weigel (Martin Schaus)
	 * @public
	 * @alias sap.ui.core.Configuration
	 *
	 * @borrows module:sap/base/i18n/Localization.getSAPLogonLanguage as #getSAPLogonLanguage
	 * @borrows module:sap/base/i18n/Localization.getTimezone as #getTimezone
	 * @borrows module:sap/base/i18n/Localization.setLanguage as #setLanguage
	 * @borrows module:sap/base/i18n/Localization.getRTL as #getRTL
	 * @borrows module:sap/base/i18n/Localization.setRTL as #setRTL
	 * @borrows module:sap/base/i18n/Localization.getLanguagesDeliveredWithCore as #getLanguagesDeliveredWithCore
	 * @borrows module:sap/base/i18n/Localization.getSupportedLanguages as #getSupportedLanguages
	 * @borrows module:sap/ui/core/Theming.getTheme as #getTheme
	 * @borrows module:sap/ui/core/Theming.setTheme as #setTheme
	 */
	var Configuration = BaseObject.extend("sap.ui.core.Configuration", /** @lends sap.ui.core.Configuration.prototype */ {

		constructor : function() {
			if (oConfiguration) {
				Log.error(
					"Configuration is designed as a singleton and should not be created manually! " +
					"Please require 'sap/ui/core/Configuration' instead and use the module export directly without using 'new'."
				);

				return oConfiguration;
			}
		},

		init: function() {
			this.bInitialized = true;

			this.oFormatSettings = new FormatSettings(this);

			/* Object that carries the real configuration data */
			var config = this; // eslint-disable-line consistent-this

			// apply settings from global config object (already merged with script tag attributes)
			var oCfg = window["sap-ui-config"] || {};
			oCfg.oninit = oCfg.oninit || oCfg["evt-oninit"];
			for (var n in M_SETTINGS) {
				// collect the defaults
				config[n] = Array.isArray(M_SETTINGS[n].defaultValue) ? [] : M_SETTINGS[n].defaultValue;
				if ( oCfg.hasOwnProperty(n.toLowerCase()) ) {
					setValue(n, oCfg[n.toLowerCase()], this);
				} else if ( !/^xx-/.test(n) && oCfg.hasOwnProperty("xx-" + n.toLowerCase()) ) {
					setValue(n, oCfg["xx-" + n.toLowerCase()], this);
				}
			}

			// if libs are configured, convert them to modules and prepend them to the existing modules list
			if ( oCfg.libs ) {
				config.modules = oCfg.libs.split(",").map(function(lib) {
					return lib.trim() + ".library";
				}).concat(config.modules);
			}

			var oUriParams;

			// apply the settings from the url (only if not blocked by app configuration)
			if ( !config.ignoreUrlParams ) {
				var sUrlPrefix = "sap-ui-";
				oUriParams = new URLSearchParams(window.location.search);

				if (oUriParams.has('sap-statistics')) {
					var sValue = oUriParams.get('sap-statistics');
					setValue('statistics', sValue, this);
				}

				// now analyze sap-ui parameters
				for (var n in M_SETTINGS) {
					if ( M_SETTINGS[n].noUrl ) {
						continue;
					}
					var sValue = oUriParams.get(sUrlPrefix + n);
					if ( sValue == null && !/^xx-/.test(n) ) {
						sValue = oUriParams.get(sUrlPrefix + "xx-" + n);
					}
					if (sValue === "") {
						//empty URL parameters set the parameter back to its system default
						config[n] = M_SETTINGS[n].defaultValue;
					} else {
						//sets the value (null or empty value ignored)
						setValue(n, sValue, this);
					}
				}
			}

			//parse fiori 2 adaptation parameters
			var vAdaptations = config['xx-fiori2Adaptation'];
			if ( vAdaptations.length === 0 || (vAdaptations.length === 1 && vAdaptations[0] === 'false') ) {
				vAdaptations = false;
			} else if ( vAdaptations.length === 1 && vAdaptations[0] === 'true' ) {
				vAdaptations = true;
			}

			config['xx-fiori2Adaptation'] = vAdaptations;

			config["allowlistService"] = config["allowlistService"] || /* fallback to legacy config */ config["whitelistService"];

			// Configure allowlistService / frameOptions via <meta> tag if not already defined via UI5 configuration
			if (!config["allowlistService"]) {
				var sAllowlistMetaTagValue = getMetaTagValue('sap.allowlistService') || /* fallback to legacy config */ getMetaTagValue('sap.whitelistService');
				if (sAllowlistMetaTagValue) {
					config["allowlistService"] = sAllowlistMetaTagValue;
					// Set default "frameOptions" to "trusted" instead of "allow"
					if (config["frameOptions"] === "default") {
						config["frameOptions"] = "trusted";
					}
				}
			}

			// Verify and set default for "frameOptions" configuration
			if (config["frameOptions"] === "default" ||
				(config["frameOptions"] !== "allow"
				&& config["frameOptions"] !== "deny"
				&& config["frameOptions"] !== "trusted")) {

				// default => allow
				config["frameOptions"] = "allow";
			}

			// frameOptionsConfig: Handle compatibility of renamed config option
			var oFrameOptionsConfig = config["frameOptionsConfig"];
			if (oFrameOptionsConfig) {
				oFrameOptionsConfig.allowlist = oFrameOptionsConfig.allowlist || oFrameOptionsConfig.whitelist;
			}

			// in case the flexibilityServices configuration was set to a non-empty, non-default value, sap.ui.fl becomes mandatory
			// if not overruled by xx-skipAutomaticFlLibLoading
			if (config.flexibilityServices
					&& config.flexibilityServices !== M_SETTINGS.flexibilityServices.defaultValue
					&& !config['xx-skipAutomaticFlLibLoading']
					&& config.modules.indexOf("sap.ui.fl.library") == -1) {
				config.modules.push("sap.ui.fl.library");
			}

			// log  all non default value
			for (var n in M_SETTINGS) {
				if ( config[n] !== M_SETTINGS[n].defaultValue ) {
					Log.info("  " + n + " = " + config[n]);
				}
			}

			// Setup animation mode. If no animation mode is provided
			// the value is set depending on the animation setting.
			if (this.getAnimationMode() === undefined) {
				if (this.animation) {
					this.setAnimationMode(Configuration.AnimationMode.full);
				} else {
					this.setAnimationMode(Configuration.AnimationMode.minimal);
				}
			} else {
				// Validate and set the provided value for the animation mode
				this.setAnimationMode(this.getAnimationMode());
			}

			// The following code can't be done in the _ConfigurationProvider
			// because of cyclic dependency
			var syncCallBehavior = this.getSyncCallBehavior();
			sap.ui.loader.config({
				reportSyncCalls: syncCallBehavior
			});

			if ( syncCallBehavior && oCfg.__loaded ) {
				var sMessage = "[nosync]: configuration loaded via sync XHR";
				if (syncCallBehavior === 1) {
					Log.warning(sMessage);
				} else {
					Log.error(sMessage);
				}
			}
		},

		/**
		 * Returns the version of the framework.
		 *
		 * Similar to <code>sap.ui.version</code>.
		 *
		 * @return {module:sap/base/util/Version} the version
		 * @public
		 */
		getVersion : function () {
			if (this._version) {
				return this._version;
			}

			this._version = new Version(VERSION);
			return this._version;
		},

		/**
		 * Returns the used compatibility version for the given feature.
		 *
		 * @param {string} sFeature the key of desired feature
		 * @return {module:sap/base/util/Version} the used compatibility version
		 * @public
		 */
		getCompatibilityVersion : function (sFeature) {
			var mCompatVersion = _calcCompatVersions();
			if (typeof (sFeature) === "string" && mCompatVersion[sFeature]) {
				return mCompatVersion[sFeature];
			}
			return mCompatVersion._default;
		},

		getTheme : Theming.getTheme,

		/**
		 * Returns whether placeholders are active or not
		 * @returns {boolean} Whether placeholders are active or not
		 */
		getPlaceholder : function() {
			return BaseConfig.get({
				name: "sapUiXxPlaceholder",
				type: BaseConfig.Type.Boolean,
				external: true,
				defaultValue: true
			});
		},

		setTheme : function (sTheme) {
			Theming.setTheme(sTheme);
			return this;
		},

		/**
		 * Returns a string that identifies the current language.
		 *
		 * The value returned by config method in most cases corresponds to the exact value that has been
		 * configured by the user or application or that has been determined from the user agent settings.
		 * It has not been normalized, but has been validated against a relaxed version of
		 * {@link http://www.ietf.org/rfc/bcp/bcp47.txt BCP47}, allowing underscores ('_') instead of the
		 * suggested dashes ('-') and not taking the case of letters into account.
		 *
		 * The exceptions mentioned above affect languages that have been specified via the URL parameter
		 * <code>sap-language</code>. That parameter by definition represents an SAP logon language code
		 * ('ABAP language'). Most but not all of these language codes are valid ISO639 two-letter languages
		 * and as such are valid BCP47 language tags. For better BCP47 compliance, the framework
		 * maps the following non-BCP47 SAP logon codes to a BCP47 substitute:
		 * <pre>
		 *    "ZH"  -->  "zh-Hans"         // script 'Hans' added to distinguish it from zh-Hant
		 *    "ZF"  -->  "zh-Hant"         // ZF is not a valid ISO639 code, use the compliant language + script 'Hant'
		 *    "1Q"  -->  "en-US-x-saptrc"  // special language code for supportability (tracing),
		 *                                    represented as en-US with a private extension
		 *    "2Q"  -->  "en-US-x-sappsd"  // special language code for supportability (pseudo translation),
		 *                                    represented as en-US with a private extension
		 *    "3Q"  -->  "en-US-x-saprigi" // special language code for the Rigi pseudo language,
		 *                                    represented as en-US with a private extension
		 * </pre>
		 *
		 * For a normalized BCP47 tag, call {@link #getLanguageTag} or call {@link #getLocale} to get a
		 * {@link sap.ui.core.Locale Locale} object matching the language.
		 *
		 * @return {string} Language string as configured
		 * @function
		 * @public
		 */
		getLanguage :  Localization.getLanguage,

		setLanguage : Localization.setLanguage,

		/**
		 * Returns a BCP47-compliant language tag for the current language.
		 *
		 * The return value of config method is especially useful for an HTTP <code>Accept-Language</code> header.
		 *
		 * Retrieves the modern locale,
		 * e.g. sr-Latn (Serbian (Cyrillic)), he (Hebrew), yi (Yiddish)
		 *
		 * @returns {string} The language tag for the current language, conforming to BCP47
		 * @public
		 */
		getLanguageTag : function () {
			return Localization.getLanguageTag().toString();
		},

		getSAPLogonLanguage : Localization.getSAPLogonLanguage,

		getTimezone : Localization.getTimezone,

		/**
		 * Sets the timezone such that all date and time based calculations use config timezone.
		 *
		 * <b>Important:</b> It is strongly recommended to only use config API at the earliest point
		 * of time while initializing a UI5 app. A later adjustment of the time zone should be
		 * avoided. It can lead to unexpected data inconsistencies in a running application,
		 * because date objects could still be related to a previously configured time zone.
		 * Instead, the app should be completely restarted with the new time zone.
		 * For more information, see
		 * {@link topic:6c9e61dc157a40c19460660ece8368bc Dates, Times, Timestamps, and Time Zones}.
		 *
		 * When the timezone has changed, the Core will fire its
		 * {@link sap.ui.core.Core#event:localizationChanged localizationChanged} event.
		 *
		 * @param {string|null} [sTimezone] IANA timezone ID, e.g. "America/New_York". Use <code>null</code> to reset the timezone to the browser's local timezone.
		 *   An invalid IANA timezone ID will fall back to the browser's timezone.
		 * @function
		 * @public
		 * @return {this} <code>this</code> to allow method chaining
		 * @since 1.99.0
		 */
		setTimezone : Localization.setTimezone,

		/**
		 * Returns the calendar type which is being used in locale dependent functionality.
		 *
		 * When it's explicitly set by calling <code>setCalendar</code>, the set calendar type is returned.
		 * Otherwise, the calendar type is determined by checking the format settings and current locale.
		 *
		 * @return {sap.ui.core.CalendarType} the current calendar type, e.g. <code>Gregorian</code>
		 * @since 1.28.6
		 */
		getCalendarType: Formatting.getCalendarType,

		/**
		 * Returns the calendar week numbering algorithm used to determine the first day of the week
		 * and the first calendar week of the year, see {@link sap.ui.core.date.CalendarWeekNumbering}.
		 *
		 * @returns {sap.ui.core.date.CalendarWeekNumbering} The calendar week numbering algorithm
		 * @function
		 * @public
		 * @since 1.113.0
		 */
		getCalendarWeekNumbering: Formatting.getCalendarWeekNumbering,

		getRTL :Localization.getRTL,

		setRTL : Localization.setRTL,

		/**
		 * Returns a Locale object for the current language.
		 *
		 * The Locale is derived from the {@link #getLanguage language} property.
		 *
		 * @return {sap.ui.core.Locale} The locale
		 * @public
		 */
		getLocale : function() {
			var oLanguageTag = Localization.getLanguageTag();
			return Locale._getCoreLocale(oLanguageTag);
		},

		/**
		 * Checks whether the Cache Manager is switched on.
		 * @ui5-restricted sap.ui.core
		 * @since 1.37.0
		 * @returns {boolean} If cache is enabled
		 * @private
		 */
		isUI5CacheOn: function () {
			return this.getValue("xx-cache-use");
		},

		/**
		 * Enables/Disables the Cache configuration.
		 * @since 1.37.0
		 * @param {boolean} on true to switch it on, false if to switch it off
		 * @returns {this} The Configuration for chaining
		 * @private
		 * @ui5-restricted sap.ui.core
		 */
		setUI5CacheOn: function (on) {
			this["xx-cache-use"] = on;
			return this;
		},

		/**
		 * Checks whether the Cache Manager serialization support is switched on.
		 * @since 1.37.0
		 * @returns {boolean} Wether cache serialization is supported or not
		 * @private
		 * @ui5-restricted sap.ui.core
		 */
		isUI5CacheSerializationSupportOn: function () {
			return this.getValue("xx-cache-serialization");
		},

		/**
		 * Enables/Disables the Cache serialization support
		 * @since 1.37.0
		 * @param {boolean} on true to switch it on, false if to switch it off
		 * @returns {this} The Configuration for chaining
		 * @private
		 * @ui5-restricted sap.ui.core
		 */
		setUI5CacheSerializationSupport: function (on) {
			this["xx-cache-serialization"] = on;
			return this;
		},

		/**
		 * Returns all keys, that the CacheManager will ignore when set/get values.
		 * @private
		 * @ui5-restricted sap.ui.core
		 * @since 1.37.0
		 * @returns {string[]} array of keys that CacheManager should ignore
		 * @see sap.ui.core.cache.LRUPersistentCache#keyMatchesExclusionStrings
		 */
		getUI5CacheExcludedKeys: function () {
			return this.getValue("xx-cache-excludedKeys");
		},

		/**
		 * Sets the new calendar type to be used from now on in locale dependent functionality (for example,
		 * formatting, translation texts, etc.).
		 *
		 * @param {sap.ui.core.CalendarType|null} sCalendarType the new calendar type. Set it with null to clear the calendar type
		 *   and the calendar type is calculated based on the format settings and current locale.
		 * @return {this} <code>this</code> to allow method chaining
		 * @public
		 * @since 1.28.6
		 */
		setCalendarType : function(sCalendarType) {
			Formatting.setCalendarType.apply(Formatting, arguments);
			return this;
		},

		/**
		 * Sets the calendar week numbering algorithm which is used to determine the first day of the week
		 * and the first calendar week of the year, see {@link sap.ui.core.date.CalendarWeekNumbering}.
		 *
		 * @param {sap.ui.core.date.CalendarWeekNumbering} sCalendarWeekNumbering
		 *   The calendar week numbering algorithm
		 * @returns {this}
		 *   <code>this</code> to allow method chaining
		 * @throws {Error}
		 *   If <code>sCalendarWeekNumbering</code> is not a valid calendar week numbering algorithm,
		 *   defined in {@link sap.ui.core.date.CalendarWeekNumbering}
		 *
		 * @public
		 * @since 1.113.0
		 */
		setCalendarWeekNumbering: function(sCalendarWeekNumbering) {
			Formatting.setCalendarWeekNumbering.apply(Formatting, arguments);
			return this;
		},

		/**
		 * Returns the format locale string with language and region code. Falls back to
		 * language configuration, in case it has not been explicitly defined.
		 *
		 * @return {string} the format locale string with language and country code
		 * @public
		 */
		getFormatLocale : function() {
			return Formatting.getLanguageTag().toString();
		},

		/**
		 * Sets a new format locale to be used from now on for retrieving locale
		 * specific formatters. Modifying this setting does not have an impact on
		 * the retrieval of translated texts!
		 *
		 * Can either be set to a concrete value (a BCP47 or Java locale compliant
		 * language tag) or to <code>null</code>. When set to <code>null</code> (default
		 * value) then locale specific formatters are retrieved for the current language.
		 *
		 * After changing the format locale, the framework tries to update localization
		 * specific parts of the UI. See the documentation of {@link #setLanguage} for
		 * details and restrictions.
		 *
		 * <b>Note</b>: When a format locale is set, it has higher priority than a number,
		 * date or time format defined with a call to <code>setLegacyNumberFormat</code>,
		 * <code>setLegacyDateFormat</code> or <code>setLegacyTimeFormat</code>.
		 *
		 * <b>Note</b>: See documentation of {@link #setLanguage} for restrictions.
		 *
		 * @param {string|null} sFormatLocale the new format locale as a BCP47 compliant language tag;
		 *   case doesn't matter and underscores can be used instead of dashes to separate
		 *   components (compatibility with Java Locale IDs)
		 * @return {this} <code>this</code> to allow method chaining
		 * @public
		 * @throws {Error} When <code>sFormatLocale</code> is given, but is not a valid BCP47 language
		 *   tag or Java locale identifier
		 */
		setFormatLocale : function(sFormatLocale) {
			Formatting.setLanguageTag.apply(Formatting, arguments);
			return this;
		},

		getLanguagesDeliveredWithCore : Localization.getLanguagesDeliveredWithCore,

		getSupportedLanguages : Localization.getSupportedLanguages,

		/**
		 * Returns whether the accessibility mode is used or not.
		 * @return {boolean} whether the accessibility mode is used or not
		 * @public
		 */
		getAccessibility : function () {
			return this.getValue("accessibility");
		},

		/**
		 * Returns whether the framework automatically adds
		 * the ARIA role 'application' to the HTML body or not.
		 * @return {boolean} Wether the ARIA role 'application' should be added to the HTML body or not
		 * @since 1.27.0
		 * @public
		 */
		getAutoAriaBodyRole : function () {
			return this.getValue("autoAriaBodyRole");
		},

		/**
		 * Returns whether the animations are globally used.
		 * @return {boolean} whether the animations are globally used
		 * @public
		 * @deprecated As of version 1.50.0, replaced by {@link sap.ui.core.Configuration#getAnimationMode}
		 */
		getAnimation : function () {
			return this.getValue("animation");
		},

		/**
		 * Returns the current animation mode.
		 *
		 * @return {sap.ui.core.Configuration.AnimationMode} The current animationMode
		 * @since 1.50.0
		 * @public
		 */
		getAnimationMode : function () {
			return this.getValue("animationMode");
		},

		/**
		 * Sets the current animation mode.
		 *
		 * Expects an animation mode as string and validates it. If a wrong animation mode was set, an error is
		 * thrown. If the mode is valid it is set, then the attributes <code>data-sap-ui-animation</code> and
		 * <code>data-sap-ui-animation-mode</code> of the HTML document root element are also updated.
		 * If the <code>animationMode</code> is <code>Configuration.AnimationMode.none</code> the old
		 * <code>animation</code> property is set to <code>false</code>, otherwise it is set to <code>true</code>.
		 *
		 * @param {sap.ui.core.Configuration.AnimationMode} sAnimationMode A valid animation mode
		 * @throws {Error} If the provided <code>sAnimationMode</code> does not exist, an error is thrown
		 * @since 1.50.0
		 * @public
		 */
		setAnimationMode : function(sAnimationMode) {
			BaseConfig._.checkEnum(Configuration.AnimationMode, sAnimationMode, "animationMode");

			// Set the animation to on or off depending on the animation mode to ensure backward compatibility.
			this.animation = (sAnimationMode !== Configuration.AnimationMode.minimal && sAnimationMode !== Configuration.AnimationMode.none);

			// Set the animation mode and update html attributes.
			this.animationMode = sAnimationMode;
			if (this._oCore && this._oCore._setupAnimation) {
				this._oCore._setupAnimation();
			}
		},

		/**
		 * Returns whether the Fiori2Adaptation is on.
		 * @return {boolean|string} false - no adaptation, true - full adaptation, comma-separated list - partial adaptation
		 * Possible values: style, collapse, title, back, hierarchy
		 * @public
		 */
		getFiori2Adaptation : function () {
			return this.getValue("xx-fiori2Adaptation");
		},

		/**
		 * Returns whether the page runs in full debug mode.
		 * @returns {boolean} Whether the page runs in full debug mode
		 * @public
		 */
		getDebug : function () {
			// Configuration only maintains a flag for the full debug mode.
			// ui5loader-autoconfig calculates detailed information also for the partial debug
			// mode and writes it to window["sap-ui-debug"].
			// Only a value of true must be reflected by this getter
			return window["sap-ui-debug"] === true || BaseConfig.get({name: "sapUiDebug", type: BaseConfig.Type.Boolean, external: true});
		},

		/**
		 * Returns whether the UI5 control inspe ctor is displayed.
		 * Has only an effect when the sap-ui-debug module has been loaded
		 * @return {boolean} whether the UI5 control inspector is displayed
		 * @public
		 */
		getInspect : function () {
			return this.getValue("inspect");
		},

		/**
		 * Returns whether the text origin information is collected.
		 * @return {boolean} whether the text info is collected
		 * @public
		 */
		getOriginInfo : function () {
			return this.getValue("originInfo");
		},

		/**
		 * Returns whether there should be an exception on any duplicate element IDs.
		 * @return {boolean} whether there should be an exception on any duplicate element IDs
		 * @public
		 */
		getNoDuplicateIds : function () {
			return BaseConfig.get({ name: "sapUiNoDuplicateIds", type: BaseConfig.Type.Boolean, defaultValue: true, external: true });
		},

		/**
		 * Whether a trace view should be shown or not.
		 *
		 * Has only an effect when the sap-ui-debug module has been loaded
		 * either by explicitly loading it or by setting the 'debug' option to true.
		 * @return {boolean} whether a trace view should be shown
		 */
		getTrace : function () {
			return this.getValue("trace");
		},

		/**
		 * Prefix to be used for automatically generated control IDs.
		 * Default is a double underscore "__".
		 *
		 * @returns {string} the prefix to be used
		 * @public
		 */
		getUIDPrefix : function() {
			return this.getValue("uidPrefix");
		},


		/**
		 * Return whether the design mode is active or not.
		 *
		 * @returns {boolean} whether the design mode is active or not.
		 * @since 1.13.2
		 * @private
		 * @ui5-restricted sap.ui.core.Core, sap.watt, com.sap.webide, sap.ui.fl, sap.ui.rta, sap.ui.comp, SAP Business Application Studio
		 */
		getDesignMode : function() {
			return BaseConfig.get({
				name: "sapUiXxDesignMode",
				type: BaseConfig.Type.Boolean,
				external: true,
				freeze: true
			});
		},

		/**
		 * Return whether the activation of the controller code is suppressed.
		 *
		 * @returns {boolean} whether the activation of the controller code is suppressed or not
		 * @since 1.13.2
		 * @private
		 * @ui5-restricted sap.watt, com.sap.webide
		 */
		getSuppressDeactivationOfControllerCode : function() {
			return BaseConfig.get({
				name: "sapUiXxSuppressDeactivationOfControllerCode",
				type: BaseConfig.Type.Boolean,
				external: true,
				freeze: true
			});
		},

		/**
		 * Return whether the controller code is deactivated. During design mode the.
		 *
		 * @returns {boolean} whether the activation of the controller code is suppressed or not
		 * @since 1.26.4
		 * @private
		 * @ui5-restricted sap.watt, com.sap.webide
		 */
		getControllerCodeDeactivated : function() {
			return this.getDesignMode() && !this.getSuppressDeactivationOfControllerCode();
		},

		/**
		 * The name of the application to start or empty.
		 *
		 * @returns {string} name of the application
		 * @public
		 * @deprecated Since 1.15.1. Please use {@link module:sap/ui/core/ComponentSupport} instead. See also {@link topic:82a0fcecc3cb427c91469bc537ebdddf Declarative API for Initial Components}.
		 */
		getApplication : function() {
			return this.getValue("application");
		},

		/**
		 * The name of the root component to start or empty.
		 *
		 * @returns {string} name of the root component
		 * @public
		 * @deprecated Since 1.95. Please use {@link module:sap/ui/core/ComponentSupport} instead. See also {@link topic:82a0fcecc3cb427c91469bc537ebdddf Declarative API for Initial Components}.
		 */
		getRootComponent : function() {
			return this.getValue("rootComponent");
		},

		/**
		 * Base URLs to AppCacheBuster ETag-Index files.
		 *
		 * @returns {string[]} array of base URLs
		 * @public
		 */
		getAppCacheBuster : function() {
			return BaseConfig.get({name: "sapUiAppCacheBuster", type: BaseConfig.Type.StringArray, external: true, freeze: true});
		},

		/**
		 * The loading mode (sync|async|batch) of the AppCacheBuster (sync is default)
		 *
		 * @returns {string} "sync" | "async"
		 * @public
		 */
		getAppCacheBusterMode : function() {
			return BaseConfig.get({name: "sapUiXxAppCacheBusterMode", type: BaseConfig.Type.String, defaultValue: "sync", external: true, freeze: true});
		},

		/**
		 * Object defining the callback hooks for the AppCacheBuster like e.g.
		 * <code>handleURL</code>, <code>onIndexLoad</code> or <code>onIndexLoaded</code>.
		 *
		 * @returns {object} object containing the callback functions for the AppCacheBuster
		 * @private
		 * @ui5-restricted
		 */
		getAppCacheBusterHooks : function() {
			return BaseConfig.get({name: "sapUiXxAppCacheBusterHooks", type: BaseConfig.Type.Object, defaultValue: undefined, freeze: true});
		},

		/**
		 * Flag, whether the customizing is disabled or not.
		 *
		 * @returns {boolean} true if customizing is disabled
		 * @private
		 * @ui5-restricted
		 */
		getDisableCustomizing : function() {
			return BaseConfig.get({name: "sapUiXxDisableCustomizing", type: BaseConfig.Type.Boolean});
		},

		/**
		 * Flag, representing the status of the view cache.
		 * @see {sap.ui.xmlview}
		 *
		 * @returns {boolean} true if view cache is enabled
		 * @private
		 * @experimental Since 1.44
		 */
		getViewCache : function() {
			return this.getValue("xx-viewCache");
		},

		/**
		 * Currently active preload mode for libraries or falsy value.
		 *
		 * @returns {string} preload mode
		 * @private
		 * @ui5-restricted sap.ui.core.Core
		 * @since 1.16.3
		 */
		getPreload : function() {
			// if debug sources are requested, then the preload feature must be deactivated
			if (this.getDebug() === true) {
				return "";
			}
			// determine preload mode (e.g. resolve default or auto)
			var sPreloadMode = BaseConfig.get({name: "sapUiPreload", type: BaseConfig.Type.String, defaultValue: "auto", external: true});
			// when the preload mode is 'auto', it will be set to 'async' or 'sync' for optimized sources
			// depending on whether the ui5loader is configured async
			if ( sPreloadMode === "auto" ) {
				if (window["sap-ui-optimized"]) {
					sPreloadMode = sap.ui.loader.config().async ? "async" : "sync";
				} else {
					sPreloadMode = "";
				}
			}
			return sPreloadMode;
		},

		/**
		 * Currently active syncCallBehavior
		 *
		 * @returns {int} syncCallBehavior
		 * @private
		 * @ui5-restricted sap.ui.core
		 * @since 1.106.0
		 */
		getSyncCallBehavior : function() {
			var syncCallBehavior = 0; // ignore
			var mOptions = {
				name: "sapUiXxNoSync",
				type: BaseConfig.Type.String,
				external: true,
				freeze: true
			};
			var sNoSync = BaseConfig.get(mOptions);
			if (sNoSync === 'warn') {
				syncCallBehavior = 1;
			} else {
				mOptions.type = BaseConfig.Type.Boolean;
				if (BaseConfig.get(mOptions)) {
					syncCallBehavior = 2;
				}
			}
			return syncCallBehavior;
		},

		/**
		 * Whether dependency cache info files should be loaded instead of preload files.
		 *
		 * This is an experimental feature intended for HTTP/2 scenarios.
		 * @private
		 */
		getDepCache : function() {
			return BaseConfig.get({name: "sapUiXxDepCache", type: BaseConfig.Type.Boolean, external: true});
		},

		/**
		 * Flag whether a Component should load the manifest first.
		 *
		 * @returns {boolean} true if a Component should load the manifest first
		 * @public
		 * @since 1.33.0
		 */
		getManifestFirst : function() {
			return BaseConfig.get({name: "sapUiManifestFirst", type: BaseConfig.Type.Boolean, external: true});
		},

		/**
		 * Returns the URL from where the UI5 flexibility services are called;
		 * if empty, the flexibility services are not called.
		 *
		 * @returns {object[]} Flexibility services configuration
		 * @public
		 * @since 1.60.0
		 */
		getFlexibilityServices : function() {
			var vFlexibilityServices = this.getValue("flexibilityServices") || [];

			if (typeof vFlexibilityServices === 'string') {
				if (vFlexibilityServices[0] === "/") {
					vFlexibilityServices = [{
						url : vFlexibilityServices,
						layers : ["ALL"],
						connector : "LrepConnector"
					}];
				} else {
					vFlexibilityServices = JSON.parse(vFlexibilityServices);
				}
			}
			this.flexibilityServices = vFlexibilityServices;

			return this.flexibilityServices;
		},

		/**
		 * Sets the UI5 flexibility services configuration.
		 *
		 * @param {object[]} aFlexibilityServices Connector configuration
		 * @param {string} [aFlexibilityServices.connector] Name of the connector
		 * @param {string} [aFlexibilityServices.applyConnector] Name of the full module name of the custom apply connector
		 * @param {string} [aFlexibilityServices.writeConnector] Name of the full module name of the custom write connector
		 * @param {boolean} [aFlexibilityServices.custom=false] Flag to identify the connector as custom or fl owned
		 * @param {string} [aFlexibilityServices.url] Url for requests sent by the connector
		 * @param {string} [aFlexibilityServices.path] Path for loading data in the ObjectPath connector
		 * @param {sap.ui.fl.Layer[]} [aFlexibilityServices.layers] List of layers in which the connector is allowed to write
		 * @private
		 * @ui5-restricted sap.ui.fl, other ui5 bootstrapping tools
		 * @since 1.73.0
		 */
		setFlexibilityServices: function (aFlexibilityServices) {
			this.flexibilityServices = aFlexibilityServices.slice();
		},

		/**
		 * Currently active preload mode for components or falsy value.
		 *
		 * @returns {string} component preload mode
		 * @private
		 * @experimental Since 1.16.3, might change completely.
		 */
		getComponentPreload : function() {
			return BaseConfig.get({name: "sapUiXxComponentPreload", type: BaseConfig.Type.String, external: true}) || this.getPreload();
		},

		/**
		 * Returns a configuration object that bundles the format settings of UI5.
		 *
		 * @returns {sap.ui.core.Configuration.FormatSettings} A FormatSettings object.
		 * @public
		 */
		getFormatSettings : function() {
			return this.oFormatSettings;
		},

		/**
		 * frameOptions mode (allow/deny/trusted).
		 *
		 * @return {string} frameOptions mode
		 * @public
		 */
		getFrameOptions : function() {
			return this.getValue("frameOptions");
		},

		/**
		 * URL of the whitelist service.
		 *
		 * @return {string} whitelist service URL
		 * @public
		 * @deprecated Since 1.85.0. Use {@link sap.ui.core.Configuration#getAllowlistService} instead.
		 * SAP strives to replace insensitive terms with inclusive language.
		 * Since APIs cannot be renamed or immediately removed for compatibility reasons, this API has been deprecated.
		 */
		getWhitelistService : function() {
			return this.getAllowlistService();
		},

		/**
		 * URL of the allowlist service.
		 *
		 * @return {string} allowlist service URL
		 * @public
		 */
		getAllowlistService : function() {
			return this.getValue("allowlistService");
		},

		/**
		 * Name (ID) of a UI5 module that implements file share support.
		 *
		 * If no implementation is known, <code>undefined</code> is returned.
		 *
		 * The contract of the module is not defined by the configuration API.
		 *
		 * @returns {string|undefined} Module name (ID) of a file share support module
		 * @public
		 * @since 1.102
		 */
		getFileShareSupport : function() {
			return this.getValue("fileShareSupport") || undefined;
		},

		/**
		 * Whether support mode is enabled.
		 *
		 * @return {boolean} support mode is enabled
		 * @experimental
		 */
		getSupportMode : function() {
			return this.getValue("support");
		},

		/**
		 * Whether test tools are enabled.
		 *
		 * @return {boolean} test tools are enabled
		 * @experimental
		 */
		getTestRecorderMode : function() {
			return this.getValue("testRecorder");
		},

		_collect : function() {
			var mChanges = this.mChanges || (this.mChanges = { __count : 0});
			mChanges.__count++;
			return mChanges;
		},

		_endCollect : function() {
			var mChanges = this.mChanges;
			if ( mChanges && (--mChanges.__count) === 0 ) {
				delete mChanges.__count;
				delete this.mChanges;
				this._oCore && this._oCore.fireLocalizationChanged(mChanges);
			}
		},

		/**
		 * Flag if statistics are requested.
		 *
		 * Flag set by TechnicalInfo Popup will also be checked
		 * So its active if set by URL parameter or by TechnicalInfo property
		 *
		 * @returns {boolean} statistics flag
		 * @private
		 * @deprecated since 1.106.0. Renamed for clarity, use {@link sap.ui.core.Configuration#getStatisticsEnabled} instead
		 * @since 1.20.0
		 */
		getStatistics : function() {
			return this.getStatisticsEnabled();
		},

		/**
		 * Flag if statistics are requested.
		 *
		 * Flag set by TechnicalInfo Popup will also be checked.
		 * So its active if set by URL parameter or manually via TechnicalInfo.
		 *
		 * @returns {boolean} Whether statistics are enabled
		 * @public
		 * @since 1.106.0
		 */
		getStatisticsEnabled : function() {
			var result = this.getValue("statistics");
			try {
				result = result || window.localStorage.getItem("sap-ui-statistics") == "X";
			} catch (e) {
				// access to local storage might fail due to security / privacy settings
			}
			return result;
		},

		/**
		 * Return whether native scrolling should be suppressed on touch devices.
		 *
		 * @returns {boolean} whether native scrolling is suppressed on touch devices
		 * @since 1.20.0
		 * @deprecated since 1.26.0. Always use native scrolling
		 * @private
		 */
		getNoNativeScroll : function() {
			return false;
		},

		/**
		 * Return whether type validation is handled by core.
		 *
		 * @returns {boolean} whether whether type validation is handled by core
		 * @since 1.28.0
		 * @private
		 */
		getHandleValidation : function() {
			return this.getValue("xx-handleValidation");
		},

		/**
		 * Gets if the hyphenation has to be forced to use only browser-native or only third-party.
		 *
		 * @returns {string} empty string, "native" or "thirdparty"
		 * @private
		 */
		getHyphenation : function() {
			return this.getValue("xx-hyphenation");
		},

		/**
		 * Gets if pressing alt key will highlight access keys enabled elements on the screen.
		 *
		 * @returns {boolean} whether access keys is enabled
		 * @since 1.104.0
		 * @experimental
		 */
		getAccKeys: function () {
			return this.getValue("xx-acc-keys");
		},

		/**
		 * Returns the list of active terminologies defined via the Configuration.
		 *
		 * @returns {string[]|undefined} if no active terminologies are set, the default value <code>undefined</code> is returned.
		 * @since 1.77.0
		 * @public
		 */
		getActiveTerminologies : function() {
			return BaseConfig.get({name: "sapUiActiveTerminologies", type: BaseConfig.Type.StringArray, defaultValue: undefined, external: true});
		},

		/**
		 * Returns the security token handlers of an OData V4 model.
		 *
		 * @returns {Array<function(sap.ui.core.URI):Promise>} the security token handlers (an empty array if there are none)
		 * @public
		 * @since 1.95.0
		 * @see #setSecurityTokenHandlers
		 */
		getSecurityTokenHandlers : function () {
			return this.getValue("securityTokenHandlers").slice();
		},

		/**
		 * Gets if performance measurement for UI5 Integration Cards should happen.
		 *
		 * @returns {boolean} whether measurement should be executed
		 * @since 1.112.0
		 * @experimental
		 */
		getMeasureCards: function () {
			return this.getValue("xx-measure-cards");
		},

		/**
		 * Sets the security token handlers for an OData V4 model. See chapter
		 * {@link topic:9613f1f2d88747cab21896f7216afdac/section_STH Security Token Handling}.
		 *
		 * @param {Array<function(sap.ui.core.URI):Promise>} aSecurityTokenHandlers - The security token handlers
		 * @public
		 * @since 1.95.0
		 * @see #getSecurityTokenHandlers
		 */
		setSecurityTokenHandlers : function (aSecurityTokenHandlers) {
			aSecurityTokenHandlers.forEach(function (fnSecurityTokenHandler) {
				check(typeof fnSecurityTokenHandler === "function",
					"Not a function: " + fnSecurityTokenHandler);
			});
			this.securityTokenHandlers = aSecurityTokenHandlers.slice();
		},

		getBindingSyntax: function() {
			var sBindingSyntax = BaseConfig.get({
				name: "sapUiBindingSyntax",
				type: BaseConfig.Type.String,
				defaultValue: "default",
				freeze: true
			});
			if ( sBindingSyntax === "default" ) {
				sBindingSyntax = (this.getCompatibilityVersion("sapCoreBindingSyntax").compareTo("1.26") < 0) ? "simple" : "complex";
			}
			return sBindingSyntax;
		},

		/**
		 * Applies multiple changes to the configuration at once.
		 *
		 * If the changed settings contain localization related settings like <code>language</code>
		 * or <ode>calendarType</code>, then only a single <code>localizationChanged</code> event will
		 * be fired. As the framework has to inform all existing components, elements, models etc.
		 * about localization changes, using <code>applySettings</code> can significantly reduce the
		 * overhead for multiple changes, esp. when they occur after the UI has been created already.
		 *
		 * The <code>mSettings</code> can contain any property <code><i>xyz</i></code> for which a
		 * setter method <code>set<i>XYZ</i></code> exists in the API of this class.
		 * Similarly, values for the {@link sap.ui.core.Configuration.FormatSettings format settings}
		 * API can be provided in a nested object with name <code>formatSettings</code>.
		 *
		 *
		 * @example <caption>Apply <code>language</code>, <code>calendarType</code> and several legacy
		 *          format settings in one call</caption>
		 *
		 * sap.ui.getCore().getConfiguration().applySettings({
		 *     language: 'de',
		 *     calendarType: sap.ui.core.CalendarType.Gregorian,
		 *     formatSettings: {
		 *         legacyDateFormat: '1',
		 *         legacyTimeFormat: '1',
		 *         legacyNumberFormat: '1'
		 *     }
		 * });
		 *
		 * @param {object} mSettings Configuration options to apply
		 * @returns {this} Returns <code>this</code> to allow method chaining
		 * @public
		 * @since 1.38.6
		 */
		applySettings: function(mSettings) {

			function applyAll(ctx, m) {
				var sName, sMethod;
				for ( sName in m ) {
					sMethod = "set" + sName.slice(0,1).toUpperCase() + sName.slice(1);
					if ( sName === 'formatSettings' && ctx.oFormatSettings ) {
						applyAll(ctx.oFormatSettings, m[sName]);
					} else if ( typeof ctx[sMethod] === 'function' ) {
						ctx[sMethod](m[sName]);
					} else {
						Log.warning("Configuration.applySettings: unknown setting '" + sName + "' ignored");
					}
				}
			}

			assert(typeof mSettings === 'object', "mSettings must be an object");

			this._collect(); // block events
			applyAll(this, mSettings);
			this._endCollect(); // might fire localizationChanged

			return this;
		},

		/**
		 * Function to pass core instance to configuration. Should be only used by core constructor.
		 *
		 * @param {sap.ui.core.Core} oCore Instance of 'real' core
		 *
		 * @private
	 	 * @ui5-restricted sap.ui.core.Core
		 */
		setCore: function (oCore) {
			// Setting the core needs to happen before init
			// because getValue relies on _oCore and is used in init
			this._oCore = oCore;
			this.init();
		},

		/**
		 * Generic getter for configuration options that are not explicitly exposed via a dedicated own getter.
		 *
		 * For now, this getter only supports configuration options that are known to Configuration.js
		 * (as maintained in the M_SETTINGS, see code).
		 *
		 * @param {string} sName Name of the configuration parameter, must be a key of M_SETTINGS
		 * @returns {any} Value of the configuration parameter, will be of the type specified in M_SETTINGS
		 *
		 * @private
	 	 * @ui5-restricted sap.ui.core.Core, jquery.sap.global
	 	 * @since 1.106
		 */
		getValue: function(sName) {
			var vValue;
			if (typeof sName !== "string" || !Object_hasOwn(M_SETTINGS, sName)) {
				throw new TypeError(
					"Parameter 'sName' must be the name of a valid configuration option (one of "
					+ Object.keys(M_SETTINGS).map(function(key) {
						return "'" + key + "'";
					  }).sort().join(", ")
					+ ")"
				);
			}

			// Until the Configuration is initialized we return the configuration value either from the instance
			// (if a setter was called), from URL or window["sap-ui-config"].
			// In case there is no value or the type conversion fails we return the defaultValue.
			// After the Configuration is initialized we only return the value of the configuration.
			if (this.bInitialized || this.hasOwnProperty(sName)) {
				vValue = this[sName];
			} else {
				if (!this.ignoreUrlParams && !M_SETTINGS[sName].noUrl) {
					var oUriParams = new URLSearchParams(window.location.search);
					vValue = oUriParams.get("sap-ui-" + sName) || oUriParams.get("sap-" + sName);
				}
				vValue = vValue ? vValue : window["sap-ui-config"][sName] || window["sap-ui-config"][sName.toLowerCase()];
				try {
					vValue = vValue === undefined ? M_SETTINGS[sName].defaultValue : convertToType(sName, vValue);
				} catch (error) {
					// If type conversion fails return defaultValue
					vValue = M_SETTINGS[sName].defaultValue;
				}
			}
			// Return copy of array or object instead of reference
			if (typeof M_SETTINGS[sName].type === "string" &&
				(M_SETTINGS[sName].type.endsWith("[]") || M_SETTINGS[sName].type === "object")) {
				vValue = deepClone(vValue);
			}
			return vValue;
		}
	});

	/**
	 * Enumerable list with available animation modes.
	 *
	 * This enumerable is used to validate the animation mode. Animation modes allow to specify different animation scenarios or levels.
	 * The implementation of the Control (JavaScript or CSS) has to be done differently for each animation mode.
	 *
	 * @enum {string}
	 * @since 1.50.0
	 * @public
	 */
	Configuration.AnimationMode = M_ANIMATION_MODE;

	/*
	 * Helper that creates a Locale object from the given language
	 * or, if that fails, returns null.
	 * A value of null indicates that the language was not BCP47 compliant.
	 */
	function convertToLocaleOrNull(sLanguage) {
		try {
			if ( sLanguage && typeof sLanguage === 'string' ) {
				return new Locale( sLanguage );
			}
		} catch (e) {
			// ignore
		}
	}

	function check(bCondition, sMessage) {
		if ( !bCondition ) {
			throw new Error(sMessage);
		}
	}

	/**
	 * @class Encapsulates configuration settings that are related to data formatting/parsing.
	 *
	 * <b>Note:</b> When format configuration settings are modified through this class,
	 * UI5 only ensures that formatter objects created after that point in time will honor
	 * the modifications. To be on the safe side, applications should do any modifications
	 * early in their lifecycle or recreate any model/UI that is locale dependent.
	 *
	 * @alias sap.ui.core.Configuration.FormatSettings
	 * @extends sap.ui.base.Object
	 * @public
	 * @borrows module:sap/base/i18n/Formatting.getCustomUnits as #getCustomUnits
	 * @borrows module:sap/base/i18n/Formatting.setCustomUnits as #setCustomUnits
	 * @borrows module:sap/base/i18n/Formatting.addCustomUnits as #addCustomUnits
	 * @borrows module:sap/base/i18n/Formatting.getUnitMappings as #getUnitMappings
	 * @borrows module:sap/base/i18n/Formatting.setUnitMappings as #setUnitMappings
	 * @borrows module:sap/base/i18n/Formatting.addUnitMappings as #addUnitMappings
	 * @borrows module:sap/base/i18n/Formatting.getDatePattern as #getDatePattern
	 * @borrows module:sap/base/i18n/Formatting.getTimePattern as #getTimePattern
	 * @borrows module:sap/base/i18n/Formatting.getNumberSymbol as #getNumberSymbol
	 * @borrows module:sap/base/i18n/Formatting.getCustomCurrencies as #getCustomCurrencies
	 * @borrows module:sap/base/i18n/Formatting.setCustomCurrencies as #setCustomCurrencies
	 * @borrows module:sap/base/i18n/Formatting.addCustomCurrencies as #addCustomCurrencies
	 * @borrows module:sap/base/i18n/Formatting.getLegacyDateFormat as #getLegacyDateFormat
	 * @borrows module:sap/base/i18n/Formatting.getLegacyTimeFormat as #getLegacyTimeFormat
	 * @borrows module:sap/base/i18n/Formatting.getLegacyNumberFormat as #getLegacyNumberFormat
	 * @borrows module:sap/base/i18n/Formatting.getLegacyDateCalendarCustomizing as #getLegacyDateCalendarCustomizing
	 * @borrows module:sap/base/i18n/Formatting.setLegacyDateCalendarCustomizing as #setLegacyDateCalendarCustomizing
	 * @borrows module:sap/base/i18n/Formatting.getTrailingCurrencyCode as #getTrailingCurrencyCode
	 * @borrows module:sap/base/i18n/Formatting.setTrailingCurrencyCode as #setTrailingCurrencyCode
	 * @borrows module:sap/base/i18n/Formatting.getCustomLocaleData as #getCustomLocaleData
	 *
	 */
	var FormatSettings = BaseObject.extend("sap.ui.core.Configuration.FormatSettings", /** @lends sap.ui.core.Configuration.FormatSettings.prototype */ {
		constructor : function() {
			this.mSettings = {};
		},

		/**
		 * Returns the locale to be used for formatting.
		 *
		 * If no such locale has been defined, this method falls back to the language,
		 * see {@link sap.ui.core.Configuration#getLanguage Configuration.getLanguage()}.
		 *
		 * If any user preferences for date, time or number formatting have been set,
		 * and if no format locale has been specified, then a special private use subtag
		 * is added to the locale, indicating to the framework that these user preferences
		 * should be applied.
		 *
		 * @return {sap.ui.core.Locale} the format locale
		 * @public
		 */
		getFormatLocale : function() {
			var oLocale = Formatting.getLanguageTag();
			return Locale._getCoreLocale(oLocale);
		},

		_set: Formatting._set,

		getCustomUnits: Formatting.getCustomUnits,

		setCustomUnits: Formatting.setCustomUnits,

		addCustomUnits: Formatting.addCustomUnits,

		setUnitMappings: Formatting.setUnitMappings,

		addUnitMappings: Formatting.addUnitMappings,

		getUnitMappings: Formatting.getUnitMappings,

		getDatePattern : Formatting.getDatePattern,

		/**
		 * Defines the preferred format pattern for the given date format style.
		 *
		 * Calling this method with a null or undefined pattern removes a previously set pattern.
		 *
		 * If a pattern is defined, it will be preferred over patterns derived from the current locale.
		 *
		 * See class {@link sap.ui.core.format.DateFormat} for details about the pattern syntax.
		 *
		 * After changing the date pattern, the framework tries to update localization
		 * specific parts of the UI. See the documentation of {@link sap.ui.core.Configuration#setLanguage}
		 * for details and restrictions.
		 *
		 * @param {string} sStyle must be one of short, medium, long or full.
		 * @param {string} sPattern the format pattern to be used in LDML syntax.
		 * @returns {this} Returns <code>this</code> to allow method chaining
		 * @public
		 * @function
		 */
		setDatePattern : Formatting.setDatePattern,

		getTimePattern : Formatting.getTimePattern,

		/**
		 * Defines the preferred format pattern for the given time format style.
		 *
		 * Calling this method with a null or undefined pattern removes a previously set pattern.
		 *
		 * If a pattern is defined, it will be preferred over patterns derived from the current locale.
		 *
		 * See class {@link sap.ui.core.format.DateFormat} for details about the pattern syntax.
		 *
		 * After changing the time pattern, the framework tries to update localization
		 * specific parts of the UI. See the documentation of {@link sap.ui.core.Configuration#setLanguage}
		 * for details and restrictions.
		 *
		 * @param {string} sStyle must be one of short, medium, long or full.
		 * @param {string} sPattern the format pattern to be used in LDML syntax.
		 * @returns {this} Returns <code>this</code> to allow method chaining
		 * @public
		 * @function
		 */
		setTimePattern : Formatting.setTimePattern,

		getNumberSymbol : Formatting.getNumberSymbol,

		/**
		 * Defines the string to be used for the given number symbol.
		 *
		 * Calling this method with a null or undefined symbol removes a previously set symbol string.
		 * Note that an empty string is explicitly allowed.
		 *
		 * If a symbol is defined, it will be preferred over symbols derived from the current locale.
		 *
		 * See class {@link sap.ui.core.format.NumberFormat} for details about the symbols.
		 *
		 * After changing the number symbol, the framework tries to update localization
		 * specific parts of the UI. See the documentation of {@link sap.ui.core.Configuration#setLanguage}
		 * for details and restrictions.
		 *
		 * @param {"group"|"decimal"|"plusSign"|"minusSign"} sType the type of symbol
		 * @param {string} sSymbol will be used to represent the given symbol type
		 * @returns {this} Returns <code>this</code> to allow method chaining
		 * @public
		 * @function
		 */
		setNumberSymbol : Formatting.setNumberSymbol,

		getCustomCurrencies : Formatting.getCustomCurrencies,

		setCustomCurrencies : Formatting.setCustomCurrencies,

		addCustomCurrencies: Formatting.addCustomCurrencies,

		/**
		 * Defines the day used as the first day of the week.
		 *
		 * The day is set as an integer value between 0 (Sunday) and 6 (Saturday).
		 * Calling this method with a null or undefined symbol removes a previously set value.
		 *
		 * If a value is defined, it will be preferred over values derived from the current locale.
		 *
		 * Usually in the US the week starts on Sunday while in most European countries on Monday.
		 * There are special cases where you want to have the first day of week set independent of the
		 * user locale.
		 *
		 * After changing the first day of week, the framework tries to update localization
		 * specific parts of the UI. See the documentation of {@link sap.ui.core.Configuration#setLanguage}
		 * for details and restrictions.
		 *
		 * @param {int} iValue must be an integer value between 0 and 6
		 * @returns {this} Returns <code>this</code> to allow method chaining
		 * @public
		 * @deprecated Since 1.113.0. Use {@link sap.ui.core.Configuration.FormatSettings#setCalendarWeekNumbering} instead.
		 */
		setFirstDayOfWeek : function(iValue) {
			check(typeof iValue == "number" && iValue >= 0 && iValue <= 6, "iValue must be an integer value between 0 and 6");
			Formatting._set("weekData-firstDay", iValue);
			return this;
		},

		_setDayPeriods: Formatting._setDayPeriods,

		getLegacyDateFormat : Formatting.getLegacyDateFormat,

		/**
		 * Allows to specify one of the legacy ABAP date formats.
		 *
		 * This method modifies the date patterns for 'short' and 'medium' style with the corresponding ABAP
		 * format. When called with a null or undefined format id, any previously applied format will be removed.
		 *
		 * After changing the legacy date format, the framework tries to update localization
		 * specific parts of the UI. See the documentation of {@link sap.ui.core.Configuration#setLanguage}
		 * for details and restrictions.
		 *
		 * @param {""|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"A"|"B"|"C"} [sFormatId=""] ID of the ABAP date format,
		 *   <code>""</code> will reset the date patterns for 'short' and 'medium' style to the
		 *   locale-specific ones.
		 * @returns {this} Returns <code>this</code> to allow method chaining
		 * @public
		 * @function
		 */
		setLegacyDateFormat : Formatting.setLegacyDateFormat,

		getLegacyTimeFormat : Formatting.getLegacyTimeFormat,

		/**
		 * Allows to specify one of the legacy ABAP time formats.
		 *
		 * This method sets the time patterns for 'short' and 'medium' style to the corresponding ABAP
		 * formats and sets the day period texts to "AM"/"PM" or "am"/"pm" respectively. When called
		 * with a null or undefined format id, any previously applied format will be removed.
		 *
		 * After changing the legacy time format, the framework tries to update localization
		 * specific parts of the UI. See the documentation of {@link sap.ui.core.Configuration#setLanguage}
		 * for details and restrictions.
		 *
		 * @param {""|"0"|"1"|"2"|"3"|"4"} [sFormatId=""] ID of the ABAP time format,
		 *   <code>""</code> will reset the time patterns for 'short' and 'medium' style and the day
		 *   period texts to the locale-specific ones.
		 * @returns {this} Returns <code>this</code> to allow method chaining
		 * @public
		 * @function
		 */
		setLegacyTimeFormat : Formatting.setLegacyTimeFormat,

		getLegacyNumberFormat : Formatting.getLegacyNumberFormat,

		/**
		 * Allows to specify one of the legacy ABAP number format.
		 *
		 * This method will modify the 'group' and 'decimal' symbols. When called with a null
		 * or undefined format id, any previously applied format will be removed.
		 *
		 * After changing the legacy number format, the framework tries to update localization
		 * specific parts of the UI. See the documentation of {@link sap.ui.core.Configuration#setLanguage}
		 * for details and restrictions.
		 *
		 * @param {""|" "|"X"|"Y"} [sFormatId=""] ID of the ABAP number format set,
		 *   <code>""</code> will reset the 'group' and 'decimal' symbols to the locale-specific
		 *   ones.
		 * @returns {this} Returns <code>this</code> to allow method chaining
		 * @public
		 * @function
		 */
		setLegacyNumberFormat : Formatting.setLegacyNumberFormat,

		setLegacyDateCalendarCustomizing : Formatting.setLegacyDateCalendarCustomizing,

		getLegacyDateCalendarCustomizing : Formatting.getLegacyDateCalendarCustomizing,

		setTrailingCurrencyCode : Formatting.setTrailingCurrencyCode,

		getTrailingCurrencyCode : Formatting.getTrailingCurrencyCode,

		getCustomLocaleData : Formatting.getCustomLocaleData
	});

	oConfiguration =  new Configuration();

	//enable Eventing
	Localization.attachChange(function(oEvent) {
		if (!this.mChanges && this._oCore) {
			this._oCore.fireLocalizationChanged(BaseEvent.getParameters(oEvent));
		} else if (this.mChanges) {
			Object.assign(this.mChanges, BaseEvent.getParameters(oEvent));
		}
	}.bind(oConfiguration));

	Formatting.attachChange(function(oEvent) {
		if (!this.mChanges && this._oCore) {
			this._oCore.fireLocalizationChanged(BaseEvent.getParameters(oEvent));
		} else if (this.mChanges) {
			Object.assign(this.mChanges, BaseEvent.getParameters(oEvent));
		}
	}.bind(oConfiguration));

	Object.assign(Configuration, oConfiguration.getInterface());
	return Configuration;
});