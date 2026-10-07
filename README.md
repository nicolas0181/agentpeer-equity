# AgentPeer — simulateur d'equity

Simulateur de répartition du capital entre cofondateurs, du pré-seed à la Série D : dilution par tour, SAFE / BSA AIR, pool BSPCE, vesting et départs, ventes secondaires, down rounds avec anti-dilution, cascade de préférences à la sortie, fiscalité (PFU, CEHR, apport-cession), Monte Carlo et calculateur de répartition par critères.

- Français : https://nicolas0181.github.io/agentpeer-equity/
- English: https://nicolas0181.github.io/agentpeer-equity/en.html

Pages statiques (HTML + Plotly), sans serveur ni stockage : rien de ce que vous saisissez ne quitte votre navigateur. Un scénario se partage avec le bouton « Copier le lien », qui encode les réglages dans l'URL.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Version française |
| `en.html` | Version anglaise (générée depuis la version française) |
| `model.test.mjs` | Tests du modèle, exécutés sur le code réellement en ligne |

## Lancer les tests

    node model.test.mjs index.html
    node model.test.mjs en.html

Ils vérifient notamment que les parts font toujours 100 %, que la cascade de sortie distribue exactement le prix de vente, la conversion des SAFE (cap, plancher, préférence conservée), le vesting, l'anti-dilution (moyenne pondérée et full ratchet, comparées à un calcul à la main) et le calculateur de répartition.

## Confidentialité

Ce dépôt et la page sont publics : les valeurs par défaut sont donc neutres (34 / 33 / 33). Votre scénario réel se partage par lien. Pour restreindre l'accès à quelques adresses email, une option gratuite est de servir la page via Cloudflare Pages + Cloudflare Access (jusqu'à 50 utilisateurs) depuis un dépôt privé.

## Sources principales

Carta (benchmarks 2026, Founder Ownership Report 2026, State of Private Markets 2025, State of Pre-Seed T2 2026), Cooley (Venture Financing Report T2 2026), PitchBook (European VC Valuations T3 2025), Equidam (Valuation Delta T3 2025), Atomico (State of European Tech 2025). Les valeurs estimées sont signalées « Estim. » dans l'onglet Sources.

Simulation indicative : ni conseil juridique, ni fiscal, ni financier.
