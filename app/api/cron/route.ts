import { NextResponse } from "next/server";

import { getLowestPrice, getHighestPrice, getAveragePrice, getEmailNotifType } from "@/lib/utils";
import { connectToDB } from "@/lib/mongoose";
import Product from "@/lib/models/product.model";
import { scrapeAmazonProduct } from "@/lib/scraper";
import { generateEmailBody, sendEmail } from "@/lib/nodemailer";

export const maxDuration = 300; // This function can run for a maximum of 300 seconds
export const dynamic = "force-dynamic";
export const revalidate = 0;


export async function GET(request: Request) {
  try {
    await connectToDB();

    const products = await Product.find({});
    if (!products) throw new Error("No product fetched");

    const deletedProducts: { url: string; reason: string }[] = [];
    const updatedProducts: any[] = [];

    for (const currentProduct of products) {
      const scrapedProduct = await scrapeAmazonProduct(currentProduct.url);

      // If scraper flagged deletion
      if (scrapedProduct && (scrapedProduct as any).deleted) {
        const { url, reason } = scrapedProduct as { url: string; reason: string; deleted: true };
        await Product.deleteOne({ url });
        deletedProducts.push({ url, reason });
        continue;
      }

      // If scraper failed completely
      if (!scrapedProduct) {
        await Product.deleteOne({ url: currentProduct.url });
        deletedProducts.push({ url: currentProduct.url, reason: "UNKNOWN_ERROR" });
        continue;
      }

      // === Valid product ===
      const updatedPriceHistory = [
        ...currentProduct.priceHistory,
        { price: scrapedProduct.currentPrice },
      ];

      const productData = {
        ...scrapedProduct,
        priceHistory: updatedPriceHistory,
        lowestPrice: getLowestPrice(updatedPriceHistory),
        highestPrice: getHighestPrice(updatedPriceHistory),
        averagePrice: getAveragePrice(updatedPriceHistory),
      };

      const updatedProduct = await Product.findOneAndUpdate(
        { url: productData.url },
        productData,
        { new: true }
      );

      // === Email notifications (only for valid products) ===
if (scrapedProduct && !("deleted" in scrapedProduct)) {
  const emailNotifType = getEmailNotifType(scrapedProduct, currentProduct);
  if (emailNotifType && updatedProduct.users.length > 0) {
    const productInfo = { title: updatedProduct.title, url: updatedProduct.url };
    const emailContent = await generateEmailBody(productInfo, emailNotifType);
    const userEmails = updatedProduct.users.map((user: any) => user.email);
    await sendEmail(emailContent, userEmails);
  }
}


      updatedProducts.push(updatedProduct);
    }

    return NextResponse.json({
      message: "Ok",
      updatedProducts,
      deletedProducts,
    });
  } catch (error: any) {
    throw new Error(`Failed to get all products: ${error.message}`);
  }
}




// export async function GET(request: Request) {
//   try {
//     connectToDB();

//     const products = await Product.find({});

//     if (!products) throw new Error("No product fetched");

//     // ======================== 1 SCRAPE LATEST PRODUCT DETAILS & UPDATE DB
//     const updatedProducts = await Promise.all(
//       products.map(async (currentProduct) => {
//         // Scrape product
//         const scrapedProduct = await scrapeAmazonProduct(currentProduct.url);

//         if (!scrapedProduct) return;

//         const updatedPriceHistory = [
//           ...currentProduct.priceHistory,
//           {
//             price: scrapedProduct.currentPrice,
//           },
//         ];

//         const product = {
//           ...scrapedProduct,
//           priceHistory: updatedPriceHistory,
//           lowestPrice: getLowestPrice(updatedPriceHistory),
//           highestPrice: getHighestPrice(updatedPriceHistory),
//           averagePrice: getAveragePrice(updatedPriceHistory),
//         };

//         // Update Products in DB
//         const updatedProduct = await Product.findOneAndUpdate(
//           {
//             url: product.url,
//           },
//           product
//         );

//         // ======================== 2 CHECK EACH PRODUCT'S STATUS & SEND EMAIL ACCORDINGLY
//         const emailNotifType = getEmailNotifType(
//           scrapedProduct,
//           currentProduct
//         );

//         if (emailNotifType && updatedProduct.users.length > 0) {
//           const productInfo = {
//             title: updatedProduct.title,
//             url: updatedProduct.url,
//           };
//           // Construct emailContent
//           const emailContent = await generateEmailBody(productInfo, emailNotifType);
//           // Get array of user emails
//           const userEmails = updatedProduct.users.map((user: any) => user.email);
//           // Send email notification
//           await sendEmail(emailContent, userEmails);
//         }

//         return updatedProduct;
//       })
//     );

//     return NextResponse.json({
//       message: "Ok",
//       data: updatedProducts,
//     });
//   } catch (error: any) {
//     throw new Error(`Failed to get all products: ${error.message}`);
//   }
// }
