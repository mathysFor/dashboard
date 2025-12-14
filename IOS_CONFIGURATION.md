# Configuration iOS pour Universal Links

## 📋 Prérequis

- Compte développeur Apple valide
- Accès à Xcode
- Projet iOS de Winter Mate ouvert dans Xcode

## 🔑 Étape 1 : Récupérer le Team ID

1. Aller sur https://developer.apple.com/account
2. Se connecter avec le compte développeur Apple
3. Cliquer sur "Membership" dans le menu latéral
4. Copier le **Team ID** (10 caractères alphanumériques, ex: ABC123DEF4)

## ✏️ Étape 2 : Mettre à jour apple-app-site-association

1. Ouvrir le fichier : `src/app/.well-known/apple-app-site-association/route.js`
2. Remplacer `TEAM_ID` par votre vrai Team ID
3. Vérifier que le Bundle Identifier est correct (`com.wintermate.app`)

**Exemple :**
```javascript
appID: "ABC123DEF4.com.wintermate.app"
```

## 🛠️ Étape 3 : Configurer Associated Domains dans Xcode

1. Ouvrir le projet iOS dans Xcode
2. Sélectionner le **target** de l'application dans le navigateur de projet
3. Cliquer sur l'onglet **"Signing & Capabilities"**
4. Cliquer sur le bouton **"+ Capability"** en haut
5. Rechercher et ajouter **"Associated Domains"**
6. Dans la section "Associated Domains", cliquer sur **"+"**
7. Ajouter exactement : `applinks:wintermateapp.com`

⚠️ **Format important** : 
- Utiliser `applinks:` (pas `https://`)
- Pas de slash à la fin
- Format exact : `applinks:wintermateapp.com`

## 📄 Étape 4 : Vérifier le fichier Entitlements

Xcode devrait créer automatiquement un fichier `.entitlements`. Si vous devez le créer manuellement :

**Fichier : `ios/WinterMate/WinterMate.entitlements`**

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

## 🧪 Étape 5 : Tester dans Xcode

### Test avec le simulateur :

```bash
xcrun simctl openurl booted "https://wintermateapp.com/profile/test123"
```

### Test sur device physique :

1. Compiler et installer l'app sur l'iPhone
2. Envoyer le lien via Messages ou Mail : `https://wintermateapp.com/profile/test123`
3. Cliquer sur le lien
4. L'app devrait s'ouvrir directement (si le fichier apple-app-site-association est déployé)

## 🔍 Vérification et débogage

### Vérifier les logs Xcode :

Lors du clic sur un Universal Link, Xcode affiche des logs :
- Ouvrir la Console dans Xcode
- Filtrer par "swcd" ou "Universal Links"
- Vérifier les messages d'erreur

### Vérifier le fichier apple-app-site-association :

```bash
curl https://wintermateapp.com/.well-known/apple-app-site-association
```

Doit retourner un JSON valide avec votre Team ID.

### Forcer une nouvelle vérification :

1. Désinstaller complètement l'app de l'iPhone
2. Réinstaller l'app
3. iOS va re-vérifier le fichier apple-app-site-association

### Vérifier dans les Réglages iOS :

Sur iOS 14+, vous pouvez vérifier dans :
**Réglages > [Votre App] > Universal Links**

## ⚠️ Problèmes courants

### L'Universal Link ouvre Safari au lieu de l'app

**Causes possibles :**
- Le fichier apple-app-site-association n'est pas accessible
- Le Team ID est incorrect
- Associated Domains n'est pas configuré dans Xcode
- Le Bundle Identifier ne correspond pas
- Il y a une redirection HTTP sur le fichier

**Solutions :**
1. Vérifier que le fichier est accessible en HTTPS sans redirection
2. Vérifier que le Team ID est correct
3. Désinstaller/réinstaller l'app
4. Attendre jusqu'à 24h pour la propagation Apple

### Le fichier apple-app-site-association n'est pas valide

**Solutions :**
- Vérifier qu'il est servi avec `Content-Type: application/json`
- Vérifier qu'il n'y a pas de redirection HTTP
- Vérifier le format JSON (pas d'erreurs de syntaxe)
- Vérifier que le fichier est accessible publiquement (pas d'authentification)

### TestFlight vs Production

Les Universal Links peuvent avoir un comportement différent entre TestFlight et l'App Store. Toujours tester en production avant de valider.

## 📚 Ressources

- [Apple Universal Links Documentation](https://developer.apple.com/ios/universal-links/)
- [Supporting Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
