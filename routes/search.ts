/*
 * Copyright (c) 2014-2023 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { Request, Response, NextFunction } from 'express'
import { ProductModel } from '../models/product'
import { Op } from 'sequelize'

const utils = require('../lib/utils')

// vuln-code-snippet start unionSqlInjectionChallenge dbSchemaChallenge
module.exports = function searchProducts () {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.query.q !== undefined && typeof req.query.q !== 'string') {
      return res.status(400).json({ error: 'Search query must be a string' })
    }
    const criteria = req.query.q === 'undefined' ? '' : (req.query.q ?? '').slice(0, 200)
    ProductModel.findAll({
      where: { [Op.or]: [{ name: { [Op.like]: `%${criteria}%` } }, { description: { [Op.like]: `%${criteria}%` } }] },
      order: [['name', 'ASC']]
    })
      .then((results: ProductModel[]) => {
        const products = results.map(product => product.get({ plain: true }))
        for (let i = 0; i < products.length; i++) {
          products[i].name = req.__(products[i].name)
          products[i].description = req.__(products[i].description)
        }
        res.json(utils.queryResultToJson(products))
      }).catch((error: Error) => {
        next(error)
      })
  }
}
// vuln-code-snippet end unionSqlInjectionChallenge dbSchemaChallenge
