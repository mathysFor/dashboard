# Configuration de l'authentification pour le backoffice

## Vue d'ensemble

Les pages `/dashboard` et `/control` sont maintenant protégées par une authentification Firebase. Seul l'utilisateur avec `SUPER_USER: true` dans Firestore peut y accéder.

## Première configuration

### 1. Créer un compte utilisateur

1. Accédez à `/login` dans votre application
2. Cliquez sur "Créer un compte"
3. Entrez votre email et un mot de passe (minimum 6 caractères)
4. Le compte sera créé dans Firebase Auth

### 2. Ajouter SUPER_USER à l'utilisateur

Une fois le compte créé, vous devez ajouter le champ `SUPER_USER: true` au document Firestore de l'utilisateur.

**Option A : Via le script Node.js (recommandé)**

```bash
node scripts/add-super-user.js
```

Ce script ajoute automatiquement `SUPER_USER: true` à l'utilisateur avec l'ID `bn0pM2tyf2ey42aZXHTHc4RL61i2`.

**Option B : Manuellement via Firebase Console**

1. Allez dans Firebase Console > Firestore Database
2. Trouvez le document dans la collection `users` avec l'ID `bn0pM2tyf2ey42aZXHTHc4RL61i2`
3. Ajoutez le champ `SUPER_USER` avec la valeur `true` (boolean)

**Option C : Via le dashboard existant**

Si vous avez déjà accès au dashboard (avant la protection), vous pouvez :
1. Rechercher l'utilisateur par son ID
2. Ajouter manuellement le champ `SUPER_USER: true` dans le formulaire d'édition

## Utilisation

### Connexion

1. Accédez à `/login`
2. Entrez votre email et mot de passe
3. Vous serez automatiquement redirigé vers la page que vous tentiez d'atteindre (ou `/dashboard` par défaut)

### Déconnexion

Pour l'instant, la déconnexion n'est pas implémentée dans l'interface. Vous pouvez vous déconnecter en :
- Supprimant les cookies/localStorage de votre navigateur
- Ou en ajoutant un bouton de déconnexion (à implémenter si nécessaire)

## Sécurité

- Les pages `/dashboard` et `/control` vérifient automatiquement :
  1. Si l'utilisateur est authentifié (Firebase Auth)
  2. Si le document Firestore `users/{uid}` contient `SUPER_USER: true`
- Si l'une de ces conditions n'est pas remplie, l'utilisateur est redirigé vers `/login`
- Le composant `AuthGuard` gère automatiquement ces vérifications

## Structure des fichiers

- `lib/firebase.js` - Configuration Firebase (Auth + Firestore)
- `lib/AuthGuard.jsx` - Composant de protection des routes
- `src/app/login/page.jsx` - Page de connexion/inscription
- `scripts/add-super-user.js` - Script pour ajouter SUPER_USER

## Notes importantes

- L'ID utilisateur utilisé dans le script est : `bn0pM2tyf2ey42aZXHTHc4RL61i2`
- Si vous devez changer cet ID, modifiez la constante `USER_ID` dans `scripts/add-super-user.js`
- Le script utilise `firebase-admin` qui nécessite le fichier `service-account.json`
