# SyncLibraryClean

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 12.2.11.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.


# Custom docs

1. Added all packages from old repo
2. add configuration for workers
3. Added all packaged code from old repo (packages)

# Short description

This codebase represent an attempt to create generic synchronization logic for PWA applications using TypeScript. The logic should be used on client side and should be used in combination with logic from `../ backend` folder which represents generic synchronization logic for PHP+Symfony oriented backend projects.

This solution works based on IndexedDB databases, web workers and some additional libraries that gives us leverage with developing. 
Developers interested in using this code should note, that this code should be considered as a suppliment (or package) to existing TypeScript projects. In order to profit from this synchronization process, developers should call this logic whenever they change objects/data in their applications which they want to synchronize.

In order to start the synchronization logic, you need to start instance of `SynchronizationLibrary` which can be found at `./src/app/packages/main.ts`. This class is the "entry point" of the synchronization process inside TypeScript application. When we start an instance of the "package", the logic will create two web workers:
- one for controlling synchronization process -> logic inside `./src/app/packages/workers/object-oriented/sync-entity-clean.worker.ts`.
- one for regular checks if objects marked for synchronization were finished after some interval -> logic inside `retry-management.ts`.

We use this two web workers so that they perform as "two seperate threads" which enables us to run logic "in background" - separated from main thread (main loop of execution)

Even though this is not properly structured repository of a package, we will refer to the logic in this repository as "a package".
When main instance of the package is started it will eventually (depends of when some use cases are executed) create (and read) the following databases:
* `sync` -> database used for storing all data that user/developer wants to use as part of synchronization process
* `sync_conflict` -> data that represents conflicted data when at some point we try to synchronize data from `sync`
* `sync_temp` -> data that has the same structure as `sync` but we use it to store temporary data while some data from `sync` is locked due to being part of synchronization process.

In order to get some status updates and some notifications from the package, developers can subscribe to `SynchronizationLibrary.eventsSubject`. This is `Subject<SyncLibraryNotification>` type of variable that will emit all new messages that synchronization package will generate through each available scenario.

Main scenarios that this package covers are:
* storing objects (that we want to use as part of synchronization) to `sync` database
* automatic/manual execution of synchronization process
    * successful synchronization
    * failed synchronization (due to problem on backend)
    * failed synchronization (due to loss of network connection)
    * failed synchronization (due to timeout of synchronization request to backend)
    * conflicted data between sent data from client (frontend) and existing data in backend's database

Synchronization package also includes some basic recognision of network availability. When we connect/disconnect to/from the network, then this is recognised via `networkStatus$` variable in `./src/packages/main.ts`. Based on network status change, we also also update synchronization web worker so that we do try to send requests to backend since there is no network connection. 


# TypeScript/JavaScript good to know limitations

### Await in for...loop

This does not allow await inside -> it will bypass it and immediately switch to another iteration
```
[].forEach(()=>{
    await somepromise
})
```

We need to use:
```
for await (let item of [1,2,3,4]) {
    await <somepromise>
}
```


# HTTPS issue

It seems that CADDY server which we use as backend server for backend's part of synchronization process has some problems with certificates. If you are unable to actually run application via HTTPS, you can use the following change in the `CaddyFile`:
```
{
    # Debug
    {$CADDY_DEBUG}
    auto_https off # This option should allow Caddy server to run HTTP request instead of HTTPS
    local_certs
}
```

If you use this configuration, you need to actually change any reference in `frontend` logic from `https://` to `http://`.


Howerver, we would recommend to rather get Caddy's root and CA certificates from docker container and import them to Chrome or Firefox (in MacOS you also need to set certificates `Trust` settings to `Always`) - again. This repository is research based implementation. So all the instructions should be used on local environments and not production environments!


## Prerequisites for using simulation (on MacOS-M1 based)
* install java v12(v12.0.2) -> available at https://www.oracle.com/java/technologies/javase/jdk12-archive-downloads.html#license-lightbox
* add `selenium-server-4.10.0.jar` (available at: https://github.com/SeleniumHQ/selenium/releases/) file to `/simulation` folder
* add a chrome WebDriver (the last driver that worked correctly was v114.0.5735.90) -> available at https://chromedriver.chromium.org/downloads
* add `chromedriver_mac64` to PATH, so that we can access the driver's execution file inside current context
* run simulation: `mocha simulation/seleniumSimulation.spec.js`
* [optionally] if you wish to run simulation with selenium server you can run: `java -jar selenium-server-4.10.0.jar standalone` (but in our case the simulation without server was good enough) 


If you need to add Chrome with different (newer) version as described (or you currently use) you need to download it from https://googlechromelabs.github.io/chrome-for-testing/.
Then you need to add path to this `Google Chrome for testing application` inside the simluation file, by adding this command:
```
chromeOptions.setChromeBinaryPath('<potDo>/Google\ Chrome\ for\ testing.app/Contents/MacOS/Google\ Chrome\ for\ Testing');
```

Very likely you will also need to run this command
```
sudo xattr -cr  <path_to>/Google\ Chrome\ for\ testing.app>
```

For us personally the most beneficial instruction related to Chrome version was to add path to chrome web driver inside `/etc/paths.d/<name_of_path_variable>` (terminal restart required).
V primeru da moramo dodati chrome, ki ima vecjo verzijo, kot je trenutni uradni stable version. Ga moramo prenesti iz:
https://googlechromelabs.github.io/chrome-for-testing/