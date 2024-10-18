// @ts-nocheck
import { Product as DefaultFeedProduct } from 'node-product-catalog-feed';

export default class FeedProduct extends DefaultFeedProduct {

    get width() {
        return this._width;
    }

    set width(value) {
        this._width = value;
    }

    get length() {
        return this._length;
    }

    set length(value) {
        this._length = value;
    }

    get height() {
        return this._height;
    }

    set height(value) {
        this._height = value;
    }

    get weight() {
        return this._weight;
    }

    set weight(value) {
        this._weight = value;
    }
}
