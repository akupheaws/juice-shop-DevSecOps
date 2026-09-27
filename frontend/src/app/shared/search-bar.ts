import { Component, EventEmitter, NgModule, Output } from '@angular/core'
import { MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'

@Component({
  standalone: false,
  selector: 'mat-search-bar',
  template: '<mat-form-field><mat-label>Search</mat-label><input matInput type="search" aria-label="Search products" [value]="value" (input)="value = $any($event.target).value" (keydown.enter)="onEnter.emit(value)"></mat-form-field>'
})
export class SearchBarComponent {
  value = ''
  @Output() onEnter = new EventEmitter<string>()
}

@NgModule({ declarations: [SearchBarComponent], imports: [MatFormFieldModule, MatInputModule], exports: [SearchBarComponent] })
export class NgMatSearchBarModule {}
