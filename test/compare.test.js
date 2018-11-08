import Objext from '../src/objext'

describe('对数据进行比较', () => {
  test('比较两个objext', () => {
		let objx1 = new Objext({ a: 1, b: 2 })
		let objx2 = new Objext({ a: 1, b: 2 })
		expect(objx1.$$hash).toBe(objx2.$$hash)

		let objx3 = new Objext({ a: 1, b: 3 })
		expect(objx1.$$hash).not.toBe(objx3.$$hash)
  })

  test('修改后看看hash是否变化', () => {
		let objx = new Objext({ a: 1, b: 2 })
		let hash1 = objx.$$hash
		objx.a = 2
		let hash2 = objx.$$hash
		expect(hash1).not.toBe(hash2)
  })
})
