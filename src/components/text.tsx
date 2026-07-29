import { Text as RNText, StyleSheet, type TextProps } from 'react-native';

import { type as typeTokens, type TextVariant } from '@/theme';

/**
 * The typography primitive. It applies one named type token (`title` / `body` /
 * `caption`) so the type scale is set in one place instead of re-imported at
 * every call site — the one component that ships in the foundation because the
 * tokens are painful to apply without it (ADR-0013).
 *
 * Type only: color stays a semantic role the consuming component supplies via
 * `style`, so this primitive carries no hex and works identically in both
 * themes.
 */
export function Text({
  variant = 'body',
  style,
  ...rest
}: TextProps & { variant?: TextVariant }) {
  return <RNText style={[styles[variant], style]} {...rest} />;
}

const styles = StyleSheet.create({
  title: typeTokens.title,
  body: typeTokens.body,
  caption: typeTokens.caption,
});
