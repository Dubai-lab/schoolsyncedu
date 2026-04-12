Mobile App Development Skill
You are an expert mobile developer specializing in React Native with Expo and mobile-first web (PWA). Always target both iOS and Android unless told otherwise. Write clean, performant, cross-platform code.

🎯 First: Identify the Mobile Target

Platform: iOS + Android (React Native/Expo)? Web only (PWA)? All three?
Distribution: App Store/Play Store? Internal (Expo Go / TestFlight)? Web only?
Native features needed? Camera, GPS, biometrics, notifications, contacts?
Offline support? What data must work without internet?
Existing backend? Or need to design one too?


⚡ Expo Project Setup (Recommended)
bash# Create new Expo app with TypeScript
npx create-expo-app@latest MyApp --template

# Key packages for a full app
npx expo install \
  expo-router \
  expo-secure-store \
  expo-camera \
  expo-location \
  expo-notifications \
  expo-local-authentication \
  expo-image-picker \
  @expo/vector-icons \
  react-native-mmkv \
  @tanstack/react-query \
  zustand \
  nativewind \
  zod
app.json / app.config.ts
typescriptexport default ({ config }) => ({
  ...config,
  name: "MyApp",
  slug: "myapp",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "myapp",           // ← deep link scheme
  splash: { image: "./assets/splash.png", resizeMode: "contain" },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.company.myapp",
    infoPlist: {
      NSCameraUsageDescription: "Used to take photos",
      NSLocationWhenInUseUsageDescription: "Used to find nearby items",
    },
  },
  android: {
    package: "com.company.myapp",
    permissions: ["CAMERA", "ACCESS_FINE_LOCATION"],
  },
  plugins: [
    "expo-router",
    ["expo-camera", { cameraPermission: "Allow $(PRODUCT_NAME) to access your camera." }],
    ["expo-notifications", { /* push config */ }],
  ],
});

📱 Navigation (Expo Router — File-Based)
app/
├── _layout.tsx           ← Root layout (providers, fonts)
├── (auth)/
│   ├── _layout.tsx       ← Auth layout (redirect if logged in)
│   ├── login.tsx
│   └── register.tsx
├── (tabs)/
│   ├── _layout.tsx       ← Tab bar config
│   ├── index.tsx         ← Home tab
│   ├── explore.tsx
│   └── profile.tsx
├── post/[id].tsx         ← Dynamic route
└── modal.tsx             ← Modal screen
Root Layout
tsx// app/_layout.tsx
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';

const queryClient = new QueryClient();

export default function RootLayout() {
  const [loaded] = useFonts({ 'Inter': require('../assets/fonts/Inter.ttf') });
  if (!loaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </QueryClientProvider>
  );
}
Tab Layout
tsx// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#6366f1' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}

🔐 Auth & Secure Storage
typescript// lib/auth.ts
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

export const authStorage = {
  save: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  remove: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

// Biometric auth
import * as LocalAuthentication from 'expo-local-authentication';

export const biometricAuth = async () => {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to continue',
    fallbackLabel: 'Use Passcode',
  });
  
  return result.success;
};
Zustand Auth Store
typescript// store/auth.ts
import { create } from 'zustand';
import { authStorage } from '@/lib/auth';
import { router } from 'expo-router';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  
  initialize: async () => {
    const token = await authStorage.get();
    if (token) {
      // Validate token, fetch user
      const user = await fetchCurrentUser(token);
      set({ token, user });
    }
  },
  
  login: async (credentials) => {
    const { token, user } = await apiLogin(credentials);
    await authStorage.save(token);
    set({ token, user });
    router.replace('/(tabs)');
  },
  
  logout: async () => {
    await authStorage.remove();
    set({ token: null, user: null });
    router.replace('/(auth)/login');
  },
}));

📍 Native Device APIs
Camera
tsximport { CameraView, useCameraPermissions } from 'expo-camera';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  if (!permission?.granted) {
    return (
      <View>
        <Text>Camera permission required</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  const takePicture = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
    // Upload photo.uri
  };

  return (
    <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
      <TouchableOpacity onPress={takePicture} style={styles.captureBtn} />
    </CameraView>
  );
}
Location
typescriptimport * as Location from 'expo-location';

export const getCurrentLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('Location permission denied');
  
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  
  return { lat: location.coords.latitude, lng: location.coords.longitude };
};

// Watch position
const subscription = await Location.watchPositionAsync(
  { accuracy: Location.Accuracy.High, timeInterval: 5000 },
  (location) => updateUserLocation(location.coords)
);
// Cleanup: subscription.remove()
Push Notifications
typescript// lib/notifications.ts
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const registerForPushNotifications = async (): Promise<string | null> => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;
  
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });
  
  return token.data; // Save this to your backend!
};

// Listen to notifications
useEffect(() => {
  const sub = Notifications.addNotificationReceivedListener(notification => {
    console.log('Received:', notification);
  });
  const sub2 = Notifications.addNotificationResponseReceivedListener(response => {
    // User tapped notification — navigate
    const data = response.notification.request.content.data;
    router.push(data.route);
  });
  return () => { sub.remove(); sub2.remove(); };
}, []);

💾 Offline Storage
MMKV (fast key-value)
typescriptimport { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'app-storage' });

// Simple usage
storage.set('theme', 'dark');
const theme = storage.getString('theme');

// Zustand persist middleware with MMKV
import { createJSONStorage, persist } from 'zustand/middleware';

const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

const useStore = create(persist(storeConfig, {
  name: 'app-store',
  storage: createJSONStorage(() => mmkvStorage),
}));
SQLite (structured offline data)
typescriptimport * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('myapp.db');

// Initialize schema
db.execSync(`
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    synced INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Query
const posts = db.getAllSync<Post>('SELECT * FROM posts WHERE synced = 0');

// Insert
db.runSync('INSERT INTO posts (id, title, content) VALUES (?, ?, ?)', 
  [uuid(), title, content]);

🔗 Deep Linking
typescript// app.config.ts - scheme: "myapp"
// Links: myapp://post/123  OR  https://myapp.com/post/123 (universal links)

// app/post/[id].tsx — automatically handles deep links via Expo Router

// Programmatic navigation to deep link
import * as Linking from 'expo-linking';
Linking.openURL('myapp://profile');

// Handle incoming links
const url = await Linking.getInitialURL();
const { path, queryParams } = Linking.parse(url ?? '');

🌐 PWA (Progressive Web App)
next.config.js
javascriptconst withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

module.exports = withPWA({ /* next config */ });
public/manifest.json
json{
  "name": "My App",
  "short_name": "MyApp",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#6366f1",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
  ]
}

🚀 Building & Deployment
EAS Build (App Store / Play Store)
bash# Install EAS CLI
npm install -g eas-cli
eas login

# Configure
eas build:configure

# Build for stores
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit
eas submit --platform ios
eas submit --platform android
eas.json
json{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "ios": { "simulator": false },
      "android": { "buildType": "app-bundle" }
    }
  }
}

📐 Styling with NativeWind
tsx// NativeWind — Tailwind CSS for React Native
import { View, Text, TouchableOpacity } from 'react-native';

export function Button({ title, onPress, variant = 'primary' }) {
  return (
    <TouchableOpacity
      className={`px-6 py-3 rounded-xl ${
        variant === 'primary' ? 'bg-indigo-600' : 'bg-gray-100'
      }`}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text className={`font-semibold text-center ${
        variant === 'primary' ? 'text-white' : 'text-gray-900'
      }`}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

✅ Mobile Quality Checklist

 Handles keyboard covering inputs (KeyboardAvoidingView)
 Safe area insets applied (SafeAreaView / useSafeAreaInsets)
 Pull-to-refresh on lists
 Empty and loading states for all screens
 Offline fallback UI
 Permissions denied gracefully (show explanation + settings link)
 Large text / accessibility labels (accessibilityLabel)
 Works in dark mode
 Tested on both iOS and Android
 Splash screen and app icon configured
 App store metadata (screenshots, description) ready