import { Component, Input, NgModule, OnDestroy, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'

export interface IImage { url: string, caption?: string }

@Component({
  standalone: false,
  selector: 'slideshow',
  template: `<figure *ngIf="imageUrls.length" [style.height]="height">
    <img [src]="imageUrls[index % imageUrls.length].url" [alt]="imageUrls[index % imageUrls.length].caption || ''">
    <figcaption>{{imageUrls[index % imageUrls.length].caption}}</figcaption>
    <div *ngIf="showArrows"><button type="button" (click)="move(-1)" aria-label="Previous slide">‹</button>
      <button type="button" (click)="move(1)" aria-label="Next slide">›</button>
      <button *ngIf="autoPlay" type="button" (click)="paused = !paused">{{paused ? 'Play' : 'Pause'}}</button></div>
  </figure>`,
  styles: ['figure { position: relative; margin: 0; text-align: center; overflow: hidden; } img { width: 100%; height: 80%; object-fit: contain; } figcaption { white-space: pre-wrap; }']
})
export class SlideshowComponent implements OnInit, OnDestroy {
  @Input() height = '300px'
  @Input() autoPlay = false
  @Input() arrowSize = '10px'
  @Input() showArrows = true
  @Input() showDots = false
  @Input() imageUrls: IImage[] = []
  index = 0
  paused = false
  private timer?: ReturnType<typeof setInterval>
  move (step: number): void { if (this.imageUrls.length) this.index = (this.index + step + this.imageUrls.length) % this.imageUrls.length }
  ngOnInit (): void { if (this.autoPlay) this.timer = setInterval(() => { if (!this.paused) this.move(1) }, 5000) }
  ngOnDestroy (): void { if (this.timer) clearInterval(this.timer) }
}

@NgModule({ declarations: [SlideshowComponent], imports: [CommonModule], exports: [SlideshowComponent] })
export class SlideshowModule {}
