module.exports = function searchProducts () {
  return (req: Request, res: Response, next: NextFunction) => {
    const criteria = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : ''
    ProductModel.findAll({ where: { [Op.or]: [{ name: { [Op.like]: `%${criteria}%` } }, { description: { [Op.like]: `%${criteria}%` } }] }, order: [['name', 'ASC']] })
      .then((products: any) => {
        const dataString = JSON.stringify(products)
        for (let i = 0; i < products.length; i++) {
          products[i].name = req.__(products[i].name)
          products[i].description = req.__(products[i].description)
        }
        res.json(utils.queryResultToJson(products))
      }).catch((error: ErrorWithParent) => {
        next(error.parent)
      })
  }
}
