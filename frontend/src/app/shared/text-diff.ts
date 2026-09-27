import { Component, Input, NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { diffLines } from 'diff'

export type DiffTableFormat = string

@Component({
  standalone: false,
  selector: 'td-ngx-text-diff',
  template: `<label>Diff format <select [value]="format" (change)="format = $any($event.target).value"><option>LineByLine</option><option>SideBySide</option></select></label>
    <div *ngIf="format === 'SideBySide'" class="columns"><pre>{{left}}</pre><pre>{{right}}</pre></div>
    <pre *ngIf="format !== 'SideBySide'"><span *ngFor="let part of changes" [class.added]="part.added" [class.removed]="part.removed">{{part.value}}</span></pre>`,
  styles: ['.columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; } pre { overflow: auto; } .added { background: #d7f5df; color: #173e21; } .removed { background: #fbdada; color: #551818; }']
})
export class NgxTextDiffComponent {
  @Input() left = ''
  @Input() right = ''
  @Input() format: DiffTableFormat = 'LineByLine'
  get changes () { return diffLines(this.left || '', this.right || '') }
}

@NgModule({ declarations: [NgxTextDiffComponent], imports: [CommonModule], exports: [NgxTextDiffComponent] })
export class NgxTextDiffModule {}
