const { Builder, By, Key, until } = require('selenium-webdriver');
const axios = require('axios');

// Function to fetch OTP from the API using email and password
async function getOtpFromApi(email, password) {
  let retries = 5; // Number of retries
  let otp = null;
  
  try {
    for (let attempt = 1; attempt <= retries; attempt++) {
      console.log(`Attempt ${attempt}: Requesting OTP for email: ${email}`);
      const response = await axios.post('http://localhost:3000/latest-otps', {
        emails: [{ email: email, password: password }]
      });

      // Extract OTP from the response object
      if (response.status === 200 && response.data && response.data[email]) {
        otp = response.data[email]?.otp;  // Fetch OTP from the email key
        if (otp) {
          console.log(`OTP received: ${otp}`);
          return otp; // Return OTP if found
        } else {
          console.error('OTP not found in the response');
        }
      }

      // Retry after 3 seconds if OTP is not found
      console.log('Retrying in 3 seconds...');
      await sleep(3000); 
    }
  } catch (error) {
    console.error('Error fetching OTP:', error);
  }
  return null; // Return null if no OTP is fetched after retries
}

// Function to automate browser and retrieve the token
async function getToken(email, password) {
  let driver;
  try {
    console.log('Initializing WebDriver...');
    // Initialize WebDriver (Make sure you have ChromeDriver installed)
    driver = await new Builder().forBrowser('chrome').build();

    // Go to the form page
    console.log('Navigating to the website...');
    await driver.get('https://bless.network/dashboard?ref=Y06FN1');

    console.log('Waiting for email input field...');
    // Enter the email in the email input field
    await driver.wait(until.elementLocated(By.id('email')), 10000);
    let emailInput = await driver.findElement(By.id('email'));
    console.log('Entering email...');
    await emailInput.sendKeys(email);
    
    // Press 'Tab' and 'Enter' to submit the form
    console.log('Submitting the form...');
    await emailInput.sendKeys(Key.TAB, Key.RETURN);
    
    // Wait for OTP input window to pop up
    console.log('Waiting for OTP input window...');
    await sleep(20000);  // Allow 20 seconds for OTP to arrive

    // Call the API to get the OTP
    console.log('Calling API to get OTP...');
    let otp = await getOtpFromApi(email, password);

    // If OTP is found, proceed to fill it in the OTP field
    if (otp !== null) {
      console.log('OTP found, filling in the OTP...');
      // Switch to the OTP input window (pop-up)
      let windows = await driver.getAllWindowHandles();
      console.log('Switching to OTP input window...');
      await driver.switchTo().window(windows[1]);

      // Wait for OTP input to appear and fill in the OTP
      await driver.wait(until.elementLocated(By.xpath('//*[@id="app"]/div/div/div/div/div[3]/div/form/input[1]')), 7000);
      let otpInput = await driver.findElement(By.xpath('//*[@id="app"]/div/div/div/div/div[3]/div/form/input[1]'));
      await otpInput.sendKeys(otp);

      // Switch back to the main window
      console.log('Switching back to main window...');
      await driver.switchTo().window(windows[0]);

      // Wait for the dashboard to load
      console.log('Waiting for dashboard to load...');
      await driver.wait(until.elementLocated(By.xpath('/html/body/div/main/div/div[1]/h1')), 999999);
      
      // Optionally, refresh the page if necessary
      console.log('Refreshing the page...');
      await driver.navigate().refresh();
      
      // After seeing the dashboard, start refreshing until the token is found
      let token = null;
      let attempts = 0;
      
      while (attempts < 100) {
        // Sleep for 5 seconds before checking for the token
        await sleep(5000);
        
        // Extract the token from localStorage
        token = await driver.executeScript('return window.localStorage.getItem("B7S_AUTH_TOKEN");');
        
        // Check if the token is found and not equal to 'ERROR'
        if (token && token !== 'ERROR') {
          console.log('Token from localStorage:', token);
          break;  // Exit the loop when a valid token is found
        } else {
          console.log('Token not found or is ERROR, retrying...');
        }
        
        // Refresh the page and retry
        await driver.navigate().refresh();
        attempts++;
      }
      
      if (attempts === 100) {
        console.log('Token not found after 100 attempts.');
        throw new Error('Token not found after 100 attempts');
      }

      // Return the token
      return token;
    } else {
      throw new Error('OTP not found');
    }

  } catch (err) {
    console.error('Error in script execution:', err);
    throw new Error('Internal server error');
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
}

// Utility function to pause execution for a specified amount of time
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { getToken }; // Export the function for use in app.js
