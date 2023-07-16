const { By, Builder, Browser, Capabilities, TimeUnit, until, ThenableWebDriver, Capability } = require('selenium-webdriver');
const { suite } = require('selenium-webdriver/testing');
const assert = require("assert");
const {v4} = require('uuid');
const { delayed } = require('selenium-webdriver/lib/promise');
const mockData = require('./mock-data/data');
const utilities = require('./utilities');

const SIMLUATION_NAME = 'Offline';





function delayCustom(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function manipulateDriver(driver, driverIndex, shouldDestroy) {
  /**
   * 
   */
  // await delayCustom(1300);
  // await driver.sleep(2000);
  // Previous example of calling the simulation
  // await driver.get(`http://localhost:4200/simulation-online-with-steps/${utilities.convertObjectToBase64String(mockData.agentsData[driverIndex])}`);
  // await driver.get(`http://localhost:4200/simulation-online-with-steps/${utilities.convertObjectToBase64String(mockData.agentsSimWithNetNoAuto[driverIndex])}`);
  // await driver.get(`http://localhost:4200/simulation-online-with-steps/${utilities.convertObjectToBase64String(mockData.agentsSimWithNetAndAuto[driverIndex])}`);
  await driver.get(`http://localhost:4200/simulation-online-with-steps/${utilities.convertObjectToBase64String(mockData.agentsSimWithNewAndConflicts[driverIndex])}`);
  // console.log('To je vrednost simulacije ' + driverIndex);
  // console.log(utilities.convertObjectToBase64String(mockData.agentsSimWithNetwNoAuto[driverIndex]));
  // console.log('-----------------------------------------------');
  await driver.wait(until.elementLocated(By.id('firstInput')));
  await driver.wait(until.elementLocated(By.id('secondInput')));
  await driver.wait(until.elementLocated(By.id('uuidValues')));
  await driver.wait(until.elementLocated(By.id('browserName')));
  // if (shouldDestroy) {
  //   driver.quit();
  //   return;
  // }


  // driver.quit();
  // return;


  let firstInput = await driver.findElement(By.id('firstInput'));
  await driver.wait(until.elementIsVisible(firstInput));
  let secondInput = await driver.findElement(By.id('secondInput'));
  await driver.wait(until.elementIsVisible(secondInput));
  let uuidValues = await driver.findElement(By.id('uuidValues'));
  await driver.wait(until.elementIsVisible(uuidValues));
  let browserName = await driver.findElement(By.id('browserName'));
  // await driver.wait(until.elementIsVisible(browserName));
  // await browserName.sendKeys(`${SIMLUATION_NAME}-${testData[driverIndex].agentName}`);
  let finishedLoading = await driver.findElement(By.id('loadingFinished'));
  let simulationFinished = await driver.findElement(By.id('simulationFinished'));
  
  // Zacasno zakomentirano, ker zelim preveriti kje je problem s sync_conflict bazo
  await driver.wait(until.elementIsSelected(finishedLoading));
  // await delayCustom(testData[driverIndex].timeout);
  // await uuidValues.sendKeys(v4()); //'4d3399f5-2157-487c-86e4-66f7ad04f35d');
  // await firstInput.sendKeys('Found love in 1');
  // await secondInput.sendKeys('this hopeless place 2');
  // await firstInput.sendKeys(testData[driverIndex].data.firstInput);
  // await secondInput.sendKeys(testData[driverIndex].data.secondInput);
  // let startSeleniumCustomDataButton = await driver.findElement(By.id('seleniumCustomDataButton'));
  // await startSeleniumCustomDataButton.click();
  let startSimulation = await driver.findElement(By.id('startSimulation'));
  await startSimulation.click();

  await driver.wait(until.elementIsSelected(simulationFinished));
  // let exportToBE = await driver.findElement(By.id('exportDatabaseToBE'));  
  // await exportToBE.click();
  return driver.sleep(5000).then(async () => {
    await driver.quit();
    return true;
  });
}

suite(function (env) {
  describe('First script', function () {
    this.timeout(30000); // To omogoci, da nimamo napake ze po 2 sekundah!!!
    let driver;
    let drivers = [];
    
    let numberOfClients = 5;
    // let seleniumGridURL = 'http://192.168.100.53:4444'; // on my personal mac
    let seleniumGridURL = 'http://localhost:4444';
    // let seleniumGridURL = 'http://localhost:4444';

    before(async function () {
      // driver = await new Builder().forBrowser('chrome').build();
      // driver = await new Builder().usingServer(seleniumGridURL).forBrowser('chrome').build();
      for (let i = 0; i < numberOfClients; i++) {
        // ustvari vsak driver
        // const cap = new Capabilities().setPageLoadStrategy('EAGER');
        // Capabilities

        console.log('each client iteration');
        // let driver_loc = await new Builder().usingServer(seleniumGridURL).forBrowser(Browser.CHROME).build();
        // let driver_loc = await new Builder().usingServer(seleniumGridURL).forBrowser(Browser.CHROME).build();
        let driver_loc = await new Builder().forBrowser('chrome').build();
        // await driver_loc.get(seleniumGridURL);
        drivers.push(driver_loc);
      }
      // driver = await new Builder().usingServer('http://192.168.100.53:4444').forBrowser('chrome').build(); -> uporabno ko imamo le en driver
    });

    // after(async () => await driver.quit());

    it('Starts multiple web drivers', async function () {
      for (let i = 0; i < drivers.length; i++) {
        manipulateDriver(drivers[i], i, drivers.length > 1 && i == drivers.length-1);
        // await delayCustom(1000);
      }

      console.log('Finished with all iterations', JSON.stringify(mockData.agentsData));
    });

    
  });
  // }, { browsers: [Browser.CHROME, Browser.FIREFOX]});
}, { browsers: [Browser.CHROME] });