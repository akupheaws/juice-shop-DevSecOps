/*
 * Copyright (c) 2014-2023 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Request, Response, NextFunction } from 'express'
import { UserModel } from 'models/user'

/* jslint node: true */
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const sanitizeHtml = require('sanitize-html')
const sanitizeFilename = require('sanitize-filename')
const z85 = require('z85')
const utils = require('./utils')
const fs = require('fs')

// Private keys are supplied at deployment time; never load the published training key.
const configuredKeyFile = process.env.JWT_PRIVATE_KEY_FILE
if (process.env.NODE_ENV === 'production' && !configuredKeyFile) {
  throw new Error('JWT_PRIVATE_KEY_FILE is required in production')
}
const privateKey = configuredKeyFile
  ? crypto.createPrivateKey(fs.readFileSync(configuredKeyFile))
  : crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
if (privateKey.asymmetricKeyType !== 'rsa' || privateKey.asymmetricKeyDetails.modulusLength < 2048) {
  throw new Error('JWT signing requires an RSA key of at least 2048 bits')
}
const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })
module.exports.publicKey = publicKey
const signingKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' })

interface ResponseWithUser {
  status: string
  data: UserModel
  iat: number
  exp: number
  bid: number
}

interface IAuthenticatedUsers {
  tokenMap: { [key: string]: ResponseWithUser }
  idMap: {[key: string]: string}
  put: (token: string, user: ResponseWithUser) => void
  get: (token: string) => ResponseWithUser | undefined
  tokenOf: (user: UserModel) => string | undefined
  from: (req: Request) => ResponseWithUser | undefined
  updateFrom: (req: Request, user: ResponseWithUser) => any
}

exports.hash = (data: string) => crypto.createHash('md5').update(data).digest('hex')
exports.hmac = (data: string) => crypto.createHmac('sha256', 'pa4qacea4VK9t9nGv7yZtwmj').update(data).digest('hex')

exports.cutOffPoisonNullByte = (str: string) => {
  const nullByte = '%00'
  if (utils.contains(str, nullByte)) {
    return str.substring(0, str.indexOf(nullByte))
  }
  return str
}

const verify = (token: string) => {
  try {
    jwt.verify(token, publicKey, { algorithms: ['RS256'] })
    return true
  } catch {
    return false
  }
}
module.exports.verify = verify
const decode = (token: string) => jwt.verify(token, publicKey, { algorithms: ['RS256'] })
module.exports.decode = decode
exports.isAuthorized = () => (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = decode(utils.jwtFrom(req))
    // Temporary 2FA tokens must never authorize a normal application request.
    if (!payload.data?.id) return res.status(401).json({ error: 'Unauthorized' })
    ;(req as Request & { user?: unknown }).user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
exports.denyAll = () => (_req: Request, res: Response) => res.status(401).json({ error: 'Unauthorized' })
exports.authorize = (user = {}) => jwt.sign(user, privateKey, { expiresIn: '5h', algorithm: 'RS256' })

exports.sanitizeHtml = (html: string) => sanitizeHtml(html)
exports.sanitizeLegacy = (input = '') => input.replace(/<(?:\w+)\W+?[\w]/gi, '')
exports.sanitizeFilename = (filename: string) => sanitizeFilename(filename)
const sanitizeSecure = (html: string): string | null => {
  const sanitized = sanitizeHtml(html)
  if (sanitized === html) {
    return html
  } else {
    return sanitizeSecure(sanitized)
  }
}

module.exports.sanitizeSecure = sanitizeSecure

const authenticatedUsers: IAuthenticatedUsers = {
  tokenMap: {},
  idMap: {},
  put: function (token: string, user: {
    status: string
    data: UserModel
    iat: number
    exp: number
    bid: number
  }) {
    this.tokenMap[token] = user
    this.idMap[user.data.id] = token
  },
  get: function (token: string) {
    return token ? this.tokenMap[utils.unquote(token)] : undefined
  },
  tokenOf: function (user: UserModel) {
    return user ? this.idMap[user.id] : undefined
  },
  from: function (req: Request) {
    const token = utils.jwtFrom(req)
    return token ? this.get(token) : undefined
  },
  updateFrom: function (req: Request, user: ResponseWithUser) {
    const token = utils.jwtFrom(req)
    this.put(token, user)
  }
}

module.exports.authenticatedUsers = authenticatedUsers

exports.userEmailFrom = ({ headers }: any) => {
  return headers ? headers['x-user-email'] : undefined
}

exports.generateCoupon = (discount: number, date = new Date()) => {
  const coupon = utils.toMMMYY(date) + '-' + discount
  return z85.encode(coupon)
}

exports.discountFromCoupon = (coupon: string) => {
  if (coupon) {
    const decoded = z85.decode(coupon)
    if (decoded && hasValidFormat(decoded.toString())) {
      const parts = decoded.toString().split('-')
      const validity = parts[0]
      if (utils.toMMMYY(new Date()) === validity) {
        const discount = parts[1]
        return parseInt(discount)
      }
    }
  }
  return undefined
}

function hasValidFormat (coupon: string) {
  return coupon.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[0-9]{2}-[0-9]{2}/)
}

// vuln-code-snippet start redirectCryptoCurrencyChallenge redirectChallenge
const redirectAllowlist = new Set([
  'https://github.com/bkimminich/juice-shop',
  'https://blockchain.info/address/1AbKfgvw9psQ41NbLi8kufDQTezwG8DRZm', // vuln-code-snippet vuln-line redirectCryptoCurrencyChallenge
  'https://explorer.dash.org/address/Xr556RzuwX6hg5EGpkybbv5RanJoZN17kW', // vuln-code-snippet vuln-line redirectCryptoCurrencyChallenge
  'https://etherscan.io/address/0x0f933ab9fcaaa782d0279c300d73750e1311eae6', // vuln-code-snippet vuln-line redirectCryptoCurrencyChallenge
  'http://shop.spreadshirt.com/juiceshop',
  'http://shop.spreadshirt.de/juiceshop',
  'https://www.stickeryou.com/products/owasp-juice-shop/794',
  'http://leanpub.com/juice-shop'
])
exports.redirectAllowlist = redirectAllowlist

exports.isRedirectAllowed = (url: string) => {
  let allowed = false
  for (const allowedUrl of redirectAllowlist) {
    allowed = allowed || url.includes(allowedUrl) // vuln-code-snippet vuln-line redirectChallenge
  }
  return allowed
}
// vuln-code-snippet end redirectCryptoCurrencyChallenge redirectChallenge

const roles = {
  customer: 'customer',
  deluxe: 'deluxe',
  accounting: 'accounting',
  admin: 'admin'
}

module.exports.roles = roles

const deluxeToken = (email: string) => {
  const hmac = crypto.createHmac('sha256', signingKeyPem)
  return hmac.update(email + roles.deluxe).digest('hex')
}

module.exports.deluxeToken = deluxeToken

exports.isAccounting = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const decodedToken = verify(utils.jwtFrom(req)) && decode(utils.jwtFrom(req))
    if (decodedToken?.data?.role === exports.roles.accounting) {
      next()
    } else {
      res.status(403).json({ error: 'Malicious activity detected' })
    }
  }
}

exports.isDeluxe = (req: Request) => {
  const decodedToken = verify(utils.jwtFrom(req)) && decode(utils.jwtFrom(req))
  return decodedToken?.data?.role === exports.roles.deluxe && decodedToken?.data?.deluxeToken && decodedToken?.data?.deluxeToken === deluxeToken(decodedToken?.data?.email)
}

exports.isCustomer = (req: Request) => {
  const decodedToken = verify(utils.jwtFrom(req)) && decode(utils.jwtFrom(req))
  return decodedToken?.data?.role === exports.roles.customer
}

exports.appendUserId = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body.UserId = authenticatedUsers.tokenMap[utils.jwtFrom(req)].data.id
      next()
    } catch (error: any) {
      res.status(401).json({ status: 'error', message: error })
    }
  }
}

exports.updateAuthenticatedUsers = () => (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token || utils.jwtFrom(req)
  if (token) {
    jwt.verify(token, publicKey, { algorithms: ['RS256'] }, (err: Error | null, decoded: any) => {
      if (err === null && decoded?.data?.id) {
        if (authenticatedUsers.get(token) === undefined) {
          authenticatedUsers.put(token, decoded)
          res.cookie('token', token)
        }
      }
    })
  }
  next()
}
