# LeVraiPNF — Backend Vercel

API serverless pour la boutique LeVraiPNF.

## Fonctions disponibles

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/products` | GET | Récupère les produits Printful |
| `/api/create-checkout` | POST | Crée une session Stripe Checkout |
| `/api/webhook-stripe` | POST | Webhook Stripe → crée commande Printful |
| `/api/track-order` | GET | Suivi de commande Printful |

## Setup

### 1. Déployer sur Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Se connecter
vercel login

# Déployer
vercel --prod
```

### 2. Variables d'environnement

Dans Vercel Dashboard → ton projet → Settings → Environment Variables, ajoute :

```
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
PRINTFUL_API_KEY=xxxx
NEXT_PUBLIC_SITE_URL=https://levraipnf.store
```

### 3. Configurer le webhook Stripe

Dans Stripe Dashboard → Developers → Webhooks → Add endpoint :
- URL : `https://ton-projet.vercel.app/api/webhook-stripe`
- Events : `checkout.session.completed`
- Copie le "Signing secret" → mets-le dans `STRIPE_WEBHOOK_SECRET`

### 4. Clé API Printful

Dans Printful → Settings → API → Generate API key
→ Mets-la dans `PRINTFUL_API_KEY`

## Flux complet

1. Client commande sur levraipnf.store
2. `/api/create-checkout` crée une session Stripe
3. Client paye sur la page Stripe
4. Stripe envoie un webhook à `/api/webhook-stripe`
5. Le webhook crée automatiquement la commande sur Printful
6. Printful produit et expédie
7. Client peut suivre sur `/api/track-order?orderId=xxx`

## URLs après déploiement

Remplace `VERCEL_URL` dans levraipnf.html par l'URL de ton projet Vercel
(ex: `https://levraipnf-backend.vercel.app`)
