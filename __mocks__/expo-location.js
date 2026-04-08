module.exports = {
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 30.2672, longitude: -97.7431 },
  })),
  Accuracy: { Balanced: 3, High: 4, Highest: 5 },
};
