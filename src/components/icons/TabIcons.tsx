import Svg, { Path, Circle } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
  focused?: boolean;
};

export function HomeIcon({ size = 24, color = '#000', focused }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3L21 10.5V20C21 20.6 20.6 21 20 21H15V15H9V21H4C3.4 21 3 20.6 3 20V10.5Z"
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.1 : 0}
      />
    </Svg>
  );
}

export function ShopIcon({ size = 24, color = '#000', focused }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2L3 6V20C3 20.6 3.4 21 4 21H20C20.6 21 21 20.6 21 20V6L18 2H6Z"
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.1 : 0}
      />
      <Path
        d="M3 6H21"
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.8}
        strokeLinecap="round"
      />
      <Path
        d="M16 10C16 12.2 14.2 14 12 14C9.8 14 8 12.2 8 10"
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CameraIcon({ size = 24, color = '#000', focused }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8C3 7.4 3.4 7 4 7H7L8.5 5H15.5L17 7H20C20.6 7 21 7.4 21 8V19C21 19.6 20.6 20 20 20H4C3.4 20 3 19.6 3 19V8Z"
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.1 : 0}
      />
      <Circle
        cx="12"
        cy="13.5"
        r="3.5"
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.8}
        fill="none"
      />
    </Svg>
  );
}

export function SettingsIcon({ size = 24, color = '#000', focused }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="3"
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.8}
        fill={focused ? color : 'none'}
        fillOpacity={focused ? 0.1 : 0}
      />
      <Path
        d="M19.4 15C19.1 15.7 19.2 16.5 19.7 17.1L19.8 17.2C20.2 17.6 20.2 18.3 19.8 18.7L18.7 19.8C18.3 20.2 17.6 20.2 17.2 19.8L17.1 19.7C16.5 19.2 15.7 19.1 15 19.4C14.3 19.7 13.8 20.4 13.8 21.2V21.4C13.8 21.9 13.4 22.4 12.8 22.4H11.2C10.6 22.4 10.2 21.9 10.2 21.4V21.2C10.2 20.4 9.7 19.7 9 19.4C8.3 19.1 7.5 19.2 6.9 19.7L6.8 19.8C6.4 20.2 5.7 20.2 5.3 19.8L4.2 18.7C3.8 18.3 3.8 17.6 4.2 17.2L4.3 17.1C4.8 16.5 4.9 15.7 4.6 15C4.3 14.3 3.6 13.8 2.8 13.8H2.6C2.1 13.8 1.6 13.4 1.6 12.8V11.2C1.6 10.6 2.1 10.2 2.6 10.2H2.8C3.6 10.2 4.3 9.7 4.6 9C4.9 8.3 4.8 7.5 4.3 6.9L4.2 6.8C3.8 6.4 3.8 5.7 4.2 5.3L5.3 4.2C5.7 3.8 6.4 3.8 6.8 4.2L6.9 4.3C7.5 4.8 8.3 4.9 9 4.6C9.7 4.3 10.2 3.6 10.2 2.8V2.6C10.2 2.1 10.6 1.6 11.2 1.6H12.8C13.4 1.6 13.8 2.1 13.8 2.6V2.8C13.8 3.6 14.3 4.3 15 4.6C15.7 4.9 16.5 4.8 17.1 4.3L17.2 4.2C17.6 3.8 18.3 3.8 18.7 4.2L19.8 5.3C20.2 5.7 20.2 6.4 19.8 6.8L19.7 6.9C19.2 7.5 19.1 8.3 19.4 9C19.7 9.7 20.4 10.2 21.2 10.2H21.4C21.9 10.2 22.4 10.6 22.4 11.2V12.8C22.4 13.4 21.9 13.8 21.4 13.8H21.2C20.4 13.8 19.7 14.3 19.4 15Z"
        stroke={color}
        strokeWidth={focused ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}