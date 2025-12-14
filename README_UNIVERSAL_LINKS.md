# 🚀 Universal Links et App Links - Winter Mate

## ✅ Implémentation Terminée

Ce projet contient maintenant tous les fichiers nécessaires pour les Universal Links (iOS) et App Links (Android).

## 📁 Fichiers créés

### Next.js (Backend)
- `src/app/.well-known/apple-app-site-association/route.js` - Configuration iOS
- `src/app/.well-known/assetlinks.json/route.js` - Configuration Android
- `src/app/profile/[userId]/page.js` - Page de redirection vers les stores

### Documentation
- `UNIVERSAL_LINKS_SETUP.md` - Guide complet de configuration
- `IOS_CONFIGURATION.md` - Guide spécifique iOS
- `ANDROID_CONFIGURATION.md` - Guide spécifique Android
- `REACT_NATIVE_CONFIGURATION.md` - Guide React Native
- `TESTS_VALIDATION.md` - Guide de tests et validation

## 🔧 Actions requises

### 1. Configuration iOS (5 min)

**Vous devez :**
1. Récupérer votre TEAM_ID sur https://developer.apple.com/account
2. Mettre à jour `src/app/.well-known/apple-app-site-association/route.js` avec le vrai TEAM_ID
3. Configurer Associated Domains dans Xcode : `applinks:wintermateapp.com`

👉 **Guide détaillé :** `IOS_CONFIGURATION.md`

### 2. Configuration Android (10 min)

**Vous devez :**
1. Récupérer les empreintes SHA-256 (debug + production) avec keytool
2. Mettre à jour `src/app/.well-known/assetlinks.json/route.js` avec les empreintes
3. Modifier `AndroidManifest.xml` pour ajouter l'intent-filter

👉 **Guide détaillé :** `ANDROID_CONFIGURATION.md`

### 3. Configuration React Native (5 min)

**Vous devez :**
1. Configurer le linking dans React Navigation
2. Modifier l'écran Profile pour récupérer le paramètre userId
3. Ajouter les gestionnaires de deep links

👉 **Guide détaillé :** `REACT_NATIVE_CONFIGURATION.md`

### 4. Mettre à jour les URLs des stores (2 min)

Ouvrir `src/app/profile/[userId]/page.js` et remplacer :
- `APP_ID` par l'ID réel de votre app sur l'App Store
- Vérifier l'URL du Play Store

## 🚢 Déploiement

1. **Déployer sur Vercel :**
   ```bash
   git add .
   git commit -m "Add Universal Links and App Links configuration"
   git push
   ```

2. **Vérifier les fichiers .well-known :**
   ```bash
   curl https://wintermateapp.com/.well-known/apple-app-site-association
   curl https://wintermateapp.com/.well-known/assetlinks.json
   ```

3. **Compiler et déployer les apps mobiles**

## 🧪 Tests

Suivez le guide complet dans `TESTS_VALIDATION.md`

**Tests rapides :**

iOS :
```bash
xcrun simctl openurl booted "https://wintermateapp.com/profile/test123"
```

Android :
```bash
adb shell am start -a android.intent.action.VIEW -d "https://wintermateapp.com/profile/test123"
```

## ⏱️ Temps estimé

- Configuration complète : **~25 minutes**
- Tests : **~15 minutes**
- **Total : ~40 minutes**

## 📞 Support

En cas de problème, consultez :
- `UNIVERSAL_LINKS_SETUP.md` - Section "Dépannage"
- `IOS_CONFIGURATION.md` - Section "Problèmes courants"
- `ANDROID_CONFIGURATION.md` - Section "Problèmes courants"

## 🎯 Résultat attendu

Une fois configuré :
- Un utilisateur clique sur `https://wintermateapp.com/profile/USER123`
- Si l'app est installée → L'app s'ouvre directement sur le profil USER123
- Si l'app n'est pas installée → Redirection vers l'App Store ou Play Store

Aucune intervention de l'utilisateur, tout est automatique ! ✨
