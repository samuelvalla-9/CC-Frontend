import { Component, EventEmitter, Input, Output} from '@angular/core';
import { Product } from '../../models/product.model';
@Component({
  selector: 'app-product-card',
  imports: [],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
})
export class ProductCard {
  @Input() product!: Product;
  @Output() selectProduct=new EventEmitter<Product>();

  onSelect(){
    this.selectProduct.emit(this.product);
  }
}
