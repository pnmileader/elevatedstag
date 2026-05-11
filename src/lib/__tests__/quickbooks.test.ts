import assert from 'node:assert/strict'
import { parseInvoiceLineItem } from '../quickbooks'

type Case = {
  name: string
  product: string
  description: string
  expect: {
    category: 'custom' | 'ready_made' | 'service' | 'discount' | 'unknown'
    brand?: string | null
    garment_type?: string
    size?: string
  }
}

const cases: Case[] = [
  {
    name: 'CCVP → 3-piece suit (custom)',
    product: 'Wardrobe Styling CCVP - Custom Coat, Vest, & Pant',
    description: 'Dk Navy',
    expect: { category: 'custom', garment_type: 'suit' },
  },
  {
    name: 'CT → custom trouser (pant)',
    product: 'Wardrobe Styling CT - Custom Trouser',
    description: 'Dk Navy',
    expect: { category: 'custom', garment_type: 'pant' },
  },
  {
    name: 'CSC → custom sport coat',
    product: 'Wardrobe Styling CSC - Custom Sport Coat',
    description: 'Blue Hopsack',
    expect: { category: 'custom', garment_type: 'sport_coat' },
  },
  {
    name: 'CV → custom vest',
    product: 'Wardrobe Styling CV - Custom Vest',
    description: 'Charcoal Wool',
    expect: { category: 'custom', garment_type: 'vest' },
  },
  {
    name: 'CSHT → custom shirt',
    product: 'Wardrobe Styling CSHT - Custom Shirt',
    description: 'White Twill',
    expect: { category: 'custom', garment_type: 'shirt' },
  },
  {
    name: 'Magnani (single-n misspelling) → ready-made Magnanni',
    product: 'Wardrobe Styling Magnani Shoes',
    description: 'Black, Brown, Cherry 9.5',
    expect: { category: 'ready_made', brand: 'Magnanni', size: '9.5' },
  },
  {
    name: 'Magnanni (correct spelling) → ready-made Magnanni',
    product: 'Wardrobe Styling Magnanni Loafers',
    description: 'Size 10.5',
    expect: { category: 'ready_made', brand: 'Magnanni', size: '10.5' },
  },
  {
    name: '34 Heritage → ready-made 34 Heritage',
    product: 'Wardrobe Styling 34 Heritage Jeans',
    description: 'Charcoal 34x32',
    expect: { category: 'ready_made', brand: '34 Heritage', size: '34x32' },
  },
  {
    name: '7Diamonds → ready-made 7Diamonds',
    product: 'Wardrobe Styling 7Diamonds Shirt',
    description: 'Navy Large',
    expect: { category: 'ready_made', brand: '7Diamonds', size: 'Large' },
  },
  {
    name: 'Belt → ready-made with null brand and size',
    product: 'Wardrobe Styling Belt',
    description: 'Brown, Cherry 42',
    expect: { category: 'ready_made', brand: null, size: '42' },
  },
  {
    name: 'Socks → ready-made with null brand, no size',
    product: 'Wardrobe Styling Socks',
    description: 'Fun socks',
    expect: { category: 'ready_made', brand: null },
  },
  {
    name: 'Alterations → service (skip)',
    product: 'Wardrobe Styling Alterations',
    description: 'Hem trousers',
    expect: { category: 'service' },
  },
  {
    name: 'Friends & Family Discount → discount (skip)',
    product: 'Wardrobe Styling Friends & Family Discount - Styling',
    description: '',
    expect: { category: 'discount' },
  },
  {
    name: 'Ready-Made catch-all → brand from description',
    product: 'Ready-Made',
    description: 'Eton Shirt White',
    expect: { category: 'ready_made', brand: 'Eton Shirt' },
  },
  {
    name: 'Unknown product → unknown (needs review)',
    product: 'Mystery SKU 12345',
    description: '',
    expect: { category: 'unknown' },
  },
]

let passed = 0
let failed = 0
const failures: string[] = []

for (const c of cases) {
  try {
    const result = parseInvoiceLineItem(c.product, c.description)
    assert.equal(result.category, c.expect.category, `category mismatch for: ${c.name}`)
    if (c.expect.brand !== undefined) {
      if (c.expect.brand === null) {
        assert.equal(result.brand ?? null, null, `brand should be null/absent for: ${c.name}`)
      } else {
        assert.equal(result.brand, c.expect.brand, `brand mismatch for: ${c.name}`)
      }
    }
    if (c.expect.garment_type !== undefined) {
      assert.equal(result.garment_type, c.expect.garment_type, `garment_type mismatch for: ${c.name}`)
    }
    if (c.expect.size !== undefined) {
      assert.equal(result.size, c.expect.size, `size mismatch for: ${c.name}`)
    }
    passed++
    console.log(`  ✓ ${c.name}`)
  } catch (err) {
    failed++
    const msg = err instanceof Error ? err.message : String(err)
    failures.push(`  ✗ ${c.name}\n      ${msg}`)
    console.log(`  ✗ ${c.name}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('\nFailures:')
  failures.forEach((f) => console.log(f))
  process.exit(1)
}
