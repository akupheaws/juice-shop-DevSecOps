import { Component, Input, ModuleWithProviders, NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { MatProgressBarModule } from '@angular/material/progress-bar'

@Component({ standalone: false, selector: 'mat-password-strength', template: '<mat-progress-bar aria-label="Password strength" [value]="score" [color]="color"></mat-progress-bar>' })
export class PasswordStrengthComponent {
  @Input() password = ''
  get criteria (): boolean[] { return [/[a-z]/.test(this.password), /[A-Z]/.test(this.password), /\d/.test(this.password), /[^a-zA-Z0-9]/.test(this.password), this.password.length >= 8] }
  get score (): number { return this.criteria.filter(Boolean).length * 20 }
  get color (): 'warn' | 'accent' | 'primary' { return this.score < 60 ? 'warn' : this.score < 100 ? 'accent' : 'primary' }
}

@Component({ standalone: false, selector: 'mat-password-strength-info', template: '<ul><li *ngFor="let message of messages; index as i">{{passwordComponent.criteria[i] ? "✓" : "○"}} {{message}}</li></ul>' })
export class PasswordStrengthInfoComponent {
  @Input() passwordComponent!: PasswordStrengthComponent
  @Input() lowerCaseCriteriaMsg = ''
  @Input() upperCaseCriteriaMsg = ''
  @Input() digitsCriteriaMsg = ''
  @Input() specialCharsCriteriaMsg = ''
  @Input() minCharsCriteriaMsg = ''
  get messages (): string[] { return [this.lowerCaseCriteriaMsg, this.upperCaseCriteriaMsg, this.digitsCriteriaMsg, this.specialCharsCriteriaMsg, this.minCharsCriteriaMsg] }
}

@NgModule({ declarations: [PasswordStrengthComponent, PasswordStrengthInfoComponent], imports: [CommonModule, MatProgressBarModule], exports: [PasswordStrengthComponent, PasswordStrengthInfoComponent] })
export class MatPasswordStrengthModule {
  static forRoot (): ModuleWithProviders<MatPasswordStrengthModule> { return { ngModule: MatPasswordStrengthModule } }
}
