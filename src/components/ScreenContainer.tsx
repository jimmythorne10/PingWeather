import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface ScreenContainerProps {
  children: React.ReactNode;
  /**
   * Maximum content width in px. On phones (width < maxWidth) this is a no-op
   * and content fills the screen as before. On tablets/iPad the content is
   * capped at maxWidth and horizontally centered so cards/forms/tables do not
   * stretch edge-to-edge. Defaults to 600 (the common tab-content cap).
   */
  maxWidth?: number;
  /** Optional extra style merged onto the inner (capped) view. */
  style?: StyleProp<ViewStyle>;
  /**
   * When true the outer flex:1 wrapper is omitted and only the centered inner
   * view is rendered — use inside a ScrollView's contentContainer where the
   * parent already controls flex/scroll behavior.
   */
  asContent?: boolean;
}

/**
 * Centers and caps the width of screen content for large displays (iPad).
 *
 * Why this exists: every screen in the app was authored for ~390px phones with
 * no maxWidth, so on an 820px+ iPad every card/form/table stretches edge to
 * edge and looks like a broken desktop page. Wrapping screen content in
 * <ScreenContainer> caps the width and centers it. Below the cap it is a
 * no-op, so phone layout is unchanged.
 *
 * Verification: layout-visual-only. Confirmed by operator on an iPad /
 * simulator — phone-width centered content with intentional side whitespace.
 * (jsdom component tests are flagged fraudulent for this project and are NOT
 * acceptable verification per CLAUDE.md Testing Contract.)
 *
 * Usage:
 *   // Plain screen:
 *   <ScreenContainer maxWidth={420}>{...}</ScreenContainer>
 *
 *   // Inside a ScrollView (let the ScrollView own scroll/flex):
 *   <ScrollView contentContainerStyle={styles.scroll}>
 *     <ScreenContainer asContent maxWidth={600}>{...}</ScreenContainer>
 *   </ScrollView>
 */
export function ScreenContainer({
  children,
  maxWidth = 600,
  style,
  asContent = false,
}: ScreenContainerProps) {
  const inner = (
    <View style={[styles.inner, { maxWidth }, style]}>{children}</View>
  );

  if (asContent) {
    return inner;
  }

  return <View style={styles.outer}>{inner}</View>;
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    width: '100%',
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
    flex: 1,
  },
});

export default ScreenContainer;
