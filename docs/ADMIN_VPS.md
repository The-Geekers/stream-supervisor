# Administration VPS

Ce document regroupe les commandes d'administration réellement validées pour le VPS Stream Supervisor.

## Principes

- Les interfaces Web d'administration ne doivent pas être exposées directement sur Internet.
- Nginx Proxy Manager est le frontal HTTPS public.
- Les applications Web partagent le réseau Docker externe `web-proxy`.
- Les flux média Restreamer restent hors NPM.
- Les secrets restent dans les fichiers locaux du VPS et ne sont jamais affichés ni versionnés.

## Tunnel SSH vers Nginx Proxy Manager

L'interface NPM écoute uniquement sur `127.0.0.1:81` du VPS.

Depuis le poste administrateur :

```bash
ssh -L 8188:127.0.0.1:81 debian@IP_DU_VPS
```

Puis ouvrir :

```text
http://127.0.0.1:8188
```

Le tunnel disparaît quand la session SSH est fermée.

Vérification côté VPS :

```bash
sudo ss -ltnp | grep ':81\|:8188' || true
```

## Réseau Docker Web partagé

Création :

```bash
docker network create web-proxy
```

Connexion manuelle d'un conteneur déjà existant :

```bash
docker network connect web-proxy NOM_DU_CONTENEUR
```

Lister les membres :

```bash
docker network inspect web-proxy \
  --format '{{range $id,$c := .Containers}}{{println $c.Name}}{{end}}' \
  | sort
```

Une connexion faite uniquement avec `docker network connect` peut disparaître si le conteneur est recréé. Pour les services maintenus par Compose, déclarer `web-proxy` comme réseau externe dans leur fichier Compose.

## Destinations NPM validées

Exemples actuellement utilisés :

```text
Supervisor   -> http://stream-supervisor:8090
Restreamer   -> http://restreamer:8080
Portainer    -> https://portainer:9443
FileBrowser  -> http://filebrowser-quantum:80
```

Le domaine public pointe vers NPM. NPM joint ensuite le conteneur directement par DNS Docker.

## Supervisor

À partir de l'alpha 9.2 :

- le port hôte `8090` est lié uniquement à `127.0.0.1` ;
- Supervisor rejoint automatiquement `web-proxy` ;
- le script de mise à jour crée `web-proxy` s'il manque.

Mise à jour :

```bash
cd /opt/stream-supervisor
sh deployment/update.sh
```

## Vérifications réseau sûres

Ports en écoute :

```bash
sudo ss -lntupH | awk '{print $1, $5, $7}' | sort -u
```

Ports Docker publiés :

```bash
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Réseaux d'un conteneur sans afficher son environnement :

```bash
docker inspect -f '{{range $name,$cfg := .NetworkSettings.Networks}}{{println $name}}{{end}}' NOM_DU_CONTENEUR
```

## Firewall Docker

Docker utilise actuellement le backend iptables.

Les règles opérateur destinées à filtrer des ports Docker publiés sont placées dans la chaîne `DOCKER-USER`.

État validé après durcissement :

- NPM public sur `80/443` ; administration NPM sur `127.0.0.1:81` via tunnel SSH.
- Supervisor sur `127.0.0.1:8090`.
- FileBrowser sur `127.0.0.1:8900`.
- Portainer sur `127.0.0.1:9443`.
- Restreamer ne publie plus `8080/8181` sur l'hôte ; NPM et Supervisor le joignent via `web-proxy`.
- Ports média Restreamer conservés : `1935/1936 TCP` et `6000 UDP`.
- Muxshed a été supprimé du VPS.
- LLMNR/5355 a été désactivé.

Le firewall persistant couvre IPv4 et IPv6, avec politique entrante restrictive. Les règles Docker publiques passent par `DOCKER-USER`.

Le journal INCIDENTS de Supervisor est stocké dans le volume Docker `supervisor_data` et ne doit contenir que des données allow-listées.

## Rappel sécurité

Ne jamais coller dans une conversation ou un ticket :

- contenu du `.env` ;
- stream keys ;
- JWT ;
- commandes FFmpeg brutes ;
- inspection Docker complète contenant les variables d'environnement ;
- logs non filtrés susceptibles de contenir des URLs de diffusion.
