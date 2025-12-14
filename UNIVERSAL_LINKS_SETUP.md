# Configuration Universal Links et App Links pour Winter Mate

Ce document décrit les étapes nécessaires pour finaliser la configuration des Universal Links (iOS) et App Links (Android).

## ✅ Fichiers Next.js créés

Les fichiers suivants ont été créés dans le projet Next.js :

1. `src/app/.well-known/apple-app-site-association/route.js` - Route pour iOS
2. `src/app/.well-known/assetlinks.json/route.js` - Route pour Android
3. `src/app/profile/[userId]/page.js` - Page de redirection

## 📱 Configuration iOS (Xcode)

### Étapes à suivre :

1. **Récupérer le Team ID**
   - Aller sur https://developer.apple.com/account
   - Connexion avec le compte développeur Apple
   - Le Team ID se trouve dans la section "Membership"
   - Format : 10 caractères alphanumériques (ex: ABC123DEF4)

2. **Mettre à jour le fichier apple-app-site-association**
   - Ouvrir `src/app/.well-known/apple-app-site-association/route.js`
   - Remplacer `TEAM_ID` par le vrai Team ID
   - Exemple : `"appID": "ABC123DEF4.com.wintermate.app"`

3. **Configurer Xcode**
   - Ouvrir le projet iOS dans Xcode
   - Sélectionner le target de l'application
   - Aller dans l'onglet "Signing & Capabilities"
   - Cliquer sur "+ Capability"
   - Ajouter "Associated Domains"
   - Ajouter le domaine : `applinks:wintermateapp.com`
   - ⚠️ Format exact (sans https://) : `applinks:wintermateapp.com`

4. **Vérifier le Bundle Identifier**
   - Dans Xcode, vérifier que le Bundle Identifier est bien `com.wintermate.app`
   - S'il est différent, mettre à jour le fichier apple-app-site-association en conséquence

### Fichier à ajouter/modifier dans le projet iOS :

Le fichier `ios/[NomApp]/[NomApp].entitlements` devrait contenir :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.developer.associated-domains</key>
    <array>
        <string>applinks:wintermateapp.com</string>
    </array>
</dict>
</plist>
```

## 🤖 Configuration Android

### Étapes à suivre :

1. **Récupérer les empreintes SHA-256**

   **Pour le certificat de debug :**
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

   **Pour le certificat de production :**
   ```bash
   keytool -list -v -keystore /chemin/vers/production.keystore -alias votre-alias
   ```

   - Copier la valeur de la ligne "SHA256:" (sans les deux-points)
   - Exemple : `AB:CD:EF:12:34...` devient `ABCDEF1234...`

2. **Mettre à jour le fichier assetlinks.json**
   - Ouvrir `src/app/.well-known/assetlinks.json/route.js`
   - Remplacer `SHA256_DE_LA_CLE_DE_DEBUG` par l'empreinte de debug
   - Remplacer `SHA256_DE_LA_CLE_DE_PRODUCTION` par l'empreinte de production
   - Vérifier que `package_name` correspond à l'applicationId dans `build.gradle`

3. **Modifier AndroidManifest.xml**
   - Ouvrir `android/app/src/main/AndroidManifest.xml`
   - Ajouter l'intent-filter suivant dans l'activité principale :

```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTask">
    
    <!-- Autres intent-filters existants -->
    
    <!-- App Links pour Winter Mate -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="https"
            android:host="wintermateapp.com"
            android:pathPrefix="/profile" />
    </intent-filter>
</activity>
```

⚠️ **Important** : L'attribut `android:autoVerify="true"` est OBLIGATOIRE pour activer la vérification automatique.

### Vérification après installation :

```bash
adb shell pm get-app-links com.wintermate.app
```

Cette commande affichera l'état de la vérification des App Links.

## ⚛️ Configuration React Native

### Étapes à suivre :

1. **Installer/Configurer React Navigation (si pas déjà fait)**
   ```bash
   npm install @react-navigation/native
   ```

2. **Configurer le deep linking**

   Dans votre fichier de configuration de navigation (ex: `App.js` ou `navigation/index.js`) :

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
      // Autres écrans...
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
```

3. **Modifier l'écran Profile pour gérer le paramètre**

```javascript
import { useRoute } from '@react-navigation/native';

function ProfileScreen() {
  const route = useRoute();
  const { userId } = route.params || {};

  // Charger le profil avec userId
  useEffect(() => {
    if (userId) {
      loadUserProfile(userId);
    }
  }, [userId]);

  // Reste du composant...
}
```

4. **Gérer les deep links au démarrage de l'app**

   React Navigation gère automatiquement les deep links, mais vous pouvez ajouter une logique personnalisée :

```javascript
import { Linking } from 'react-native';

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
```

## 🔄 Mise à jour de la page de redirection

### Configuration des URLs des stores

Ouvrir `src/app/profile/[userId]/page.js` et remplacer :

- `APP_ID` par l'ID réel de l'app sur l'App Store
  - Pour trouver l'ID : aller sur App Store Connect > Votre app > Informations sur l'app > ID Apple
  - Exemple : `https://apps.apple.com/app/id123456789`

- Vérifier que l'URL Play Store est correcte :
  - Format : `https://play.google.com/store/apps/details?id=com.wintermate.app`
  - Le `id` doit correspondre au `package_name` Android

## ✅ Checklist de validation

### Avant le déploiement :

- [ ] Team ID Apple mis à jour dans apple-app-site-association
- [ ] Bundle Identifier iOS vérifié
- [ ] Associated Domains configuré dans Xcode
- [ ] Empreintes SHA-256 Android récupérées (debug + production)
- [ ] assetlinks.json mis à jour avec les empreintes
- [ ] AndroidManifest.xml modifié avec intent-filter + autoVerify
- [ ] Deep linking configuré dans React Native
- [ ] URLs des stores mises à jour dans page.js

### Après le déploiement sur Vercel :

1. **Vérifier les fichiers .well-known**
   ```bash
   curl https://wintermateapp.com/.well-known/apple-app-site-association
   curl https://wintermateapp.com/.well-known/assetlinks.json
   ```

2. **Vérifier les headers**
   ```bash
   curl -I https://wintermateapp.com/.well-known/apple-app-site-association
   ```
   Doit retourner : `Content-Type: application/json`

3. **Tester la redirection**
   - Ouvrir `https://wintermateapp.com/profile/test123` dans un navigateur
   - Doit rediriger vers l'App Store (iOS) ou Play Store (Android)

### Tests iOS :

- [ ] App installée : cliquer sur un lien depuis Messages/Safari → app s'ouvre
- [ ] App non installée : cliquer sur un lien → redirige vers App Store
- [ ] Vérifier dans Réglages iOS > [App] > Universal Links
- [ ] Tester depuis différentes apps (Messages, Mail, Safari)

### Tests Android :

- [ ] App installée : cliquer sur un lien depuis Chrome/Gmail → app s'ouvre
- [ ] App non installée : cliquer sur un lien → redirige vers Play Store
- [ ] Vérifier avec : `adb shell pm get-app-links com.wintermate.app`
- [ ] Tester depuis différentes apps (Chrome, Gmail, Messages)

### Tests avec simulateur/émulateur :

**iOS Simulator :**
```bash
xcrun simctl openurl booted "https://wintermateapp.com/profile/test123"
```

**Android Emulator :**
```bash
adb shell am start -a android.intent.action.VIEW -d "https://wintermateapp.com/profile/test123"
```

## 🐛 Dépannage

### iOS

**Problème : Universal Link ne fonctionne pas**
- Vérifier que le fichier apple-app-site-association est accessible en HTTPS
- Vérifier qu'il n'y a pas de redirection HTTP
- Désinstaller/réinstaller l'app pour forcer une nouvelle vérification
- Attendre jusqu'à 24h pour la propagation Apple
- Vérifier les logs Xcode lors du clic sur un lien

**Problème : Le fichier n'est pas valide**
- Vérifier le format du Team ID (10 caractères)
- Vérifier que le Bundle Identifier correspond
- Vérifier que Associated Domains est bien configuré dans Xcode

### Android

**Problème : App Links ne fonctionnent pas**
- Vérifier que `android:autoVerify="true"` est présent
- Vérifier les empreintes SHA-256 (avec ET sans deux-points)
- Vérifier que le package_name correspond exactement
- Attendre quelques minutes après l'installation pour la vérification
- Vérifier avec : `adb shell pm get-app-links com.wintermate.app`

**Problème : Vérification échoue**
- Vérifier que assetlinks.json est accessible en HTTPS
- Vérifier le format JSON (doit être un tableau)
- Vérifier que les empreintes sont au bon format (sans deux-points)

### Next.js

**Problème : Fichiers .well-known non accessibles**
- Vérifier que les dossiers et fichiers route.js sont bien créés
- Redémarrer le serveur Next.js après création
- Vérifier qu'il n'y a pas de middleware qui bloque l'accès
- Sur Vercel, vérifier que le déploiement a réussi

## 📚 Ressources

- [Apple Universal Links](https://developer.apple.com/ios/universal-links/)
- [Android App Links](https://developer.android.com/training/app-links)
- [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking/)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
