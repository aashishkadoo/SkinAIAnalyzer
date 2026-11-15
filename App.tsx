import 'react-native-url-polyfill/auto'; // must be the FIRST import
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return <RootNavigator />;
}