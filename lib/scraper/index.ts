import axios from 'axios';
import * as cheerio from 'cheerio';
import { extractCurrency, extractDescription, extractPrice } from '../utils';

export async function scrapeAmazonProduct(url: string) {
  if (!url) return null;

  // BrightData proxy configuration
  const username = String(process.env.BRIGHT_DATA_USERNAME);
  const password = String(process.env.BRIGHT_DATA_PASSWORD);
  const port = 33335;
  const session_id = (1000000 * Math.random()) | 0;

  const options = {
    auth: {
      username: `${username}-session-${session_id}`,
      password,
    },
    host: 'brd.superproxy.io',
    port,
    rejectUnauthorized: false,
  };

  try {
    const response = await axios.get(url, options);
    const $ = cheerio.load(response.data);

    // === Soft 404 detection ===
    const hasNoTitle = !$('#productTitle').length;
    const has404Header = $('h4, h1').text().toLowerCase().includes('looking for something');
    const has404Message = $('.a-spacing-top-base').text().toLowerCase().includes('not a functioning page');

    if (hasNoTitle) {
      console.log(`Soft 404 detected (NO_TITLE) for URL: ${url}`);
      return { deleted: true, reason: "SOFT_404_NO_TITLE" };
    }
    if (has404Header) {
      console.log(`Soft 404 detected (HEADER_MATCH) for URL: ${url}`);
      return { deleted: true, reason: "SOFT_404_HEADER_MATCH" };
    }
    if (has404Message) {
      console.log(`Soft 404 detected (MESSAGE_MATCH) for URL: ${url}`);
      return { deleted: true, reason: "SOFT_404_MESSAGE_MATCH" };
    }

    // Extract the product title
    const title = $('#productTitle').text().trim();
    const currentPrice = extractPrice(
      $('.priceToPay span.a-price-whole'),
      $('.a.size.base.a-color-price'),
      $('.a-button-selected .a-color-base')
    );

    const originalPrice = extractPrice(
      $('#priceblock_ourprice'),
      $('.a-price.a-text-price span.a-offscreen'),
      $('#listPrice'),
      $('#priceblock_dealprice'),
      $('.a-size-base.a-color-price')
    );

    const outOfStock =
      $('#availability span').text().trim().toLowerCase() === 'currently unavailable';

    const images =
      $('#imgBlkFront').attr('data-a-dynamic-image') ||
      $('#landingImage').attr('data-a-dynamic-image') ||
      '{}';

    const imageUrls = Object.keys(JSON.parse(images));

    const currency = extractCurrency($('.a-price-symbol'));
    const discountRate = $('.savingsPercentage').text().replace(/[-%]/g, '');
    const description = extractDescription($);

    return {
      url,
      currency: currency || '$',
      image: imageUrls[0],
      title,
      currentPrice: Number(currentPrice) || Number(originalPrice),
      originalPrice: Number(originalPrice) || Number(currentPrice),
      priceHistory: [],
      discountRate: Number(discountRate),
      category: 'category',
      reviewsCount: 100,
      stars: 4.5,
      isOutOfStock: outOfStock,
      description,
      lowestPrice: Number(currentPrice) || Number(originalPrice),
      highestPrice: Number(originalPrice) || Number(currentPrice),
      averagePrice: Number(currentPrice) || Number(originalPrice),
    };
  } catch (error: any) {
  if (axios.isAxiosError(error)) {
    if (error.response && error.response.status === 404) {
      console.log(`HTTP 404: Product not found at ${url}`);
      return { deleted: true, reason: "NOT_FOUND", url };
    }
  }

  // Soft 404 check
  if (error.message && error.message.includes("Soft 404")) {
    return { deleted: true, reason: "SOFT_404", url };
  }

  console.log(`Error scraping product at ${url}:`, error.message);
  return null;
}

}
