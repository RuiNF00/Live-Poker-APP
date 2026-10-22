// Declared Age Range (Apple's age-range API for Texas, Utah and Louisiana, lib/age-gate): the app's
// entitlement. The App ID needs the "Declared Age Range" capability turned on too; automatic signing
// (-allowProvisioningUpdates, or EAS) registers it, which is a change to the Apple account.
const { withEntitlementsPlist } = require('expo/config-plugins');

const KEY = 'com.apple.developer.declared-age-range';

function addAgeRange(entitlements) {
  return { ...entitlements, [KEY]: true };
}

const withDeclaredAgeRange = (config) =>
  withEntitlementsPlist(config, (c) => {
    c.modResults = addAgeRange(c.modResults);
    return c;
  });

module.exports = withDeclaredAgeRange;
module.exports.addAgeRange = addAgeRange;
