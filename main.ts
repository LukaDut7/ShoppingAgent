import { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import chalk, { colorNames } from "chalk";
import dotenv from "dotenv";
import { actWithCache, drawObserveOverlay, clearOverlays } from "./utils.js";
import StagehandConfig from "./stagehand.config.js";

dotenv.config();


interface UserPreferences {
  lowPrice?: boolean;
  fastDelivery?: boolean;
}

const productNames = ['gloves', 'Respiratory'];
const productID = [];
const productDescription = [{ color: 'red', size: 'medium' }];
const unitOfMeasure = 'box';
const userPreference: UserPreferences = { lowPrice: true, fastDelivery: false };

let products;
const maxAttempts = 2;


const vendorWebsitesFeature = [
  {
    url : 'https://www.vitalitymedical.com/',             //succeed   
    unexpectedPage : '',
    searchBtn : '',
    nextBtn : 'action  next relative inline-flex items-center text-sm font-medium leading-5 bg-white transition duration-150 ease-in-out hover:text-primary focus:z-10 focus:text-primary rounded-r-md px-3 py-2 text-gray-500',
  },
  {
    url : 'https://mms.mckesson.com/shop-products',       // succeed , note : no nextBtn
    unexpectedPage : '',
    searchBtn : 'search',
    nextBtn : '',
  },
  {
    url : 'https://mfimedical.com/',                      // succeed
    unexpectedPage : '',
    searchBtn : '',
    nextBtn : '',
  },
  {
    url : 'https://tigermedical.com/',                    // succeed in gpt-4o-mini
    unexpectedPage : '',
    searchBtn : '',
    nextBtn : 'click element matching selector a:has-text("Next") or a:has-text("next")',
  },
  {
    url : 'https://wilburnmedicalusa.com/',              //succeed
    unexpectedPage : '',
    searchBtn : '',
    nextBtn : '',
  },
  {
    url : 'https://www.amtouch.com/',
    unexpectedPage : '',
    searchBtn : '',
    nextBtn : 'click element matching selector a:has-text("Next") or a:has-text("next")',
  },
  {
    url : 'https://www.labsource.com/',                      //succeed
    unexpectedPage : '_close',
    searchBtn : '',
    nextBtn : 'click element matching selector a:has-text("»")',
  },
  {
    url : 'https://www.henryschein.com/us-en/medical/default.aspx?did=medical&stay=1',     //succeed
    unexpectedPage : '',
    searchBtn : '',
    nextBtn : 'hs-paging-next',
  },
];


export async function main({
  page,
  context,
  stagehand,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
}) {

  const totalProducts = [];
  // Loop through vendor websites
  for(const vendorWebFeature of vendorWebsitesFeature){
  // const vendorWebFeature = vendorWebsitesFeature[6];
    try{
       await page.goto(vendorWebFeature.url, { timeout: 60000, waitUntil: 'load' });
    }catch(e){
      console.log(e);
    }
    await page.setViewportSize({width : 1800, height : 800});
    let attempt = 0 , searchStatus;
    while(attempt < maxAttempts){
      try{

        if(vendorWebFeature.unexpectedPage){
          const clickCloseBtn = await page.click(`[class='${vendorWebFeature.unexpectedPage}']`);
          console.log('Result of the upexpected page : ',clickCloseBtn);
        }

        if(vendorWebFeature.searchBtn){

          await page.click(`[class*='${vendorWebFeature.searchBtn}']`);
          const searchBtnClick = await page.act({
            action : `type '${productNames[0]}' search input field and press keyboard enter `
          })
          console.log('searchBtn : ' , searchBtnClick);
          break;

        }else{
          searchStatus = await page.act({
            action : `find search input field and type '${productNames[0]}' and press keyboard enter`,
          })

          console.log(searchStatus);
          if(searchStatus.success) break;
          else throw new Error(`Can't Find Search Input Field`);

        }
      }catch(error){

        console.log(error);
        // try{
        //   const clickCloseBtn = await page.click(`[class='${vendorWebFeature.unexpectedPage}']`);
        //   console.log('Result of the upexpected page : ',clickCloseBtn);
        // }catch(e){
        //   console.log(e);
        // }
      }

      attempt++;
    }

    console.log(chalk.yellow('Search Input Field : succeed'));
    await page.waitForTimeout(1000);

    var  nextStatus  , products;

    do{
      var nextpage = 0;

      products = await page.extract({
        instruction : `Extract all products within element matching selector section:has-text("product"). For each product, capture the name, price (only numeric value, e.g., $15.99), availability, unit of measure, and delivery time `,
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

      console.log(chalk.cyan('Get Products : succeed'));
      await page.waitForTimeout(1000);
      try{
        console.log(vendorWebFeature.nextBtn.indexOf("click"));
        if(vendorWebFeature.nextBtn.indexOf("click") == -1) throw new Error('Skip');
        nextStatus = await page.act({
          action: `${vendorWebFeature.nextBtn}`,
       });
       if(!nextStatus.success) throw new Error('failed to click next button');

      }catch(e){
        console.log(e);
        try{
          await page.click(`[class = '${vendorWebFeature.nextBtn}']`);
          nextpage = 1;

        }catch(error){
          console.log(error);
          break;
        }
      }
      console.log('Go to the next page : ' , nextStatus);
      totalProducts.push(products.list_of_apartments);
      if(nextStatus?.success) nextpage = 1;
      await page.waitForTimeout(1000);
    }while(nextpage)
  }

  console.log(chalk.green('Vendor Results :'));
  console.log('Data of Produts is : ' , totalProducts);
}