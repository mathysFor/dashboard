# ✅ TODO : Valeurs à remplacer pour finaliser la configuration

## 🔴 OBLIGATOIRE : Valeurs à remplacer

### 1. iOS - Team ID Apple

**Fichier :** `src/app/.well-known/apple-app-site-association/route.js`

**Ligne à modifier :**
```javascript
appID: "TEAM_ID.com.wintermate.app"
```

**Remplacer par :**
```javascript
appID: "VOTRE_TEAM_ID.com.wintermate.app"
```

**Comment obtenir le Team ID :**
1. Aller sur https://developer.apple.com/account
2. Se connecter
3. Aller dans "Membership"
4. Copier le Team ID (10 caractères, ex: ABC123DEF4)

---

### 2. Android - Empreintes SHA-256

**Fichier :** `src/app/.well-known/assetlinks.json/route.js`

**Lignes à modifier :**
```javascript
sha256_cert_fingerprints: [
  "SHA256_DE_LA_CLE_DE_DEBUG",
  "SHA256_DE_LA_CLE_DE_PRODUCTION"
]
```

**Commandes pour obtenir les empreintes :**

Debug :
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA256
```

Production :
```bash
keytool -list -v -keystore /chemin/vers/votre/production.keystore -alias votre-alias
```

Copier la valeur SHA256 SANS les deux-points.

---

### 3. URLs des App Stores

**Fichier :** `src/app/profile/[userId]/page.js`

**Lignes à modifier :**
```javascript
const APP_STORE_URL = 'https://apps.apple.com/app/idAPP_ID'; // Remplacer APP_ID
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.wintermate.app';
```

**App Store :**
- Trouver l'ID de votre app dans App Store Connect
- Exemple : `https://apps.apple.com/app/id123456789`

**Play Store :**
- Vérifier que le package name correspond à votre applicationId dans build.gradle
- Exemple : `https://play.google.com/store/apps/details?id=com.wintermate.app`

---

## 📱 Configuration mobile (non incluse dans ce repo)

### iOS - Xcode

**Actions à faire :**
1. Ouvrir le projet iOS dans Xcode
2. Sélectionner le target
3. Aller dans "Signing & Capabilities"
4. Ajouter "Associated Domains"
5. Ajouter : `applinks:wintermateapp.com`

**Fichier à créer/modifier :** `ios/WinterMate/WinterMate.entitlements`

### Android - AndroidManifest.xml

**Fichier :** `android/app/src/main/AndroidManifest.xml`

**Ajouter dans MainActivity :**
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="https"
        android:host="wintermateapp.com"
        android:pathPrefix="/profile" />
</intent-filter>
```

### React Native - Deep Linking

**Fichier :** Votre fichier principal de navigation (App.js ou navigation/index.js)

**Ajouter :**
```javascript
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
    },
  },
};
```

---

## 🚀 Ordre recommandé

1. ✅ **Remplacer Team ID iOS** (2 min)
2. ✅ **Remplacer empreintes SHA-256 Android** (5 min)
3. ✅ **Mettre à jour URLs stores** (1 min)
4. ✅ **Déployer sur Vercel** (vérifier que les fichiers .well-known sont accessibles)
5. ✅ **Configurer Xcode** (5 min)
6. ✅ **Modifier AndroidManifest.xml** (3 min)
7. ✅ **Configurer React Navigation** (5 min)
8. ✅ **Compiler et tester** (10 min)

**Temps total estimé : ~30 minutes**

---

## ✅ Vérification après déploiement

```bash
# Vérifier fichier iOS
curl https://wintermateapp.com/.well-known/apple-app-site-association

# Vérifier fichier Android
curl https://wintermateapp.com/.well-known/assetlinks.json

# Vérifier redirection
curl -L https://wintermateapp.com/profile/test123
```

---

## 📚 Guides détaillés

- **Guide complet** : `UNIVERSAL_LINKS_SETUP.md`
- **iOS** : `IOS_CONFIGURATION.md`
- **Android** : `ANDROID_CONFIGURATION.md`
- **React Native** : `REACT_NATIVE_CONFIGURATION.md`
- **Tests** : `TESTS_VALIDATION.md`
- **README** : `README_UNIVERSAL_LINKS.md`
