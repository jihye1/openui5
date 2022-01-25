/*!
 * ${copyright}
 */

sap.ui.define([], function() {
	"use strict";

	/**
	 * Static collection of utility functions to handle timezone related conversions
	 *
	 * @author SAP SE
	 * @version ${version}
	 * @namespace
	 * @alias sap.ui.core.format.TimezoneUtil
	 * @private
	 * @ui5-restricted sap.ui.core.Configuration, sap.ui.core.format.DateFormat
	 */
	var TimezoneUtil = {};

	var sLocalTimezone = "";

	/**
	 * Uses the <code>Intl.DateTimeFormat</code> API to check if it can handle the given
	 * IANA timezone ID.
	 *
	 * @param {string} sTimezone The IANA timezone ID which is checked, e.g <code>"Europe/Berlin"</code>
	 * @returns {boolean} Whether the timezone is a valid IANA timezone ID
	 * @private
	 * @ui5-restricted sap.ui.core.Configuration, sap.ui.core.format.DateFormat
	 */
	TimezoneUtil.isValidTimezone = function(sTimezone) {
		if (!sTimezone) {
			return false;
		}

		try {
			new Intl.DateTimeFormat("en-US", {
				timeZone: sTimezone
			}).format();

			return true;
		} catch (oError) {
			return false;
		}
	};

	/**
	 * Converts a date to a specific timezone.
	 * The resulting date is local but reflects the given timezone such that the local Date methods
	 * can be used, e.g. Date#getHours().
	 *
	 * @example
	 * var oDate = new Date("2021-10-13T15:22:33Z"); (zulu)
	 * // Timezone difference -4 (DST) hours
	 * TimezoneUtil.convertToTimezone(oDate, "America/New_York");
	 * // 2021-10-13T11:22:33Z (zulu)
	 *
	 * @param {Date} oDate The date which should be converted.
	 * @param {string} sTargetTimezone The target IANA timezone ID, e.g <code>"Europe/Berlin"</code>
	 * @returns {Date} The new date in the target timezone.
	 * @private
	 * @ui5-restricted sap.ui.core.format.DateFormat
	 */
	TimezoneUtil.convertToTimezone = function(oDate, sTargetTimezone) {
		var oFormatParts = this._getParts(oDate, sTargetTimezone);
		return TimezoneUtil._getDateFromParts(oFormatParts);
	};

	/**
	 * Uses the <code>Intl.DateTimeFormat</code> API to convert a date to a specific timezone.
	 *
	 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatToParts
	 * @param {Date} oDate The date which should be converted.
	 * @param {string} sTargetTimezone The target IANA timezone ID, e.g <code>"Europe/Berlin"</code>
	 * @returns {{
	 *     month: string,
	 *     day: string,
	 *     year: string,
	 *     hour: string,
	 *     minute: string,
	 *     second: string,
	 *     era: string,
	 *     fractionalSecond: string,
	 *     timeZoneName: string
	 * }} An object containing the date and time fields considering the target timezone.
	 * @private
	 */
	TimezoneUtil._getParts = function(oDate, sTargetTimezone) {
		var options = {
			hourCycle: "h23",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			fractionalSecondDigits: 3,
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			timeZone: sTargetTimezone,
			timeZoneName: 'short',
			era: 'short'
		};

		var oIntlDate = new Intl.DateTimeFormat("en-US", options);
		// clone the date object before passing it to the Intl API, to ensure that no
		// UniversalDate gets passed to it
		var oParts = oIntlDate.formatToParts(new Date(oDate.getTime()));
		var oDateParts = Object.create(null);
		for (var sKey in oParts) {
			var oPart = oParts[sKey];
			if (oPart.type !== "literal") {
				if (oPart.type === "month") {
					oPart.value--;
				}
				oDateParts[oPart.type] = oPart.value;
			}
		}
		return oDateParts;
	};

	/**
	 * Creates a Date from the provided date parts.
	 *
	 * @param {object} oParts Separated date and time fields as object, see {@link #_getParts}.
	 * @returns {Date} Returns the date object created from the provided parts.
	 * @private
	 */
	TimezoneUtil._getDateFromParts = function(oParts) {
		var oDate = new Date();

		var iUTCYear = oParts.year;
		if (oParts.era === "BC") {
			// there is no year 0
			// either year 1 AD or year 1 BC
			iUTCYear = (iUTCYear * -1) + 1;
		}
		oDate.setUTCFullYear(iUTCYear);
		oDate.setUTCMonth(oParts.month || 0);
		oDate.setUTCDate(oParts.day || 1);
		oDate.setUTCHours(oParts.hour || 0);
		oDate.setUTCMinutes(oParts.minute || 0);
		oDate.setUTCSeconds(oParts.second || 0);
		oDate.setUTCMilliseconds(oParts.fractionalSecond || 0);

		return oDate;
	};

	/**
	 * Gets the offset to UTC in seconds for a given date in the timezone specified.
	 *
	 * For non-unique points in time, the daylight saving time takes precedence over the standard
	 * time shortly after the switch back (e.g. clock gets set back 1 hour, duplicate hour).
	 *
	 * @example
	 * var oDate = new Date("2021-10-13T13:22:33Z");
	 * TimezoneUtil.calculateOffset(oDate, "America/New_York");
	 * // => +14400 seconds (4 * 60 * 60 seconds)
	 *
	 * TimezoneUtil.calculateOffset(oDate, "Europe/Berlin");
	 * // => -7200 seconds (-2 * 60 * 60 seconds)
	 *
	 * // daylight saving time (2018 Sun, 25 Mar, 02:00	CET → CEST	+1 hour (DST start)	UTC+2h)
	 * TimezoneUtil.calculateOffset(new Date("2018-03-25T00:00:00Z"), "Europe/Berlin");
	 * // => -3600 seconds (-1 * 60 * 60 seconds)
	 *
	 * TimezoneUtil.calculateOffset(new Date("2018-03-25T03:00:00Z"), "Europe/Berlin");
	 * // => -7200 seconds (-2 * 60 * 60 seconds)
	 *
	 * var oHistoricalDate = new Date("1800-10-13T13:22:33Z");
	 * TimezoneUtil.calculateOffset(oHistoricalDate, "Europe/Berlin");
	 * // => -3208 seconds (-3208 seconds)
	 *
	 * @param {Date} oDate The date in the timezone used to calculate the offset to UTC.
	 * @param {string} sTimezoneSource The source IANA timezone ID, e.g <code>"Europe/Berlin"</code>
	 * @returns {number} The difference to UTC between the date in the timezone.
	 * @private
	 * @ui5-restricted sap.ui.core.format.DateFormat
	 */
	TimezoneUtil.calculateOffset = function(oDate, sTimezoneSource) {
		var oPartsTarget = this._getParts(oDate, sTimezoneSource);
		var oDateInTimezone = this._getDateFromParts(oPartsTarget);

		var iDiff = oDate.getTime() - oDateInTimezone.getTime();

		// to get the correct summer/wintertime (daylight saving time) handling use the source date (apply the diff)
		var oDateSource = new Date(oDate.getTime() + iDiff);

		var oPartsSource = this._getParts(oDateSource, sTimezoneSource);
		var oDateTarget = this._getDateFromParts(oPartsSource);

		return (oDateSource.getTime() - oDateTarget.getTime()) / 1000;
	};

	/**
	 * Retrieves the browser's local IANA timezone ID.
	 *
	 * @returns {string} The local IANA timezone ID of the browser, e.g <code>"Europe/Berlin"</code>
	 * @private
	 * @ui5-restricted sap.ui.core.Configuration
	 */
	TimezoneUtil.getLocalTimezone = function() {
		if (sLocalTimezone) {
			return sLocalTimezone;
		}
		sLocalTimezone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
		return sLocalTimezone;
	};

	return TimezoneUtil;
});