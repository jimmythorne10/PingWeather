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
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Image: 'Image',
  FlatList: 'FlatList',
};
