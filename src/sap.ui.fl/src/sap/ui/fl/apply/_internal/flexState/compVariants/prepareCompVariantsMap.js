/*
 * ! ${copyright}
 */

sap.ui.define([
	"sap/ui/fl/Change",
	"sap/ui/fl/apply/_internal/flexObjects/CompVariant",
	"sap/ui/fl/apply/_internal/flexState/compVariants/CompVariantMerger"
], function(
	Change,
	CompVariant,
	CompVariantMerger
) {
	"use strict";

	function getOrCreate(mMap, sKey) {
		mMap[sKey] = mMap[sKey] || {
			variants: [],
			nonPersistedVariants: [],
			changes: [],
			defaultVariant: undefined,
			standardVariant: undefined
		};

		return mMap[sKey];
	}

	function initialize(mMap, mById, sKey, aVariants) {
		aVariants = aVariants || [];
		var mMapOfKey = getOrCreate(mMap, sKey);

		// clear all non-persisted variants in case of a reinitialization
		mMapOfKey.nonPersistedVariants.forEach(function (oVariant) {
			delete mById[oVariant.getId()];
		});

		mMapOfKey.nonPersistedVariants = aVariants.map(function (oVariant) {
			var oVariantInstance = Object.assign({
				id: oVariant.id,
				persisted: false
			}, oVariant);
			oVariantInstance = CompVariantMerger.createVariant(sKey, oVariantInstance);
			mById[oVariant.id] = oVariantInstance;
			return oVariantInstance;
		});

		return mMapOfKey;
	}

	function buildSectionMap(mCompSection, sSubSection, mById, mCompVariants) {
		var oClass = sSubSection === "variants" ? CompVariant : Change;
		var aFlexObjects = mCompSection[sSubSection].map(function (oCompVariantChangeDefinition) {
			var oFlexObject = new oClass(oCompVariantChangeDefinition);
			oFlexObject.setState(Change.states.PERSISTED); // prevent persisting these anew
			return oFlexObject;
		});

		aFlexObjects.forEach(function (oFlexObject) {
			mById[oFlexObject.getId()] = oFlexObject;
			var sPersistencyKey = oFlexObject.getSelector().persistencyKey;

			switch (sSubSection) {
				case "defaultVariants":
					getOrCreate(mCompVariants, sPersistencyKey)["defaultVariant"] = oFlexObject;
					break;
				case "standardVariants":
					getOrCreate(mCompVariants, sPersistencyKey)["standardVariant"] = oFlexObject;
					break;
				default:
					getOrCreate(mCompVariants, sPersistencyKey)[sSubSection].push(oFlexObject);
			}
		});
	}

	/**
	 * Prepares the CompVariants from the flex response.
	 *
	 * @function
	 * @since 1.83
	 * @private
	 * @ui5-restricted sap/ui/fl/apply/_internal/flexState/FlexState
	 * @alias module:sap/ui/fl/apply/_internal/flexState/compVariants/prepareCompVariantsMap
	 *
	 * @param {object} mPropertyBag - Contains additional data needed for preparing the map
	 * @param {object} mPropertyBag.storageResponse - Storage response with the flex data
	 * @returns {object} The prepared map for compVariants
	 */
	return function(mPropertyBag) {
		var mById = {};
		var mCompVariants = {};

		// provide the function for fl-internal consumers reuse
		mCompVariants._getOrCreate = getOrCreate.bind(undefined, mCompVariants);
		mCompVariants._initialize = initialize.bind(undefined, mCompVariants, mById);

		// check for the existence due to test mocks
		if (mPropertyBag.storageResponse.changes.comp) {
			["variants", "changes", "defaultVariants", "standardVariants"].forEach(function (sSection) {
				buildSectionMap(mPropertyBag.storageResponse.changes.comp, sSection, mById, mCompVariants);
			});
		}

		return {
			map: mCompVariants,
			byId: mById
		};
	};
});
