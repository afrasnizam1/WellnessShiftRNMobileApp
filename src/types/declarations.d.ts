declare module 'react-native-vector-icons/Ionicons' {
  import * as React from 'react';
  import { TextProps } from 'react-native';

  export type IoniconName = string;
  export const glyphMap: Record<string, number>;

  export interface IconProps extends TextProps {
    name: IoniconName;
    size?: number;
    color?: string;
    allowFontScaling?: boolean;
  }

  export default class Icon extends React.Component<IconProps> {
    static glyphMap: Record<string, number>;
    static getRawGlyphMap(): Record<string, number>;
    static hasIcon(name: string): boolean;
    static loadFont(file?: string): Promise<void>;
  }
}
