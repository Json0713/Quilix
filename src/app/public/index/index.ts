import { Component } from '@angular/core';
import { Quilix } from '../quilix/quilix';

@Component({
  selector: 'app-public-index',
  imports: [Quilix],
  templateUrl: './index.html',
  styleUrl: './index.scss',
})
export class PublicIndex { }
