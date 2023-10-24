# Warning
This repository is research based project. It was created in order to support masters thesis assumption about creating a generic synchronization solution for TypeScript+PHP+Symfony projects.
Current code is not meant to be used in production environments. We strongly advise to use this in local environment only!

# Custom instructions (MacOs-M1)

We strongly advice to import Caddy's CA and root certificates to `Keychain access`. You should first run docker containers and then run the following commands:
```
`docker cp <caddys_container_name>:/data/caddy/pki/authorities/local/root.crt <path_on_local_machine>`
`docker cp <caddys_container_name>:/data/caddy/pki/authorities/local/intermediate.crt <path_on_local_machine>`
```
Then import both certificates into `Keychain access` and set `Trust` of the certificates to `Always trust` -> right click on certificate in keychain access-> `Get info`->`Trust` (tab).
This will allow browser to send HTTPS requests to backend without any restrictions and exception warnings - after all, we are just checking this code in development mode.

There is also another workaround if HTTPS requests are not allowed without accepting warning about certificate warning.
You can add the following to CaddyFile:
```
{
    # Debug
    {$CADDY_DEBUG}
    auto_https off # This option should allow Caddy server to run HTTP request instead of HTTPS
    local_certs
}
```

## Migration commands
```
php bin/console make:migration  # Ustvari migration datoteko
php bin/console doctrine:migrations:migrate # izvede migracijo v bazi
```

## Simulation
Most of the simulation related stuff is bound to frontend part of the package (in `../frontend` folder of this repository).
Currently on the backend we only enable API endpoints to export/import frontend related databases, which are:
* `api/refactored/store_fe_database_export/{database_name}/{browser_name}` - used for exporting frontend databases in `JSON` format to `simulation` folder
* `api/refactored/import_test_dexie_database_file` - used for importing database data from JSON file (stored on backend) to frontend IndexedDB database.

# Symfony Docker

A [Docker](https://www.docker.com/)-based installer and runtime for the [Symfony](https://symfony.com) web framework, with full [HTTP/2](https://symfony.com/doc/current/weblink.html), HTTP/3 and HTTPS support.

![CI](https://github.com/dunglas/symfony-docker/workflows/CI/badge.svg)

## Pre-requisite
```shell
cp .env.sample .env
# Then change values accordingly
```

## Getting Started

1. If not already done, [install Docker Compose](https://docs.docker.com/compose/install/) (v2.10+)
2. Run `docker compose build --pull --no-cache` to build fresh images
3. Run `docker compose up` (the logs will be displayed in the current shell)
4. Open `https://localhost` in your favorite web browser and [accept the auto-generated TLS certificate](https://stackoverflow.com/a/15076602/1352334)
5. Run `docker compose down --remove-orphans` to stop the Docker containers.

## Features

* Production, development and CI ready
* [Installation of extra Docker Compose services](docs/extra-services.md) with Symfony Flex
* Automatic HTTPS (in dev and in prod!)
* HTTP/2, HTTP/3 and [Preload](https://symfony.com/doc/current/web_link.html) support
* Built-in [Mercure](https://symfony.com/doc/current/mercure.html) hub
* [Vulcain](https://vulcain.rocks) support
* Native [XDebug](docs/xdebug.md) integration
* Just 2 services (PHP FPM and Caddy server)
* Super-readable configuration

**Enjoy!**

## Docs

1. [Build options](docs/build.md)
2. [Using Symfony Docker with an existing project](docs/existing-project.md)
3. [Support for extra services](docs/extra-services.md)
4. [Deploying in production](docs/production.md)
5. [Debugging with Xdebug](docs/xdebug.md)
6. [Using a Makefile](docs/makefile.md)
7. [Troubleshooting](docs/troubleshooting.md)

## License

Symfony Docker is available under the MIT License.

## Credits

### Docker images for Caddy and Symfony
Created by [Kévin Dunglas](https://dunglas.fr), co-maintained by [Maxime Helias](https://twitter.com/maxhelias) and sponsored by [Les-Tilleuls.coop](https://les-tilleuls.coop).
