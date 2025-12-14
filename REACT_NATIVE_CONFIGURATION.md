# Configuration React Native pour Deep Linking

## 📋 Configuration du Deep Linking avec React Navigation

### Étape 1 : Vérifier les dépendances

Assurez-vous que React Navigation est installé :

```bash
npm install @react-navigation/native
npm install react-native-screens react-native-safe-area-context
```

### Étape 2 : Configurer le linking

Dans votre fichier principal de navigation (App.js, navigation/index.js, etc.) :

```javascript
import { NavigationContainer } from '@react-navigation/native';

const linking = {
  prefixes: ['https://wintermateapp.com', 'wintermate://'],
  config: {
    screens: {
      Profile: {
        path: '/profile/:userId',
        parse: {
          userId: (userId) => userId,
        },
      },
      // Autres écrans de votre app
    },
  },
};

function App() {
  return (
    <NavigationContainer linking={linking}>
      {/* Votre navigation */}
    </NavigationContainer>
  );
}

export default App;
```

### Étape 3 : Modifier l'écran Profile pour récupérer userId

```javascript
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';

function ProfileScreen() {
  const route = useRoute();
  const { userId } = route.params || {};
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadProfile(userId);
    }
  }, [userId]);

  const loadProfile = async (id) => {
    try {
      setLoading(true);
      // Votre logique de chargement du profil
      const userProfile = await fetchUserProfile(id);
      setProfile(userProfile);
    } catch (error) {
      console.error('Erreur chargement profil:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator />;
  }

  return (
    <View>
      <Text>Profil de {userId}</Text>
      {/* Reste de votre UI */}
    </View>
  );
}

export default ProfileScreen;
```

### Étape 4 : Gérer les deep links au démarrage

```javascript
import { useEffect } from 'react';
import { Linking } from 'react-native';

function App() {
  useEffect(() => {
    // Gérer le lien initial (app fermée)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('App ouverte avec URL:', url);
        // React Navigation gère automatiquement la navigation
      }
    });

    // Gérer les liens entrants (app en arrière-plan ou ouverte)
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('URL reçue:', url);
      // React Navigation gère automatiquement la navigation
    });

    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer linking={linking}>
      {/* ... */}
    </NavigationContainer>
  );
}
```

## 📱 Configuration spécifique iOS

Dans `ios/WinterMate/AppDelegate.mm` (ou AppDelegate.m), ajoutez :

```objective-c
// Pour React Native 0.60+
- (BOOL)application:(UIApplication *)application
   openURL:(NSURL *)url
   options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  return [RCTLinkingManager application:application openURL:url options:options];
}

- (BOOL)application:(UIApplication *)application continueUserActivity:(nonnull NSUserActivity *)userActivity
 restorationHandler:(nonnull void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
  return [RCTLinkingManager application:application
                   continueUserActivity:userActivity
                     restorationHandler:restorationHandler];
}
```

## 🤖 Configuration spécifique Android

Le deep linking Android est géré par l'intent-filter dans AndroidManifest.xml (déjà configuré).

Assurez-vous que MainActivity.java gère correctement les intents :

```java
package com.wintermate.app;

import android.content.Intent;
import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  
  @Override
  protected String getMainComponentName() {
    return "WinterMate";
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
  }
}
```

## ✅ Tests

### Test iOS :
```bash
xcrun simctl openurl booted "https://wintermateapp.com/profile/test123"
```

### Test Android :
```bash
adb shell am start -a android.intent.action.VIEW -d "https://wintermateapp.com/profile/test123"
```

Les deux commandes devraient ouvrir l'app et naviguer vers l'écran Profile avec userId="test123".
