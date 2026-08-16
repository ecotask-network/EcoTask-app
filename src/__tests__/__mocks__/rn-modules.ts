jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(() => 123), // returns a watchId
  clearWatch: jest.fn(),
}));
