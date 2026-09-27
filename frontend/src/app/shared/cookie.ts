import { Injectable, ModuleWithProviders, NgModule } from '@angular/core'

@Injectable({ providedIn: 'root' })
export class CookieService {
  get (name: string): string | undefined {
    const prefix = encodeURIComponent(name) + '='
    const cookie = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith(prefix))
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined
  }

  hasKey (name: string): boolean { return this.get(name) !== undefined }

  put (name: string, value: string, options: { expires?: Date } = {}): void {
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}${options.expires ? '; Expires=' + options.expires.toUTCString() : ''}`
  }

  remove (name: string): void { this.put(name, '', { expires: new Date(0) }) }
}

@NgModule({})
export class CookieModule {
  static forRoot (): ModuleWithProviders<CookieModule> { return { ngModule: CookieModule } }
}
