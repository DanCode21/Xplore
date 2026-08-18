import './src/textDecoderPolyfill'; // must precede h3-js (imported via App)
import './src/locationTask'; // defines the background task before events arrive
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
