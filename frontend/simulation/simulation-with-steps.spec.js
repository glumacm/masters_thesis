const { By, Builder, Browser, Capabilities, TimeUnit, until, ThenableWebDriver, Capability } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { suite } = require('selenium-webdriver/testing');
const assert = require("assert");
const {v4} = require('uuid');
const { delayed } = require('selenium-webdriver/lib/promise');
const mockData = require('./mock-data/data');
const utilities = require('./utilities');

const SIMLUATION_NAME = 'Offline';

/*
i =0 .... 100 odjemalcev
i % 10 == 0 => ustvari i * 10 objektov ... i= 10 => 10, i = 20 => 20, ... i= 100 => 100
i % 5 == 0 => ustvari podatek za obstojec uuid i=5 => shared uuid, i=10 shared uuid

Tako bomo sposobni narediti analizo za sync case pri razlicnih velikosti batchov
*/

function getSharedUuidByIndexValue(listOfSharedUuids, currentSharedSequenceIndex) {
  const listOfSharedUuidsLength = listOfSharedUuids.length;
  const indexToUse = currentSharedSequenceIndex % listOfSharedUuidsLength;

  return listOfSharedUuids[indexToUse];
}

function reusableUuids(numberOfReusable) {
  const reusable = [];
  for(let i = 0; i < numberOfReusable; i++) {
    reusable.push(`${v4()}_shared`);
  }

  return reusable;
}

function createTestEntityObject(clientIndex, itemIndex) {
  return {
    firstInput: `FI:${clientIndex}_${itemIndex}`,
    secondInput: `SI: ${clientIndex}_${itemIndex}`
  };
}

function createTestEntityDataForClient(clientIndex, simulationName, sharedUuids) {
  // const numberOfItems = clientIndex % 10 == 0 ? clientIndex * 10: (clientIndex == 0 ? 10 : clientIndex % 10);
  const numberOfItems = clientIndex == 0 ? 10: ((clientIndex % 10 )*5); // clientIndex % 10 == 0 ? clientIndex * 10: (clientIndex == 0 ? 10 : clientIndex % 10);
  const clientSimulationData = {
    agentId: `Odjemalec${clientIndex}`,
    simulationName: simulationName,
    steps: [],
  };
  const clientSteps = [{
    action: 'WAIT'
  }];
  let sharedUuidSequnceIndex = 0;
  for (let i =0; i < numberOfItems; i++) {
    /*
    agentId: "PrviOdjemalec",
        simulationName: "Sinh_Z_Omrezjem_Brez_Avtomatike_S_Konflikti",
        steps: [
             {
        "entityName": "testEntity",
        "action": "UPSERT",
        "data": {
            "firstInput": "Objekt1_1_1",
            "secondInput": "Objekt1_2_1"
        },
        "recordId": "147c5a00-a669-4c16-9db0-152d0705ee77"
    },
            {
                "action": "BATCH_SYNC"
            }
        ],
    */

    let recordId = v4();
    if (i % 2 == 0) {
      recordId = getSharedUuidByIndexValue(sharedUuids, sharedUuidSequnceIndex);
      sharedUuidSequnceIndex+=1;
    }

    clientSteps.push({
      agentId: clientSimulationData.agentId,
      recordId: recordId,
      action: 'UPSERT',
      entityName: 'testEntity',
      data: createTestEntityObject(clientIndex, i),
      networkStatus: null,
      objectSize: 0,
    });

  }

  clientSteps.push({action:'BATCH_SYNC'})

  clientSimulationData.steps = clientSteps;

  return clientSimulationData;

}

function createClientsData(numberOfClients, simulationName) {
  const clientsData = {};
  const reusable = reusableUuids(5);
  for (let i = 0; i <= numberOfClients; i++) {
    clientsData[i] = createTestEntityDataForClient(i, simulationName, reusable );
  }

  return clientsData;
}

function createBase64String(simulationData) {
  return utilities.convertObjectToBase64String(simulationData);
}





function delayCustom(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function manipulateDriver(driver, driverIndex, shouldDestroy, clientsData) {
  /**
   * 
   */
  // await delayCustom(1300);
  // await driver.sleep(2000);
  // Previous example of calling the simulation
  // await driver.get(`http://localhost:4200/simulation-online-with-steps/${utilities.convertObjectToBase64String(mockData.agentsData[driverIndex])}`);
  // await driver.get(`http://localhost:4200/simulation-online-with-steps/${utilities.convertObjectToBase64String(mockData.agentsSimWithNetNoAuto[driverIndex])}`);
  // await driver.get(`http://localhost:4200/simulation-online-with-steps/${utilities.convertObjectToBase64String(mockData.agentsSimWithNetAndAuto[driverIndex])}`);
  
  // Zadnje delujoce 04.09.2023
  // await driver.get(`http://localhost:4200/simulation-online-with-steps/${utilities.convertObjectToBase64String(mockData.agentsSimWithNewAndConflicts[driverIndex])}`);


  await driver.get(`http://localhost:4200/simulation-online-with-steps/${createBase64String(clientsData[driverIndex])}`);
  // console.log('what is data');
  // console.log(JSON.stringify(clientsData));
  // driver.quit();
  // return;

  // Link ki ga trenutno uporabljam za testiranje popravkov in implementacije:
  // http://localhost:4200/simulation-online-with-steps/eyJhZ2VudElkIjoiUHJ2aU9kamVtYWxlYyIsInNpbXVsYXRpb25OYW1lIjoiU2luaF9aX09tcmV6amVtX0JyZXpfQXZ0b21hdGlrZV9TX0tvbmZsaWt0aSIsInN0ZXBzIjpbeyJlbnRpdHlOYW1lIjoidGVzdEVudGl0eSIsImFjdGlvbiI6IlVQU0VSVCIsImRhdGEiOnsiZmlyc3RJbnB1dCI6Ik9iamVrdDFfMV8xIiwic2Vjb25kSW5wdXQiOiJPYmpla3QxXzJfMSJ9LCJyZWNvcmRJZCI6IjE0N2M1YTAwLWE2NjktNGMxNi05ZGIwLTE1MmQwNzA1ZWU3NyJ9LHsiZW50aXR5TmFtZSI6InRlc3RFbnRpdHkiLCJhY3Rpb24iOiJVUFNFUlQiLCJkYXRhIjp7ImZpcnN0SW5wdXQiOiJPYmpla3QyXzFfMSIsInNlY29uZElucHV0IjoiT2JqZWt0Ml8yXzEifSwicmVjb3JkSWQiOiIyMWFiYWNhYS1lMWNlLTQ3NWYtOTU3My0yMDFlNDRmNDM3YTMifSx7ImVudGl0eU5hbWUiOiJ0ZXN0RW50aXR5IiwiYWN0aW9uIjoiVVBTRVJUIiwiZGF0YSI6eyJmaXJzdElucHV0IjoiT2JqZWt0M18xXzEiLCJzZWNvbmRJbnB1dCI6Ik9iamVrdDNfMl8xIn0sInJlY29yZElkIjoiNTMzNGYzYWUtNmRiMS00YjU4LWFjM2ItNjAzY2EwMWFkODNmIn1dfQ

  /**
   * PRVI ODJEMALEC
   * http://localhost:4200/simulation-online-with-steps/eyJhZ2VudElkIjoiUHJ2aU9kamVtYWxlYyIsInNpbXVsYXRpb25OYW1lIjoiU2luaF9aX09tcmV6amVtX0JyZXpfQXZ0b21hdGlrZV9TX0tvbmZsaWt0aSIsInN0ZXBzIjpbeyJlbnRpdHlOYW1lIjoidGVzdEVudGl0eSIsImFjdGlvbiI6IlVQU0VSVCIsImRhdGEiOnsiZmlyc3RJbnB1dCI6Ik9iamVrdDFfMV8xIiwic2Vjb25kSW5wdXQiOiJPYmpla3QxXzJfMSJ9LCJyZWNvcmRJZCI6IjE0N2M1YTAwLWE2NjktNGMxNi05ZGIwLTE1MmQwNzA1ZWU3NyJ9LHsiZW50aXR5TmFtZSI6InRlc3RFbnRpdHkiLCJhY3Rpb24iOiJVUFNFUlQiLCJkYXRhIjp7ImZpcnN0SW5wdXQiOiJPYmpla3QyXzFfMSIsInNlY29uZElucHV0IjoiT2JqZWt0Ml8yXzEifSwicmVjb3JkSWQiOiIyMWFiYWNhYS1lMWNlLTQ3NWYtOTU3My0yMDFlNDRmNDM3YTMifSx7ImVudGl0eU5hbWUiOiJ0ZXN0RW50aXR5IiwiYWN0aW9uIjoiVVBTRVJUIiwiZGF0YSI6eyJmaXJzdElucHV0IjoiT2JqZWt0M18xXzEiLCJzZWNvbmRJbnB1dCI6Ik9iamVrdDNfMl8xIn0sInJlY29yZElkIjoiNTMzNGYzYWUtNmRiMS00YjU4LWFjM2ItNjAzY2EwMWFkODNmIn1dfQ
   * 
   * DRUGI ODJEMALEC
   * http://localhost:4200/simulation-online-with-steps/eyJhZ2VudElkIjoiRHJ1Z2lPZGplbWFsZWMiLCJzaW11bGF0aW9uTmFtZSI6IlNpbmhfWl9PbXJlemplbV9CcmV6X0F2dG9tYXRpa2VfU19Lb25mbGlrdGkiLCJzdGVwcyI6W3siZW50aXR5TmFtZSI6InRlc3RFbnRpdHkiLCJhY3Rpb24iOiJVUFNFUlQiLCJkYXRhIjp7ImZpcnN0SW5wdXQiOiJPYmpla3QxXzFfMiIsInNlY29uZElucHV0IjoiT2JqZWt0MV8yXzIifSwicmVjb3JkSWQiOiIxNDdjNWEwMC1hNjY5LTRjMTYtOWRiMC0xNTJkMDcwNWVlNzcifSx7ImVudGl0eU5hbWUiOiJ0ZXN0RW50aXR5IiwiYWN0aW9uIjoiVVBTRVJUIiwiZGF0YSI6eyJmaXJzdElucHV0IjoiT2JqZWt0Ml8xXzIiLCJzZWNvbmRJbnB1dCI6Ik9iamVrdDJfMl8yIn0sInJlY29yZElkIjoiMjFhYmFjYWEtZTFjZS00NzVmLTk1NzMtMjAxZTQ0ZjQzN2EzIn0seyJlbnRpdHlOYW1lIjoidGVzdEVudGl0eSIsImFjdGlvbiI6IlVQU0VSVCIsImRhdGEiOnsiZmlyc3RJbnB1dCI6Ik9iamVrdDNfMV8yIiwic2Vjb25kSW5wdXQiOiJPYmpla3QzXzJfMiJ9LCJyZWNvcmRJZCI6IjUzMzRmM2FlLTZkYjEtNGI1OC1hYzNiLTYwM2NhMDFhZDgzZiJ9LHsiYWN0aW9uIjoiQkFUQ0hfU1lOQyJ9XX0
   */
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
  // return driver.sleep(5000).then(async () => {
  return driver.sleep(2000).then(async () => {
    await driver.quit();
    return true;
  });
}

suite(function (env) {
  describe('First script', function () {
    this.timeout(30000); // To omogoci, da nimamo napake ze po 2 sekundah!!!
    let driver;
    let drivers = [];

    const screen = {
      width: 640,
      height: 480
    };
    
    let numberOfClients = 20; // 5; // 20; // 5
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
        const chromeOptions = new chrome.Options();
        // nastavitev da se ne odpre vsak window
        chromeOptions.headless().windowSize(screen);
        
        // chromeOptions.setChromeBinaryPath('/Users/matjazglumac/Documents/osebno/development/masters/magisterij-sync-lib-client-2023/simulation/chrome-114-0-5730-0-mac-arm64-binary/Chromium.app/Contents/MacOS/Chromium');
        // let driver_loc = await new Builder().forBrowser('chrome').setChromeOptions(new chrome.Options().headless().windowSize(screen)).build();
        let driver_loc = await new Builder().forBrowser('chrome').setChromeOptions(chromeOptions).build();
        // await driver_loc.get(seleniumGridURL);
        drivers.push(driver_loc);
      }
      // driver = await new Builder().usingServer('http://192.168.100.53:4444').forBrowser('chrome').build(); -> uporabno ko imamo le en driver
    });

    // after(async () => await driver.quit());

    it('Starts multiple web drivers', async function () {
      // for (let i = 0; i < drivers.length; i++) {
        const clientsData = createClientsData(numberOfClients, 'PerformanceSimulation');
      for (let i = 0; i < numberOfClients; i++) {
        // manipulateDriver(drivers[i], i, drivers.length > 1 && i == drivers.length-1);
        // manipulateDriver(drivers[0], 1, true);
        // manipulateDriver(drivers[i], i % 4, true, clientsData);
        manipulateDriver(drivers[i], i, true, clientsData);
        // await delayCustom(1000);
      }

      // console.log('Finished with all iterations', JSON.stringify(mockData.agentsData));
      console.log('Finished with all iterations', JSON.stringify(clientsData));
    });

    
  });
  // }, { browsers: [Browser.CHROME, Browser.FIREFOX]});
}, { browsers: [Browser.CHROME] });