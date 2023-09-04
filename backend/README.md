# Custom instructions

V vsakem primeru, ce hocem, da bo browser sprejel Caddy certifikat je potrebno dodati `Caddy Local Authority - ECC Intermediate`
certifikat v Keychain Access. Trenutno sem uspel to narediti tako, da ko obisces eno stran, ki je vezana na BE,
kliknes na ikono ob URL-ju, kjer lahko vidis podrobnosti certifikata, ki ga browser zavraca.
Kliknes na certifikat in nato gres na tab `Details`, tam v `Certificate Hierarchy` izberes najvisjo opcijo, ki bi morala
biti `Caddy Local Authority - ECC Intermediate`. Potem to exportas. Nato dvakrat kliknes na zadevo in uvozis pod SYSTEMS (ne pod local items!!!!)
Ko je certifikat dodan v Keychain access, ga je potrebno tudi nastaviti, da se mu zaupa!!!!
Gres v Keychain access, dvakrat kliknes na `Caddy Local Authority - ECC Intermediate` in nato razsiris
`Trust` sekcijo in v `While using this certifikate` oznacis `Always trust`. S tem bo vsak brskalnik od sedaj naprej
moral sprejeti certifikate od tega "Authorityja", ki jih Caddy generira na nasem lokalnem serverju.
Potrebno je dodati tudi ROOT certifikat. Oba certifikata je mozno dobiti v Caddy containerju na poti:
`/data/caddy/pki/authorities/local/`. Preneses na svoj racunalnik `root.crt` in `intermediate.crt` in jih uvozis
v Keychain access. To bi moralo dovoliti precej casa izvajati zahteve na BE brez problema.

Ukaz za kopiranje:
`docker cp test-masters-be-caddy-1:/data/caddy/pki/authorities/local/root.crt <pot_na_lokalnem_racunalniku>`

V primeru, da testi/simulacija ne bo dovolila posiljanje zahtev na backend, brez da bi se prvo sprejelo certifikat v 
chrome browserju (ko gremo na url, ki ga simulacija poklice), se lahko v CADDY nastavivah povozi, da ne bo vec
omogocen HTTPS ampak bi potem klical kar HTTP - seveda bo potrebno v logiki FE-ja popraviti URL do BE-a.

V CaddyFile dodamo sledece:
```
{
    # Debug
    {$CADDY_DEBUG}
    auto_https off # trenutno je to zakomentirano
    local_certs # trenutno imam to moznost vklopljeno!!!
}
```

## SSH multiple accounts
Trenutno je vseeno kaksna je vsebina `~/.ssh/config`. Pomembno je kaksne kljuce ima ssh agent. Zaenkrat ne poznam
nastavitve, ki bi omogocala socasno uporabo GitHub za firmo in privatni. Zato predlagam sprotno brisanje in dodajanje
ssh kljuca v agenta.

```
ssh-add -D # -D pobrise vse kljuce v agentu
ssh-add ~/.ssh/<kljucKiGaRabimoZaSSHDostop>
```

## Migration commands
```
php bin/console make:migration  # Ustvari migration datoteko
php bin/console doctrine:migrations:migrate # izvede migracijo v bazi
```

## Simulacija
Vecina zadev je vezana na FE. Trenutno je na BE obvezno le to, da omogocimo endpointe za EXPORT in IMPORT FE podatkovne baze.
Trenutno je ideja, da bi ta dva endpointa bila:

* `api/refactored/store_fe_database_export/{database_name}/{browser_name}`
* `api/refactored/import_test_dexie_database_file`

Prvi omogoci, da iz FE posljemo JSON export specificne podatkovne baze (npr. `sync`) in to shranimo v `simluation`
direktorij.

Drugi omogoca, da iz BE posljemo prepripravljeno bazo za `sync`, ki jo nato uvozimo na FE. Specificno zato, da lahko izvedemo simulacijo.


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

Created by [Kévin Dunglas](https://dunglas.fr), co-maintained by [Maxime Helias](https://twitter.com/maxhelias) and sponsored by [Les-Tilleuls.coop](https://les-tilleuls.coop).
