// @ts-nocheck
import {
    TransactionBaseService,
    ProductService,
    Product as MedusaProduct,
    ProductVariant, SalesChannelService, SalesChannel
} from '@medusajs/medusa';
import {  ProductPrice } from 'node-product-catalog-feed';
import { PluginOptions } from '../types';
import FeedBuilder from '../lib/FeedBuilder';
import FeedProduct from '../lib/FeedProduct';

class FeedService extends TransactionBaseService {
  private productService: ProductService;
  private salesChannelService: SalesChannelService;
  private readonly options: PluginOptions;
  private readonly pathToProduct: string;
  private readonly salesChannelNames: string[];

  constructor(container, options: PluginOptions) {
    super(container);
    this.productService = container.productService;
    this.salesChannelService = container.salesChannelService;
    this.options = options;
    this.pathToProduct = options.pathToProduct ?? 'http://localhost:3000/products/';
    this.salesChannelNames = options.salesChannelName ?? null;
  }

  async createFeed() {
      const salesChannel: SalesChannel[] | null = this.salesChannelNames.length
        ? await this.salesChannelService.list({
              name: this.salesChannelNames
          })
        : null;

    const feedProducts = [];

    for await (const parentProduct of this.getProducts(salesChannel ?? null)) {
      const variants: ProductVariant[] =
        await this.productService.retrieveVariants(parentProduct.id, {
            relations: ['variants.prices']
        });

      if (variants && variants.length > 0) {
        const parentFeedProduct = new FeedProduct();
        parentFeedProduct.id = parentProduct.id;
        parentFeedProduct.title = parentProduct.title;
        parentFeedProduct.description = parentProduct.description;
        parentFeedProduct.link = `${this.pathToProduct}${parentProduct.handle}`;
        parentFeedProduct.imageLink = parentProduct.thumbnail;
        parentFeedProduct.additionalImageLink = parentProduct.images?.map((image) => image.url);
        parentFeedProduct.condition = 'new';
        parentFeedProduct.material = parentProduct.material ?? '';
        parentFeedProduct.productType = parentProduct.categories?.map((category) => category.name);
        if (parentProduct.width) {
            parentFeedProduct.width = `${(parentProduct.width / 10).toFixed(2)} cm`;
        }
        if (parentProduct.height) {
            parentFeedProduct.height = `${(parentProduct.height / 10).toFixed(2)} cm`;
        }
        if (parentProduct.length) {
            parentFeedProduct.length = `${(parentProduct.length / 10).toFixed(2)} cm`;
        }
        if (parentProduct.weight) {
            parentFeedProduct.weight = `${parentProduct.weight} g`;
        }

        parentFeedProduct.customLabels = [
            parentProduct.sales_channels?.map((salesChannel) => salesChannel.name) ?? [],
        ]
        if (this.options.hasIdentifier === false) {
            parentFeedProduct.identifierExists = false;
        }

        if (variants.length === 1) {
            parentFeedProduct.availability = variants[0].allow_backorder
                ? variants[0].inventory_quantity > 0
                    ? 'in_stock'
                    : 'backorder'
                : variants[0].inventory_quantity > 0
                    ? 'in_stock'
                    : 'out_of_stock';
            parentFeedProduct.quantity = variants[0].inventory_quantity;

            if (variants[0].prices && variants[0].prices?.length > 0) {
                parentFeedProduct.price = new ProductPrice(variants[0].prices[0].amount / 100, variants[0].prices[0].currency_code)
            }

            parentFeedProduct.customLabels = [
                ...parentFeedProduct.customLabels,
                new Intl.DisplayNames(["nl"], { type: "region" }).of(
                    variants[0].origin_country
                ) ?? ''
            ]

            feedProducts.push(parentFeedProduct);
        } else {
            feedProducts.push(parentFeedProduct);

            for (const variant of variants) {
                const variantFeedProduct = new FeedProduct();
                variantFeedProduct.id = variant.id;
                variantFeedProduct.title = variant.title;
                variantFeedProduct.description = parentFeedProduct.description;
                variantFeedProduct.link = `${this.pathToProduct}${parentProduct.handle}`;
                variantFeedProduct.condition = parentFeedProduct.condition;
                variantFeedProduct.availability = variant.allow_backorder
                    ? variant.inventory_quantity > 0
                        ? 'in_stock'
                        : 'backorder'
                    : variant.inventory_quantity > 0
                        ? 'in_stock'
                        : 'out_of_stock';
                variantFeedProduct.itemGroupId = parentFeedProduct.id;
                feedProducts.push(variantFeedProduct);
            }
        }
      }
    }

    // 5. Create a new FeedBuilder and populate it with feed products.
    const feedBuilder = new FeedBuilder()
      .withTitle('De Geslepen Steen Koongo Feed')
      .withLink('https://degeslepensteen.nl')
      .withDescription('De Geslepen Steen catalogus');

    // 6. Add each feed product to the feed builder.
    feedProducts.forEach((product) => {
      feedBuilder.withProduct(product);
    });

    // 7. Build XML.
    return feedBuilder.buildXml();
  }

  async *getProducts(salesChannels?: SalesChannel[]): AsyncGenerator<MedusaProduct> {
      let done = false;
      let retrievedProducts = 0;
      let run = 0;
      const ids = [];

      while (!done) {
          const [products, count] = await this.productService.listAndCount({
              // deleted_at: null
          }, {
              skip: run * 10,
              take: 10,
              relations: ['categories', 'sales_channels', 'images'],
          });

          for (const product of products) {
              if (salesChannels) {
                  if (await this.productService.isProductInSalesChannels(product.id, salesChannels?.map((salesChannel) => salesChannel.id)) && ids.indexOf(product.id) === -1) {
                      ids.push(product.id);
                      yield product;
                  }
              } else {
                  if (ids.indexOf(product.id) === -1) {
                      ids.push(product.id);
                      yield product;
                  }
              }
          }

          retrievedProducts += products.length
          run++

          if (run * 10 >= count) {
              done = true;
          }
      }
  }
}

export default FeedService;
