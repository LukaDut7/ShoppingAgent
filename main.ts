import { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import chalk from "chalk";
import dotenv from "dotenv";
import { actWithCache, drawObserveOverlay, clearOverlays } from "./utils.js";

dotenv.config();

interface UserPreferences {
  lowPrice?: boolean;
  fastDelivery?: boolean;
}

interface VendorResult {
  name : string;
  price: string;
  unitOfMeasure: string;
  availability: string;
  deliveryTime?: string;
  dateChecked: string;
}

const vendorWebsites = [
  { name: 'McKesson', url: 'https://www.labsource.com/' },
  // https://www.vitalitymedical.com/
  // https://mms.mckesson.com/shop-products
  // https://mfimedical.com/
  // https://tigermedical.com/
  // https://wilburnmedicalusa.com/
  // https://www.amtouch.com/     fail unexpected page 
  // https://www.labsource.com/   fail unexpected page
  // https://www.henryschein.com/us-en/medical/default.aspx?did=medical&stay=1    fail next page
];
const productNames = ['gloves', 'Respiratory'];
const productID = [];
const productDescription = [{ color: 'red', size: 'medium' }];
const unitOfMeasure = 'box';
const userPreference: UserPreferences = { lowPrice: true, fastDelivery: false };
let nextStatus;
let products;
export async function main({
  page,
  context,
  stagehand,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
}) {
  const result = [];
  const today = new Date().toISOString();

  // Loop through vendor websites
  for (const vendor of vendorWebsites) {
    await page.goto(vendor.url, { timeout: 60000, waitUntil: 'load' });

      let status;
      let attempt = 0;
      const maxAttempts = 5;
      var searchStatus;
      while(attempt < maxAttempts){
        try{
          // const adElement = await page.act({
          //   action: "find advertisement popup element that appears unexpectedly and press keyboard enter",
          //   useVision: true,
          // });
          // console.log("Unexpected advertisement detected:", adElement);
          await page.setViewportSize({width : 1800, height : 800});
          
            searchStatus = await page.act({ 
              action : `find search input field`,
            });
            if(searchStatus.success){
              const typeProductName = await page.act({
                action :  `type '${productNames[0]}' in search input field and press keyboard enter`,
              });
            }
          console.log(searchStatus);
          // if(!searchStatus.success){
          //     await page.click("[class*='search']");
          //     searchStatus = await page.act({
          //       action: `type '${productNames[0]}' search input field and press keyboard enter`
          //     });
          //     console.log(searchStatus);
          // }
          
          if(searchStatus.success)
            break;
          else throw new Error('This is search error');
          
        } catch(error){
          console.error("Search action failed (possibly due to an ad):", error);
          try {
            await page.act({
              action: `press keyboard enter section:has-text("product")`,
              useVision: true,
            });
            await page.waitForTimeout(1000);
          } catch (dismissError) {
            console.error("Could not dismiss advertisement:", dismissError);
          }
        }
        attempt++;
      }

      console.log(chalk.yellow('Succeed search input field'));
      // await drawObserveOverlay(page, searchResults);
      // await page.waitForTimeout(1000);
      // await clearOverlays(page);
      
      // await page.act(searchResults[0]);
    // }
    // Optionally handle further interactions if needed
    // await actWithCache(page, "press keyboard enter to use AI");
    await page.waitForTimeout(2000);
    // const findProducts = await page.observe({
    //   instruction: 'find all products within element matching selector section:has-text("product")',
    // });
    // console.log(findProducts);
    // await drawObserveOverlay(page, findProducts);
    //   await page.waitForTimeout(1000);
    //   await clearOverlays(page);
    do {
      const findProducts = await page.observe({
        instruction: 'find all products within element matching selector section:has-text("product")',
      });
      console.log(findProducts);
      products = await page.extract({
        instruction : `Extract product listings. For each product, capture the name, price (only numeric value, e.g., $15.99), availability, unit of measure, and delivery time `,
        schema: z.object({
          list_of_apartments: z.array(
            z.object({
              name : z.string(),
              price : z.string(),
              availability : z.string(),
              unitOfMeasure : z.string(),
              deliveryTime : z.string(),
            })
          ),
        }),
      })
      console.log(chalk.cyan('Succeed All Product'));
      await page.waitForTimeout(1000);
      nextStatus = await page.act({
        action: 'click element matching selector a:has-text("Next") or a:has-text("next")',
      });

      // if(!nextStatus.success){
      //   await page.click("[class*='next']");
      //   nextStatus = await page.act({
      //     action: 'press keyboard enter',
      //   });
      // }
      console.log(nextStatus);
      result.push(products.list_of_apartments);

    }while(nextStatus.success);

    // products.list_of_apartments = products.list_of_apartments.filter(item => item.name == productNames[0]);
    // products.list_of_apartments = products.list_of_apartments.filter(item => item.unitOfMeasure === unitOfMeasure);
  }
  // if (result.length > 0) {
  //   if (userPreference.lowPrice) {
  //     result.sort((a, b) => {
  //       const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ""));
  //       const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ""));
  //       return priceA - priceB;
  //     });
  //   }
  //   if(userPreference.fastDelivery){
  //     products.list_of_apartments.sort((a, b) => {
  //       const daysA = a.deliveryTime ? parseInt(a.deliveryTime) : Infinity;
  //       const daysB = b.deliveryTime ? parseInt(b.deliveryTime) : Infinity;
  //       return daysA - daysB;
  //     });
  //   }
  // }
  console.log(chalk.yellow("vendor websites:"));
  console.log("list of vendor websites is : ", vendorWebsites);
  console.log(chalk.green("Vendor Comparison Results:"));
  console.log("products data is : ", result);
}
