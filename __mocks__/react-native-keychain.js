const store = {};

const serviceKey = opts => (opts && opts.service) || 'default';

export const ACCESSIBLE = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
};

export const SECURITY_LEVEL = {
  SECURE_HARDWARE: 'secureHardware',
  ANY: 'any',
};

export const setGenericPassword = jest.fn(async (username, password, opts) => {
  store[serviceKey(opts)] = { username, password };
  return true;
});

export const getGenericPassword = jest.fn(async opts => {
  const key = serviceKey(opts);
  return key in store ? store[key] : false;
});

export const resetGenericPassword = jest.fn(async opts => {
  delete store[serviceKey(opts)];
  return true;
});
