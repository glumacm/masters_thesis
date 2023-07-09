# SyncLibraryClean

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 12.2.11.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.


# PURPOSE OF THIS LIBRARY

We want to give existing projects option to easily add sync mechanism to their projects - not to use all new technology that needs refactoring of application data structure!!!!!!!!!!!!!
So next time you again check AUTOMERGE JSONPatch,JSONDiff literature, please do NOT jump to conclusions, since we cannot use all of the proposed ideas -> those ideas are extremely helpful when
building NEW software!!!

# Custom docs

1. Added all packages from old repo
2. add configuration for workers
3. Added all packaged code from old repo (packages)


# How things should work

We have `sync` DB which should be referenced as `CURRENT DB`. This database will be updated each time, developer calls update function.
We will have `syncing` DB which will hold same data structure as in `CURRENT DB`, only difference is that in this DB we will set status of an entry to `in_sync` when we start sync process for an object of an entity.
We should have two different sync processes:
- one when developer calls UPDATE we should try to perform SINGLE sync process (only one record should be sent to BE)!
- one when sync interval is executed then we should do a BULK sync process!

The general idea about sync currently:
- We send sync data to BE, if O.K we receive status COMPLETE
- We send sync data to BE, our data was merged with older version of BE object -> FAIL
    * this should trigger RETRY process


New idea about merging data:
- currently idea is that FE will call BE for data and calculate differences and then process accordingly
- New idea is that we shift calculation to BE.

The new idea goes like this:
- user is updating however he wants on UI. When the time is right, we will send data for sync to BE (still using `syncing DB`) and then:
    * if everything O.K, then ok
    * if timeout -> use retry
    * if conflict , return current server object, with mapper for conflicted data
        + we will then give developer option to subscripbe to the conflict
        + developer will recive map of fields that are conflicted and option to resolve data based on `be object field value` and `current object field value`.
        + when developer resolves the issue, we will send data to BE. If BE data did not change in-between then OK. If data changed, check for conflicts and possibly return the last conflicted fields.
            - this process will repeat itself until last field is conflicted. This however I do not expect to receive more than 2-3 repeats (it really depends how many people work on the same OBJECT at the SAME TIME)
- Retry process will be used for two cases:
    * when we hit Timeout and we do not know if request has ended
        + then we send retry data to BE (requestUuid and record data of LIMBO request)
    * What is the second use-case???
        + I think the second one is when we send data to BE but we do not hit timeout, but our reqeust got cancelled because of ?NETWORK error?
        + if first bullet point is the right use-case, then this will need a lot of thinking because this use-case is hard to reproduce and identify!!!
    * another use-case -> admin set wrong configuration and therefore sync-breaks. After admin would fix configuration, developer can again manually request retry from user.                                                                                                                                                                                                                                                                                                         


## Potencial future work
* How to redirect errors from authorization problem -> developer should have some authorization on BE but when sync lib find authorization problems for sync requests it needs to notify developer's main thread about the problem.


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


## Unit/integration tests

* to run a test I currently execute the following command: `ng test --main src/app/packages/tests/first-integration-test.spec.ts` which should (according to documentation) run tests in one file - but it seems that `app.component.spec.ts` still gets executed
even without specifying that filename (that is it's body is commented out).
Currently using `ng CLI v15.6.1

# HTTPS issue

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

Ko sem v firefox-u dodal oba Caddy Local Authority certifikata, je potem URL deloval avtomatsko!!! 

# Simulation

## Zahteve
* pred zacetkom namesti JAVO v12 -> v12.0.2 (dostopno na: https://www.oracle.com/java/technologies/javase/jdk12-archive-downloads.html#license-lightbox)
* dodaj `selenium-server-4.10.0.jar` datoteko v `/simulation` mapo -> dostopno tukaj: https://github.com/SeleniumHQ/selenium/releases/
* prenesi VSAJ chrome WebDriver (dostopno na: https://chromedriver.chromium.org/downloads) v114.0.5735.90
* dodaj `chromedriver_mac64` v PATH zato, da bo `chromedriver` skripta/komanda dostopna v izvajalnem okolju
* Pozeni selenium server : `java -jar selenium-server-4.10.0.jar standalone`
* Pozeni teste: `mocha simulation/seleniumSimulation.spec.js`

Simulation is planned with Selenium (and Mocha as test runner).
To run selenium grid, download JAR file for selenium server and then run:
`java -jar selenium-server-4.10.0.jar standalone`

To run current tests, run:
`mocha simulation/seleniumSimulation.spec.js`



## TODOs

- Add logic to handle `ERR_BAD_REQUEST`