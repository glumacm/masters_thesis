const { By, Builder, Browser, Capabilities, TimeUnit, until, ThenableWebDriver, Capability } = require('selenium-webdriver');
const { suite } = require('selenium-webdriver/testing');
const assert = require("assert");
const {v4} = require('uuid');
const { delayed } = require('selenium-webdriver/lib/promise');

const SIMLUATION_NAME = 'Online';

const testData = {
  1: {
    data: {
      firstInput: 'LetYouGo',
      secondInput: 'AllIReallyCare',
    },
    timeout: 0,
    agentName: 'AgentBond001'
  },
  2: {
    data: {
      firstInput: 'OneLastTime',
      secondInput: 'IneedToBe',
    },
    timeout: 0,
    agentName: 'AgentBond002'
  },
  3: {
    data: {
      firstInput: 'WhoDat',
      secondInput: 'Nobody!',
    },
    timeout: 0,
    agentName: 'AgentBond003s'
  },
  4: {
    data: {
      firstInput: 'OneLastTime',
      secondInput: 'IneedToBe',
    },
    timeout: 0,
    agentName: 'AgentBond004s'
  },
}



function delayCustom(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function manipulateDriver(driver, driverIndex, shouldDestroy) {
  /**
   * 
   */
  // await delayCustom(1300);
  // await driver.sleep(2000);
  console.log('we wree strinkng');
  await driver.get('http://localhost:4200/simulation-online');
  await driver.wait(until.elementLocated(By.id('firstInput')));
  await driver.wait(until.elementLocated(By.id('secondInput')));
  await driver.wait(until.elementLocated(By.id('uuidValues')));
  await driver.wait(until.elementLocated(By.id('browserName')));
  // if (shouldDestroy) {
  //   driver.quit();
  //   return;
  // }
  console.log('Yep i am here');
  let firstInput = await driver.findElement(By.id('firstInput'));
  await driver.wait(until.elementIsVisible(firstInput));
  let secondInput = await driver.findElement(By.id('secondInput'));
  await driver.wait(until.elementIsVisible(secondInput));
  let uuidValues = await driver.findElement(By.id('uuidValues'));
  await driver.wait(until.elementIsVisible(uuidValues));
  let browserName = await driver.findElement(By.id('browserName'));
  await driver.wait(until.elementIsVisible(browserName));
  await browserName.sendKeys(`${SIMLUATION_NAME}-${testData[driverIndex].agentName}`);
  let finishedLoading = await driver.findElement(By.id('loadingFinished'));
  let simulationFinished = await driver.findElement(By.id('simulationFinished'));
  
  // Zacasno zakomentirano, ker zelim preveriti kje je problem s sync_conflict bazo
  await driver.wait(until.elementIsSelected(finishedLoading));
  // await delayCustom(testData[driverIndex].timeout);
  console.log('AMPAK DRUGIC PA PRIDEMO VSI?');
  await uuidValues.sendKeys(v4()); //'4d3399f5-2157-487c-86e4-66f7ad04f35d');
  // await firstInput.sendKeys('Found love in 1');
  // await secondInput.sendKeys('this hopeless place 2');
  await firstInput.sendKeys(testData[driverIndex].data.firstInput);
  await secondInput.sendKeys(testData[driverIndex].data.secondInput);
  let startSeleniumCustomDataButton = await driver.findElement(By.id('seleniumCustomDataButton'));
  await startSeleniumCustomDataButton.click();


  console.log('OLe we are somewhere');
  await driver.wait(until.elementIsSelected(simulationFinished));
  // let exportToBE = await driver.findElement(By.id('exportDatabaseToBE'));  
  // await exportToBE.click();
  console.log('I will never let you down');
  return driver.sleep(20000).then(async () => {
    await driver.quit();
    return true;
  });
}

suite(function (env) {
  describe('First script', function () {
    this.timeout(30000); // To omogoci, da nimamo napake ze po 2 sekundah!!!
    let driver;
    let drivers = [];
    
    let numberOfClients = 4;
    // let seleniumGridURL = 'http://192.168.100.53:4444'; // on my personal mac
    let seleniumGridURL = 'http://localhost:4444';
    // let seleniumGridURL = 'http://localhost:4444';

    before(async function () {
      console.log('pictuers of laast night');
      // driver = await new Builder().forBrowser('chrome').build();
      driver = await new Builder().usingServer(seleniumGridURL).forBrowser('chrome').build();
      for (let i = 0; i < numberOfClients; i++) {
        // ustvari vsak driver
        // const cap = new Capabilities().setPageLoadStrategy('EAGER');
        // Capabilities

        console.log('said they gonna stop');
        // let driver_loc = await new Builder().usingServer(seleniumGridURL).forBrowser(Browser.CHROME).build();
        // let driver_loc = await new Builder().usingServer(seleniumGridURL).forBrowser(Browser.CHROME).build();
        let driver_loc = await new Builder().forBrowser('chrome').build();
        // await driver_loc.get(seleniumGridURL);
        drivers.push(driver_loc);
      }
      console.log('do it all again');
      // driver = await new Builder().usingServer('http://192.168.100.53:4444').forBrowser('chrome').build(); -> uporabno ko imamo le en driver
    });

    // after(async () => await driver.quit());

    it('Starts multiple web drivers', async function () {
      for (let i = 0; i < drivers.length; i++) {
        manipulateDriver(drivers[i], i, drivers.length > 1 && i == drivers.length-1);
        // await delayCustom(1000);
      }
    });

    // it('First Selenium script', async function () {
    //   await driver.get('http://localhost:4200/simulation');

    //   let title = await driver.getTitle();
    //   console.log('I promise');
    //   // assert.equal("Web form", title);

    //   let firstInput = await driver.findElement(By.id('firstInput'));
    //   let secondInput = await driver.findElement(By.id('secondInput'));

    //   let finishedLoading = await driver.findElement(By.id('loadingFinished'));
    //   // let yes = await finishedLoading.isSelected();
    //   // console.log('wwe  make it move   ', yes);
    //   // await driver.wait(until.elementIsSelected(driver.findElement(By.id('loadingFinished'))));
    //   console.log('we work hard');
    //   await driver.wait(until.elementIsSelected(finishedLoading));
    //   console.log('play hard!!!!');
    //   await firstInput.sendKeys('Selenijum for last finish');
    //   await secondInput.sendKeys('Selenijum for last finish - WORK HARD!!!!');

    //   let startSeleniumCustomDataButton = await driver.findElement(By.id('seleniumCustomDataButton'));
    //   // await firstInput.focusOut();


    //   await startSeleniumCustomDataButton.click();


    //   // driver.manage().timeouts().implicitlyWait(7, TimeUnit.SECONDS);
    //   // await driver.manage().setTimeouts( { implicit: 10000 } );
    //   // await driver.sleep(4000);
    //   // await delayCustom(4000);
    //   return driver.sleep(22000).then(async () => {
    //     console.log('WE work hard play hard');
    //     await driver.quit();
    //     return true;
    //   });

    //   // let textBox = await driver.findElement(By.name('my-text'));
    //   // let submitButton = await driver.findElement(By.css('button'));

    //   // await textBox.sendKeys('Selenium');
    //   // await submitButton.click();

    //   // let message = await driver.findElement(By.id('message'));
    //   // let value = await message.getText();
    //   // assert.equal("Received!", value);
    // });
  });
  // }, { browsers: [Browser.CHROME, Browser.FIREFOX]});
}, { browsers: [Browser.CHROME] });