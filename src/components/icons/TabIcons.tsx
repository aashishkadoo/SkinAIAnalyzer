import Svg, {
  Path, Circle, Rect, Defs, LinearGradient, Stop, G,
} from 'react-native-svg';

type IconProps = {
  size?: number;
  focused?: boolean;
};

// Shared gradient stops — pink → magenta → violet (techy)
function Gradient({ id }: { id: string }) {
  return (
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FF6FB1" stopOpacity="1" />
        <Stop offset="0.5" stopColor="#E84A8A" stopOpacity="1" />
        <Stop offset="1" stopColor="#9B6BF2" stopOpacity="1" />
      </LinearGradient>
    </Defs>
  );
}

export function HomeIcon({ size = 24, focused }: IconProps) {
  const id = 'homeGrad';
  const stroke = focused ? `url(#${id})` : '#A896A0';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Gradient id={id} />
      {/* soft fill for depth */}
      <Path
        d="M4 10.5L12 4L20 10.5V19C20 19.55 19.55 20 19 20H15V15C15 14.45 14.55 14 14 14H10C9.45 14 9 14.45 9 15V20H5C4.45 20 4 19.55 4 19V10.5Z"
        fill={`url(#${id})`}
        fillOpacity={focused ? 0.25 : 0.08}
      />
      {/* main stroke */}
      <Path
        d="M4 10.5L12 4L20 10.5V19C20 19.55 19.55 20 19 20H15V15C15 14.45 14.55 14 14 14H10C9.45 14 9 14.45 9 15V20H5C4.45 20 4 19.55 4 19V10.5Z"
        stroke={stroke}
        strokeWidth={focused ? 2 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* accent dot */}
      {focused && <Circle cx="12" cy="9" r="1.2" fill={`url(#${id})`} />}
    </Svg>
  );
}

export function ShopIcon({ size = 24, focused }: IconProps) {
  const id = 'shopGrad';
  const stroke = focused ? `url(#${id})` : '#A896A0';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Gradient id={id} />
      <Path
        d="M5.5 3H18.5L20 7V19C20 19.55 19.55 20 19 20H5C4.45 20 4 19.55 4 19V7L5.5 3Z"
        fill={`url(#${id})`}
        fillOpacity={focused ? 0.25 : 0.08}
      />
      <Path
        d="M5.5 3H18.5L20 7V19C20 19.55 19.55 20 19 20H5C4.45 20 4 19.55 4 19V7L5.5 3Z"
        stroke={stroke}
        strokeWidth={focused ? 2 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 7H20"
        stroke={stroke}
        strokeWidth={focused ? 2 : 1.6}
        strokeLinecap="round"
      />
      <Path
        d="M9 11C9 12.66 10.34 14 12 14C13.66 14 15 12.66 15 11"
        stroke={stroke}
        strokeWidth={focused ? 2 : 1.6}
        strokeLinecap="round"
      />
      {focused && <Circle cx="12" cy="9.5" r="0.9" fill={`url(#${id})`} />}
    </Svg>
  );
}

export function CameraIcon({ size = 24, focused }: IconProps) {
  const id = 'camGrad';
  const stroke = focused ? `url(#${id})` : '#A896A0';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Gradient id={id} />
      <Path
        d="M3 9C3 8.45 3.45 8 4 8H7L8.5 6H15.5L17 8H20C20.55 8 21 8.45 21 9V19C21 19.55 20.55 20 20 20H4C3.45 20 3 19.55 3 19V9Z"
        fill={`url(#${id})`}
        fillOpacity={focused ? 0.25 : 0.08}
      />
      <Path
        d="M3 9C3 8.45 3.45 8 4 8H7L8.5 6H15.5L17 8H20C20.55 8 21 8.45 21 9V19C21 19.55 20.55 20 20 20H4C3.45 20 3 19.55 3 19V9Z"
        stroke={stroke}
        strokeWidth={focused ? 2 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle
        cx="12"
        cy="13.5"
        r="3.2"
        stroke={stroke}
        strokeWidth={focused ? 2 : 1.6}
        fill="none"
      />
      <Circle
        cx="12"
        cy="13.5"
        r="1.3"
        fill={`url(#${id})`}
        fillOpacity={focused ? 0.9 : 0.4}
      />
      {focused && <Circle cx="18.5" cy="10" r="0.9" fill={`url(#${id})`} />}
    </Svg>
  );
}

export function SettingsIcon({ size = 24, focused }: IconProps) {
  const id = 'setGrad';
  const stroke = focused ? `url(#${id})` : '#A896A0';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Gradient id={id} />
      <Circle
        cx="12"
        cy="12"
        r="9"
        fill={`url(#${id})`}
        fillOpacity={focused ? 0.25 : 0.08}
      />
      <Circle
        cx="12"
        cy="12"
        r="9"
        stroke={stroke}
        strokeWidth={focused ? 2 : 1.6}
        fill="none"
      />
      <Circle
        cx="12"
        cy="12"
        r="3.2"
        stroke={stroke}
        strokeWidth={focused ? 2 : 1.6}
        fill="none"
      />
      <Circle
        cx="12"
        cy="12"
        r="1.2"
        fill={`url(#${id})`}
        fillOpacity={focused ? 0.9 : 0.4}
      />
      {/* techy tick marks around the outer ring */}
      <Rect x="11.3" y="1.5" width="1.4" height="2" rx="0.7" fill={`url(#${id})`} fillOpacity={0.85} />
      <Rect x="11.3" y="20.5" width="1.4" height="2" rx="0.7" fill={`url(#${id})`} fillOpacity={0.85} />
      <Rect x="1.5" y="11.3" width="2" height="1.4" rx="0.7" fill={`url(#${id})`} fillOpacity={0.85} />
      <Rect x="20.5" y="11.3" width="2" height="1.4" rx="0.7" fill={`url(#${id})`} fillOpacity={0.85} />
    </Svg>
  );
}