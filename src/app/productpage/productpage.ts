import { Component } from '@angular/core';
import { Product } from '../models/product.model';
import { FormsModule } from '@angular/forms';
import { ProductCard } from './product-card/product-card';

@Component({
  selector: 'app-productpage',
  imports: [FormsModule, ProductCard],
  templateUrl: './productpage.html',
  styleUrl: './productpage.css',
})
export class Productpage {
  products:Product[]=[
    { id: 1, name: 'watch', description: 'Description for product 1', price: 10.99, imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150' },
{ id: 2, name: 'camera', description: 'Description for product 2', price: 19.99, imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=150' },
{ id: 3, name: 'perfume', description: 'Description for product 3', price: 5.99, imageUrl: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=150' },
{ id: 4, name: 'white shoe', description: 'Description for product 4', price: 15.99, imageUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=150' },
{ id: 5, name: 'Nike premium', description: 'Description for product 5', price: 25.99, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150' },
{ id: 6, name: 'Loafers', description: 'Description for product 6', price: 30.99, imageUrl: 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=150' },
{ id: 7, name: 'perfume pro', description: 'Description for product 7', price: 12.99, imageUrl: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=150' },
{ id: 8, name: 'sport shoes', description: 'Description for product 8', price: 8.99, imageUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=150' },
{ id: 9, name: 'capturer', description: 'Description for product 9', price: 18.99, imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=150' },
{ id: 10, name: 'Red shoes', description: 'Description for product 10', price: 22.99, imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150' },

    ]

    selectedProduct: Product | null = null;

    selectProduct(product: Product) {
        this.selectedProduct = product;
    }

    searchText="";
    get filteredProducts(): Product[]{
      return this.products.filter(product =>
         product.name.toLowerCase()
         .includes(this.searchText.toLocaleLowerCase()));
    }


}
