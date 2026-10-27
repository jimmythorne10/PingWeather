// Minimal react-native stub for logic tests (node environment, no UI)
module.exports = {
  Platform: { OS: 'android', select: (obj) => obj.android ?? obj.default },
  StyleSheet: {
    create: (styles) => styles,
    flatten: (styles) => styles,
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  Switch: 'Switch',
  Alert: { alert: jest.fn() },
  Modal: 'Modal',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Image: 'Image',
  FlatList: 'FlatList',
};

// Pre-existing gap: WalkthroughModal has called useWindowDimensions since before
// the design-system migration, and it was never mocked, so every suite that
// renders a screen mounting that modal threw
// "(0, _reactNative.useWindowDimensions) is not a function".
module.exports.useWindowDimensions = () => ({ width: 390, height: 844, scale: 2, fontScale: 1 });
