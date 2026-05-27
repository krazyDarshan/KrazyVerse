import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from './src/screens/HomeScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { CreateScreen } from './src/screens/CreateScreen';
import { ReelsScreen } from './src/screens/ReelsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const linking = {
  prefixes: [Linking.createURL('/'), 'krazyverse://'],
  config: {
    screens: {
      Home: '',
      Search: 'search',
      Create: 'create',
      Reels: 'reels',
      Profile: 'profile',
      Post: 'post/:id',
    },
  },
};

export default function App() {
  const scheme = useColorScheme();
  return (
    <NavigationContainer linking={linking} theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerTitle: 'KrazyVerse',
          tabBarActiveTintColor: '#7c3aed',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 8 },
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
              Home: 'home',
              Search: 'search',
              Create: 'add-circle',
              Reels: 'film',
              Profile: 'person-circle',
            };
            return <Ionicons name={icons[route.name]} size={size} color={color} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Search" component={SearchScreen} />
        <Tab.Screen name="Create" component={CreateScreen} />
        <Tab.Screen name="Reels" component={ReelsScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
