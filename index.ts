import './src/lib/themeEngine';      // first: it must wrap React's JSX before any screen is created (dark mode)
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
