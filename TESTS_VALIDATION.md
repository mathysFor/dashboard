# Tests et Validation des Universal Links / App Links

## 🔍 Vérification des fichiers .well-known

### 1. Vérifier apple-app-site-association

```bash
curl https://wintermateapp.com/.well-known/apple-app-site-association
```

**Attendu :**
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "YOUR_TEAM_ID.com.wintermate.app",
        "paths": ["/profile/*"]
      }
    ]
  }
}
```

### 2. Vérifier assetlinks.json

```bash
curl https://wintermateapp.com/.well-known/assetlinks.json
```

**Attendu :**
```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "package_name": "com.wintermate.app",
      "sha256_cert_fingerprints": ["..."]
    }
  }
]
```

### 3. Vérifier les headers

```bash
curl -I https://wintermateapp.com/.well-known/apple-app-site-association
```

**Doit contenir :**
- `Content-Type: application/json`
- Status: `200 OK`
- Pas de redirection (301/302)

## 📱 Tests iOS

### Test 1 : App installée
1. Envoyer un lien dans Messages : `https://wintermateapp.com/profile/test123`
2. Cliquer sur le lien
3. ✅ L'app doit s'ouvrir directement
4. ✅ L'écran Profile doit s'afficher avec userId="test123"

### Test 2 : App non installée
1. Désinstaller l'app
2. Ouvrir Safari et aller sur : `https://wintermateapp.com/profile/test123`
3. ✅ Doit rediriger vers l'App Store

### Test 3 : Simulateur
```bash
xcrun simctl openurl booted "https://wintermateapp.com/profile/test123"
```

## 🤖 Tests Android

### Test 1 : App installée
1. Envoyer un lien dans Gmail : `https://wintermateapp.com/profile/test123`
2. Cliquer sur le lien
3. ✅ L'app doit s'ouvrir directement (sans sélecteur d'app)
4. ✅ L'écran Profile doit s'afficher avec userId="test123"

### Test 2 : App non installée
1. Désinstaller l'app
2. Ouvrir Chrome et aller sur : `https://wintermateapp.com/profile/test123`
3. ✅ Doit rediriger vers le Play Store

### Test 3 : Vérification ADB
```bash
adb shell pm get-app-links com.wintermate.app
```

**Doit afficher :**
```
wintermateapp.com: verified
```

### Test 4 : Emulateur
```bash
adb shell am start -a android.intent.action.VIEW -d "https://wintermateapp.com/profile/test123"
```

## ✅ Checklist complète

- [ ] Fichiers .well-known accessibles en HTTPS
- [ ] Headers Content-Type corrects
- [ ] TEAM_ID iOS configuré
- [ ] Associated Domains dans Xcode
- [ ] Empreintes SHA-256 Android configurées
- [ ] Intent-filter avec autoVerify dans AndroidManifest
- [ ] Deep linking React Native configuré
- [ ] URLs des stores mises à jour
- [ ] Tests iOS app installée
- [ ] Tests iOS app non installée
- [ ] Tests Android app installée
- [ ] Tests Android app non installée
- [ ] Vérification ADB Android
- [ ] Tests depuis différentes apps (Messages, Gmail, etc.)
