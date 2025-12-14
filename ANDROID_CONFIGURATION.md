# Configuration Android pour App Links

## 📋 Prérequis

- Projet Android de Winter Mate
- Accès aux certificats de signature (debug et production)
- Android Studio installé

## 🔑 Étape 1 : Récupérer les empreintes SHA-256

### Pour le certificat de DEBUG :

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

### Pour le certificat de PRODUCTION :

```bash
keytool -list -v -keystore /chemin/vers/votre/keystore.jks -alias votre-alias-de-production
```

Vous serez invité à entrer le mot de passe de la keystore.

### Récupérer l'empreinte :

Dans la sortie de la commande, cherchez la ligne qui commence par `SHA256:` :

```
SHA256: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56
```

**Format pour assetlinks.json :**
- Copier la valeur complète SANS les deux-points
- Exemple : `ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890`

ℹ️ **Note :** Certaines documentations mentionnent le format avec deux-points. Android accepte les deux formats, mais sans deux-points est plus courant.

## ✏️ Étape 2 : Mettre à jour assetlinks.json

1. Ouvrir : `src/app/.well-known/assetlinks.json/route.js`
2. Remplacer `SHA256_DE_LA_CLE_DE_DEBUG` par l'empreinte de debug
3. Remplacer `SHA256_DE_LA_CLE_DE_PRODUCTION` par l'empreinte de production
4. Vérifier que `package_name` correspond à votre `applicationId` dans `build.gradle`

**Exemple :**
```javascript
sha256_cert_fingerprints: [
  "14ABC20BD4F2AB984EF7B3CD8937F562A8CF12E3D456B7890CDEF1234567890A",
  "9876FED5CBA4321098765FEDCBA43210987654321FEDCBA098765432FEDCBA09"
]
```

## 🛠️ Étape 3 : Modifier AndroidManifest.xml

1. Ouvrir : `android/app/src/main/AndroidManifest.xml`
2. Localiser la balise `<activity>` pour `MainActivity`
3. Ajouter l'intent-filter suivant **à l'intérieur** de la balise `<activity>` :

```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTask"
    android:label="@string/app_name"
    android:configChanges="keyboard|keyboardHidden|orientation|screenSize|uiMode"
    android:windowSoftInputMode="adjustResize">
    
    <!-- Intent-filter existant pour le launcher -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>
    
    <!-- AJOUTER CET INTENT-FILTER POUR LES APP LINKS -->
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

### Points critiques :

✅ **`android:autoVerify="true"`** - OBLIGATOIRE pour activer la vérification automatique
✅ **`android:exported="true"`** - Nécessaire pour que l'activité puisse être lancée par des intents externes
✅ **`android:launchMode="singleTask"`** - Recommandé pour éviter de créer plusieurs instances
✅ **`android:scheme="https"`** - Doit être HTTPS (pas HTTP)
✅ **`android:host="wintermateapp.com"`** - Votre domaine exact
✅ **`android:pathPrefix="/profile"`** - Le chemin pour les profils

## 📄 Étape 4 : Vérifier build.gradle

Ouvrir : `android/app/build.gradle`

Vérifier que l'`applicationId` correspond au `package_name` dans assetlinks.json :

```gradle
android {
    defaultConfig {
        applicationId "com.wintermate.app"  // Doit correspondre à package_name
        // ...
    }
}
```

## 🔨 Étape 5 : Compiler et installer

1. Compiler l'APK ou l'AAB :
   ```bash
   cd android
   ./gradlew assembleRelease
   # ou
   ./gradlew bundleRelease
   ```

2. Installer sur un appareil de test :
   ```bash
   adb install app/build/outputs/apk/release/app-release.apk
   ```

## ✅ Étape 6 : Vérifier la configuration

### Vérifier l'état des App Links :

```bash
adb shell pm get-app-links com.wintermate.app
```

**Sortie attendue :**
```
com.wintermate.app:
  ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  Signatures: [...]
  Domain verification state:
    wintermateapp.com: verified
```

Si vous voyez `verified`, c'est parfait ! ✅

Si vous voyez `none` ou `1024` (non vérifié), vérifiez :
- Que assetlinks.json est accessible en HTTPS
- Que les empreintes SHA-256 sont correctes
- Attendez quelques minutes et réessayez

### Forcer une nouvelle vérification :

```bash
adb shell pm set-app-links --package com.wintermate.app 0 all
```

Puis désinstaller et réinstaller l'app.

## 🧪 Étape 7 : Tester

### Test avec ADB :

```bash
adb shell am start -a android.intent.action.VIEW -d "https://wintermateapp.com/profile/test123"
```

Si l'app s'ouvre, App Links fonctionne ! ✅

### Test manuel :

1. Envoyer le lien via Gmail, Messages ou un autre app : `https://wintermateapp.com/profile/test123`
2. Cliquer sur le lien
3. L'app devrait s'ouvrir directement (sans popup de sélection d'app)

### Test dans le navigateur :

1. Ouvrir Chrome sur Android
2. Taper : `https://wintermateapp.com/profile/test123`
3. Appuyer sur Entrée
4. L'app devrait s'ouvrir automatiquement

## 🔍 Débogage

### Vérifier les logs Android :

```bash
adb logcat | grep -i "applinks"
```

### Vérifier le fichier assetlinks.json :

```bash
curl https://wintermateapp.com/.well-known/assetlinks.json
```

Doit retourner un JSON valide avec vos empreintes.

### Vérifier les headers :

```bash
curl -I https://wintermateapp.com/.well-known/assetlinks.json
```

Doit contenir : `Content-Type: application/json`

## ⚠️ Problèmes courants

### L'App Link ouvre un sélecteur d'app au lieu d'ouvrir directement

**Cause :** La vérification n'a pas réussi ou n'est pas terminée.

**Solutions :**
1. Vérifier avec : `adb shell pm get-app-links com.wintermate.app`
2. Vérifier que assetlinks.json est accessible
3. Vérifier que les empreintes SHA-256 sont correctes
4. Attendre quelques minutes après l'installation
5. Désinstaller/réinstaller l'app

### La vérification échoue systématiquement

**Causes possibles :**
- Les empreintes SHA-256 ne correspondent pas
- Le package_name est incorrect
- Le fichier assetlinks.json n'est pas accessible en HTTPS
- Le format JSON est invalide
- Il y a une redirection HTTP

**Solutions :**
1. Re-vérifier les empreintes avec `keytool`
2. Vérifier que le package_name dans assetlinks.json = applicationId dans build.gradle
3. Tester l'accès au fichier avec `curl`
4. Valider le JSON avec un validateur en ligne

### Différence entre debug et production

Les empreintes SHA-256 sont **différentes** entre debug et production !

- **Debug** : Utilisé pendant le développement
- **Production** : Utilisé pour les builds signés pour le Play Store

⚠️ **Important :** Ajouter les DEUX empreintes dans assetlinks.json pour que ça fonctionne en debug ET en production.

### App Links fonctionnent en debug mais pas en production

**Cause :** L'empreinte de production n'est pas dans assetlinks.json

**Solution :**
1. Récupérer l'empreinte de la keystore de production
2. L'ajouter dans assetlinks.json
3. Redéployer le site Next.js
4. Attendre quelques minutes et réinstaller l'app

## 📚 Ressources

- [Android App Links Documentation](https://developer.android.com/training/app-links)
- [Verify Android App Links](https://developer.android.com/training/app-links/verify-android-applinks)
- [Digital Asset Links](https://developers.google.com/digital-asset-links)
