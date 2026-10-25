const { chromium } = require('playwright');
const fs=require('fs');
const path=require('path');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
  const url='file://'+path.resolve('portfolio.html');
  fs.mkdirSync('portfolio-shots',{recursive:true});
  async function switchTo(name){
    await page.goto(url,{waitUntil:'load'});
    await page.locator('[data-tab="'+name+'"]').click();
    await page.locator('[data-screen="'+name+'"]').waitFor({state:'visible'});
    await page.evaluate(()=>document.fonts.ready);
  }
  await switchTo('home');
  await page.screenshot({path:'portfolio-shots/01-portfolio-cover.png',animations:'disabled',fullPage:false});
  await page.locator('.browser').screenshot({path:'portfolio-shots/02-desktop-homepage.png',animations:'disabled'});
  await switchTo('weeks');
  await page.locator('.browser').screenshot({path:'portfolio-shots/03-weekly-practice.png',animations:'disabled'});
  await switchTo('mobile');
  await page.locator('.phone').screenshot({path:'portfolio-shots/04-mobile-responsive.png',animations:'disabled'});
  await switchTo('teacher');
  await page.locator('.browser').screenshot({path:'portfolio-shots/05-teacher-dashboard.png',animations:'disabled'});
  console.log('Wrote five privacy-safe portfolio screenshots');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
