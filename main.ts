import { Page, BrowserContext, Stagehand } from "@browserbasehq/stagehand";
import { INVALID, z } from "zod";
import chalk from "chalk";
import dotenv from "dotenv";
import { actWithCache, drawObserveOverlay, clearOverlays } from "./utils.js";
import StagehandConfig from "./stagehand.config.js";

dotenv.config();

interface UserPreferences {
  lowPrice?: boolean;
  fastDelivery?: boolean;
}
interface Product {
  name: string;
  price: string;
  availability: string;
  unitOfMeasure: string;
  deliveryTime: string;
}

const totalProducts: Product[][] = [];
const productNames = ['gloves', 'Respiratory'];
const productID = [];
const productDescription = [{ color: 'red', size: 'medium' }];
const unitOfMeasure = 'box';
const userPreference: UserPreferences = { lowPrice: true, fastDelivery: false };

const maxAttempts = 2;
let intervalID: NodeJS.Timeout;

const vendorWebsitesFeature = [
  {
    url: 'https://www.vitalitymedical.com/', // succeed
    unexpectedPage: `id='ctabutton1'`,
    searchBtn: '',
    nextBtn:
      'action  next relative inline-flex items-center text-sm font-medium leading-5 bg-white transition duration-150 ease-in-out hover:text-primary focus:z-10 focus:text-primary rounded-r-md px-3 py-2 text-gray-500',
  },
  {
    url: 'https://mms.mckesson.com/shop-products', // succeed, note: no nextBtn
    unexpectedPage: '',
    searchBtn: 'search',
    nextBtn: '',
  },
  {
    url: 'https://mfimedical.com/', // succeed
    unexpectedPage: '',
    searchBtn: '',
    nextBtn: '',
  },
  {
    url: 'https://tigermedical.com/', // succeed in gpt-4o-mini
    unexpectedPage: '',
    searchBtn: '',
    nextBtn:
      'pagination--next',
  },
  {
    url: 'https://wilburnmedicalusa.com/', // succeed
    unexpectedPage: '',
    searchBtn: '',
    nextBtn: '',
  },
  {
    url: 'https://www.amtouch.com/',
    unexpectedPage:
      `class='PopupCloseButton__InnerPopupCloseButton-sc-srj7me-0 gjrgdL wisepops-close'`,
    searchBtn: '',
    nextBtn:
      'ss__pagination__column ss__pagination__next nxt-pages-next',
  },
  {
    url: 'https://www.labsource.com/', // succeed
    unexpectedPage: `class='_close'`,
    searchBtn: '',
    nextBtn:
      'click element matching selector a:has-text("»")',
  },
  {
    url: 'https://www.henryschein.com/us-en/medical/default.aspx?did=medical&stay=1', // succeed
    unexpectedPage: '',
    searchBtn: '',
    nextBtn: 'hs-paging-next',
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
  
  // Loop through vendor websites
  
  for (const vendorWebFeature of vendorWebsitesFeature) {
  // const vendorWebFeature = vendorWebsitesFeature[0];
    const vendorPage = page;
    try {
      await vendorPage.goto(vendorWebFeature.url, {
        timeout: 60000,
        waitUntil: 'load',
      });
    } catch (e) {
      console.log(e);
    }
    await vendorPage.setViewportSize({ width: 1800, height: 800 });
    let attempt = vendorWebFeature.unexpectedPage ? 0 : 1 , searchStatus;
    console.log('attempt : ' , attempt);
    clearInterval(intervalID);
    await Promise.all([
      (async () => {
        if (vendorWebFeature.unexpectedPage) {
          await searchUnexpectedPage(vendorWebFeature.unexpectedPage, vendorPage);
          intervalID = setInterval(async () => {
            await searchUnexpectedPage(vendorWebFeature.unexpectedPage, vendorPage);
          }, 3000);
        }
      })(),

      (async () => {
        while (attempt < maxAttempts) {
          try {
            if (vendorWebFeature.searchBtn) {
              await vendorPage.click(`[class*='${vendorWebFeature.searchBtn}']`);
              const searchBtnClick = await vendorPage.act({
                action: `type '${productNames[0]}' search input field`,
              });
              await vendorPage.act({
                action: `press keyboard enter`,
              });
              console.log('searchBtn:', searchBtnClick);
              break;
            } else {
              searchStatus = await vendorPage.act({
                action: `find search input field and type '${productNames[0]}' and press keyboard enter`,
              });
              if (searchStatus.success) console.log(searchStatus);
              else throw new Error(`Can't find search input field`);
            }
          } catch (error) {
            console.log(error);
          }
          attempt++;
        }
        console.log(chalk.yellow('Search Input Field: succeed'));
        await vendorPage.waitForTimeout(1000);

        let nextStatus, products , next;
        let nextPageExists = false;

        do {
          nextPageExists = false;
          products = await vendorPage.extract({
            instruction:
              'Extract all products within products grid. For each product, capture the name, price (only numeric value, e.g., $15.99), availability, unit of measure, and delivery time',
            schema: z.object({
              list_of_products: z.array(
                z.object({
                  name: z.string(),
                  price: z.string(),
                  availability: z.string(),
                  unitOfMeasure: z.string(),
                  deliveryTime: z.string(),
                })
              ),
            }),
          });

          console.log(chalk.cyan('Get Products: succeed'));
          await vendorPage.waitForTimeout(1000);

          if (vendorWebFeature.nextBtn) {
            try {
              if (vendorWebFeature.nextBtn.includes('click')) {
                nextStatus = await vendorPage.act({
                  action: vendorWebFeature.nextBtn,
                });
              } else {
                await vendorPage.click(`[class='${vendorWebFeature.nextBtn}']`);
                next = true;
              }
              if (nextStatus?.success || next) {
                nextPageExists = true;
              }
            } catch (e) {
              console.log(e);
              break;
            }
          }
          console.log('Go to the next page:', nextStatus?.success , next);
          totalProducts.push(products.list_of_products);
          await vendorPage.waitForTimeout(1000);
        } while (nextPageExists);
      })(),
    ]);
    await vendorPage.waitForTimeout(1000);
  }

  console.log(chalk.green('Vendor Results:'));
  console.log('Data of Products is:', totalProducts);
}


async function searchUnexpectedPage(name: string, page: Page) {
  console.log(chalk.yellow(name));
  try{
    const element = await page.$(`[${name}]`);
    if (element) {
      clearInterval(intervalID);
      const u_Page = await element.click();
      console.log(chalk.yellow(u_Page));
    } else {
      console.log(chalk.yellow(`Element with class ${name} not found.`));
    }
  }catch(error){
    console.log(error);
  }
}
