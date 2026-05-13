import assert from 'node:assert/strict'
import { parseInvoiceLineItem } from '../quickbooks'

type Case = {
  name: string
  product: string
  description: string
  expect: {
    category: 'custom' | 'ready_made' | 'service' | 'discount' | 'skip' | 'unknown'
    brand?: string | null
    garment_type?: string
    size?: string
  }
}

const cases: Case[] = [
  // ===== Original cases (backward compatibility) =====
  {
    name: 'CCVP → 3-piece suit (custom)',
    product: 'Wardrobe Styling:CCVP - Custom Coat, Vest, & Pant',
    description: 'Dk Navy',
    expect: { category: 'custom', garment_type: 'suit' },
  },
  {
    name: 'CT → custom trouser (pant)',
    product: 'Wardrobe Styling:CT - Custom Trouser',
    description: 'Dk Navy',
    expect: { category: 'custom', garment_type: 'pant' },
  },
  {
    name: 'CSC → custom sport coat',
    product: 'Wardrobe Styling:CSC - Custom Sport Coat',
    description: 'Blue Hopsack',
    expect: { category: 'custom', garment_type: 'sport_coat' },
  },
  {
    name: 'CV → custom vest',
    product: 'Wardrobe Styling:CV - Custom Vest',
    description: 'Charcoal Wool',
    expect: { category: 'custom', garment_type: 'vest' },
  },
  {
    name: 'CSHT → custom shirt',
    product: 'Wardrobe Styling:CSHT - Custom Shirt',
    description: 'White Twill',
    expect: { category: 'custom', garment_type: 'shirt' },
  },
  {
    name: 'Magnani (single-n misspelling) → ready-made Magnanni',
    product: 'Wardrobe Styling:Magnani Shoes',
    description: 'Black, Brown, Cherry 9.5',
    expect: { category: 'ready_made', brand: 'Magnanni', size: '9.5' },
  },
  {
    name: 'Magnanni (correct spelling) → ready-made Magnanni',
    product: 'Wardrobe Styling:Magnanni Loafers',
    description: 'Size 10.5',
    expect: { category: 'ready_made', brand: 'Magnanni', size: '10.5' },
  },
  {
    name: '34 Heritage → ready-made 34 Heritage',
    product: 'Wardrobe Styling:34 Heritage Jeans',
    description: 'Charcoal 34x32',
    expect: { category: 'ready_made', brand: '34 Heritage', size: '34x32' },
  },
  {
    name: '7Diamonds → ready-made 7Diamonds',
    product: 'Wardrobe Styling:7Diamonds Shirt',
    description: 'Navy Large',
    expect: { category: 'ready_made', brand: '7Diamonds', size: 'Large' },
  },
  {
    name: 'Belt → ready-made with null brand and size',
    product: 'Wardrobe Styling:Belt',
    description: 'Brown, Cherry 42',
    expect: { category: 'ready_made', brand: null, size: '42' },
  },
  {
    name: 'Socks → ready-made with null brand, no size',
    product: 'Wardrobe Styling:Socks',
    description: 'Fun socks',
    expect: { category: 'ready_made', brand: null },
  },
  {
    name: 'Alterations → service (skip)',
    product: 'Wardrobe Styling:Alterations',
    description: 'Hem trousers',
    expect: { category: 'service' },
  },
  {
    name: 'Friends & Family Discount → discount (skip)',
    product: 'Wardrobe Styling:Friends & Family Discount - Styling',
    description: '',
    expect: { category: 'discount' },
  },
  {
    name: 'Unknown product → unknown (needs review)',
    product: 'Mystery SKU 12345',
    description: '',
    expect: { category: 'unknown' },
  },

  // ===== Spec-mandated new cases =====
  {
    name: 'CCP → 2-piece suit (custom)',
    product: 'Wardrobe Styling:CCP - Custom Coat & Pant',
    description: 'Burgundy Solid',
    expect: { category: 'custom', garment_type: 'suit' },
  },
  {
    name: 'CSHT with colon separator → custom shirt',
    product: 'Wardrobe Styling:CSHT - Custom Shirt',
    description: 'White Solid',
    expect: { category: 'custom', garment_type: 'shirt' },
  },
  {
    name: 'CT with empty description → custom pant',
    product: 'Wardrobe Styling:CT - Custom Trouser',
    description: '',
    expect: { category: 'custom', garment_type: 'pant' },
  },
  {
    name: 'CB → custom bomber jacket',
    product: 'Wardrobe Styling:CB - Custom Bomber',
    description: 'Navy Twill',
    expect: { category: 'custom', garment_type: 'jacket' },
  },
  {
    name: 'Custom Tuxedo → suit',
    product: 'Wardrobe Styling:Custom Tuxedo',
    description: '',
    expect: { category: 'custom', garment_type: 'suit' },
  },
  {
    name: 'CSHO → custom shorts (pant)',
    product: 'Wardrobe Styling:CSHO - Custom Shorts',
    description: '',
    expect: { category: 'custom', garment_type: 'pant' },
  },
  {
    name: 'Custom Cashmere Sweater → custom, other',
    product: 'Wardrobe Styling:Custom Cashmere Sweater',
    description: 'Charcoal',
    expect: { category: 'custom', garment_type: 'other' },
  },
  {
    name: 'J&M Shoes → ready-made Johnston & Murphy',
    product: 'Wardrobe Styling:J&M Shoes',
    description: 'Black 10.5',
    expect: { category: 'ready_made', brand: 'Johnston & Murphy', size: '10.5' },
  },
  {
    name: 'Paige Jeans → ready-made Paige',
    product: 'Wardrobe Styling:Paige Jeans',
    description: 'Dark wash 34',
    expect: { category: 'ready_made', brand: 'Paige', size: '34' },
  },
  {
    name: 'Ready Made Clothing → ready_made, brand from description (Vince)',
    product: 'Wardrobe Styling:Ready Made Clothing',
    description: 'Vince sweater XL',
    expect: { category: 'ready_made', brand: 'Vince', size: 'XL' },
  },
  {
    name: 'Personal Styling → service (skip)',
    product: 'Wardrobe Styling:Personal Styling',
    description: '',
    expect: { category: 'service' },
  },
  {
    name: 'Monthly VIP Concierge → service (skip)',
    product: 'Wardrobe Styling:Monthly VIP Concierge Service',
    description: '',
    expect: { category: 'service' },
  },
  {
    name: 'Interior Design:Cabinet Hardware → skip (out of scope)',
    product: 'Interior Design:Cabinet Hardware',
    description: '',
    expect: { category: 'skip' },
  },
  {
    name: 'Delta T11964 — Diverter Trim → skip (fixture)',
    product: 'Delta T11964 — Diverter Trim',
    description: '',
    expect: { category: 'skip' },
  },
  {
    name: 'Custom Sweater (non-cashmere) → custom, other',
    product: 'Wardrobe Styling:Custom Sweater',
    description: 'LS Crew Neck',
    expect: { category: 'custom', garment_type: 'other' },
  },
  {
    name: 'Custom Jeans → custom, pant',
    product: 'Wardrobe Styling:Custom Jeans',
    description: 'Dark wash 33',
    expect: { category: 'custom', garment_type: 'pant' },
  },

  // ===== Additional new brand / generic cases =====
  {
    name: 'Holderness & Bourne → ready_made',
    product: 'Wardrobe Styling:Holderness & Bourne',
    description: 'Navy polo M',
    expect: { category: 'ready_made', brand: 'Holderness & Bourne' },
  },
  {
    name: 'Blue Delta Jeans → ready_made Blue Delta',
    product: 'Wardrobe Styling:Blue Delta Jeans',
    description: 'Dark wash 32',
    expect: { category: 'ready_made', brand: 'Blue Delta', size: '32' },
  },
  {
    name: 'Liverpool Jean → ready_made Liverpool',
    product: 'Wardrobe Styling:Liverpool Jean',
    description: 'Indigo 34',
    expect: { category: 'ready_made', brand: 'Liverpool', size: '34' },
  },
  {
    name: 'Dead Soxy Socks → ready_made Dead Soxy',
    product: 'Wardrobe Styling:Dead Soxy Socks',
    description: 'Black',
    expect: { category: 'ready_made', brand: 'Dead Soxy' },
  },
  {
    name: 'Polo → ready_made, brand null',
    product: 'Wardrobe Styling:Polo',
    description: 'Navy M',
    expect: { category: 'ready_made', brand: null },
  },
  {
    name: 'Tie → ready_made accessory',
    product: 'Wardrobe Styling:Tie',
    description: 'Burgundy silk',
    expect: { category: 'ready_made', brand: null },
  },
  {
    name: 'Pocket Square → ready_made',
    product: 'Wardrobe Styling:Pocket Square',
    description: 'White linen',
    expect: { category: 'ready_made', brand: null },
  },

  // ===== Discount / credit / complimentary =====
  {
    name: 'Client Loyalty Discount → discount',
    product: 'Wardrobe Styling:Client Loyalty Discount',
    description: '',
    expect: { category: 'discount' },
  },
  {
    name: 'VIP Client Discount → discount',
    product: 'Wardrobe Styling:VIP Client Discount',
    description: '',
    expect: { category: 'discount' },
  },
  {
    name: 'Complimentary Dress Shirt → discount',
    product: 'Wardrobe Styling:Complimentary Dress Shirt',
    description: '',
    expect: { category: 'discount' },
  },
  {
    name: 'Buy 6 Get 1 Free Socks → discount',
    product: 'Wardrobe Styling:Buy 6 Get 1 Free - Socks',
    description: '',
    expect: { category: 'discount' },
  },
  {
    name: 'Credit → discount',
    product: 'Wardrobe Styling:Credit',
    description: '',
    expect: { category: 'discount' },
  },

  // ===== Accounting line items =====
  {
    name: 'Adjustment from prior period → service (skip)',
    product: 'Adjustment from prior period',
    description: '',
    expect: { category: 'service' },
  },
  {
    name: 'ERC Tax Credit → service (skip)',
    product: 'ERC Tax Credit',
    description: '',
    expect: { category: 'service' },
  },
  {
    name: 'Interest Earned → service (skip)',
    product: 'Interest Earned',
    description: '',
    expect: { category: 'service' },
  },
  {
    name: 'Designer Fee → service (skip)',
    product: 'Designer Fee - A la Carte Hours - Labor',
    description: '',
    expect: { category: 'service' },
  },

  // ===== Other fixtures =====
  {
    name: 'Kohler tub → skip',
    product: 'Kohler Underscore Rectangle Soaking Tub',
    description: '',
    expect: { category: 'skip' },
  },
  {
    name: 'Wallpaper → skip',
    product: 'Wallpaper',
    description: '',
    expect: { category: 'skip' },
  },
]

let passed = 0
let failed = 0
const failures: string[] = []

for (const c of cases) {
  try {
    const result = parseInvoiceLineItem(c.product, c.description)
    assert.equal(result.category, c.expect.category, `category mismatch for: ${c.name} (got ${result.category})`)
    if (c.expect.brand !== undefined) {
      if (c.expect.brand === null) {
        assert.equal(result.brand ?? null, null, `brand should be null/absent for: ${c.name}`)
      } else {
        assert.equal(result.brand, c.expect.brand, `brand mismatch for: ${c.name} (got ${result.brand})`)
      }
    }
    if (c.expect.garment_type !== undefined) {
      assert.equal(result.garment_type, c.expect.garment_type, `garment_type mismatch for: ${c.name} (got ${result.garment_type})`)
    }
    if (c.expect.size !== undefined) {
      assert.equal(result.size, c.expect.size, `size mismatch for: ${c.name} (got ${result.size})`)
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

// ===== Full catalog sweep — make sure no product from the real data lands as 'unknown' unexpectedly =====
const fullCatalog = [
  '2-Light Vanity Light — Matte Black w/ Seeded Glass',
  'Adjustment from prior period',
  'Breakfast Table Pendant',
  'Cuts',
  'Delta 50560 — Tub Spout',
  'Delta 52159-25 — Rain Can Shower Head',
  'Delta 57051 — Hand Shower & Slide Bar',
  'Delta Ashlyn Roman Tub Faucet Trim',
  'Delta Ashlyn Widespread Faucet — Brushed Nickel',
  'Delta Ashlyn Widespread Faucet — Matte Black',
  'Delta R10000-UNWSHF — Shower Valve Body',
  'Delta R11000 — Diverter Valve Body',
  'Delta T11964 — Diverter Trim',
  'Delta T14264 — Shower Trim Kit',
  'Delta U4999 — Ceiling Shower Arm',
  'Designer Fee - A la Carte Hours - Labor',
  'Dining Table Pendant — Linear Island Light',
  'Elegant Lighting Eternity Mirror',
  'ERC Tax Credit',
  'Front Entryway Flush Mount — Bronze',
  'Garage & Patio Wall Lantern — Bronze',
  'Guest Bath Mirror — Matte Black Frame',
  'Guest Bath Vanity Light — 3-Light Matte Black',
  'Interest Earned',
  'Interior Design:A la carte Design Hours',
  'Interior Design:Accessories',
  'Interior Design:Cabinet Hardware',
  'Interior Design:Cabinet Hardware Installation',
  'Interior Design:Design/PM Fee',
  'Interior Design:Discount',
  'Interior Design:Fan',
  'Interior Design:Framing',
  'Interior Design:Hang art',
  'Interior Design:Initial Walkthrough',
  'Interior Design:Initial Walkthrough & Design Consultation',
  'Interior Design:Light Bulbs',
  'Interior Design:Paint',
  'Interior Design:Plumbing Fixtures',
  'Interior Design:Retainer or Scheduling Deposit',
  'Interior Design:Window Coverings',
  'Kitchen Island Pendants — 3-Light Bar',
  'Kohler Underscore Rectangle Soaking Tub',
  'Kohler Verticyl Undermount Sink',
  'Matthews Patricia-3 Exterior Fan — 42"',
  'Matthews Patricia-5 Interior Fan — 60"',
  'Organizing:Closet Clean-out & Organizing',
  'Organizing:Hangers',
  'Possini Euro Midtown Sconce — Satin Nickel',
  'Renovation:Counters',
  'Renovation:Door/Hardware',
  'Renovation:Electrical',
  'Renovation:Fan',
  'Renovation:General Construction',
  'Renovation:Paint',
  'Renovation:Sink',
  'Shower Floor & Niche Tile',
  'Shower Wall Tile',
  'Sink Drain — Matte Black',
  'Wallpaper',
  'Wardrobe Styling:34 Heritage Jeans',
  'Wardrobe Styling:34 Heritage Shirt',
  'Wardrobe Styling:7Diamonds Shirt',
  'Wardrobe Styling:Accessories',
  'Wardrobe Styling:Alterations',
  'Wardrobe Styling:Belt',
  'Wardrobe Styling:Blue Delta Jeans',
  'Wardrobe Styling:Buy 6 Get 1 Free - Socks',
  'Wardrobe Styling:CB - Custom Bomber',
  'Wardrobe Styling:CCP - Custom Coat & Pant',
  'Wardrobe Styling:CCP - Custom Tuxedo',
  'Wardrobe Styling:CCVP - Custom Coat',
  'Wardrobe Styling:Client Loyalty Discount',
  'Wardrobe Styling:Complimentary Dress Shirt',
  'Wardrobe Styling:Convenience Fee',
  'Wardrobe Styling:Credit',
  'Wardrobe Styling:CSC - Custom Sport Coat',
  'Wardrobe Styling:CSHO - Custom Shorts',
  'Wardrobe Styling:CSHT - Custom Shirt',
  'Wardrobe Styling:CT - Custom Trouser',
  'Wardrobe Styling:Custom Amount - Wardrobe',
  'Wardrobe Styling:Custom Cashmere Sweater',
  'Wardrobe Styling:Custom Clothing Gift Certificate',
  'Wardrobe Styling:Custom Jeans',
  'Wardrobe Styling:Custom Lining Charge',
  'Wardrobe Styling:Custom Sweater',
  'Wardrobe Styling:CV - Custom Vest',
  'Wardrobe Styling:Dead Soxy Socks',
  'Wardrobe Styling:Dry Cleaning',
  'Wardrobe Styling:Friends & Family Discount - Styling',
  'Wardrobe Styling:Holderness & Bourne',
  'Wardrobe Styling:J&M Belt',
  'Wardrobe Styling:J&M Clothing',
  'Wardrobe Styling:J&M Shoes',
  'Wardrobe Styling:Liverpool Jean',
  'Wardrobe Styling:Magnanni Shoes',
  'Wardrobe Styling:Monthly VIP Concierge Service',
  'Wardrobe Styling:Paige Jeans',
  'Wardrobe Styling:Paige Shirt',
  'Wardrobe Styling:Personal Styling',
  'Wardrobe Styling:Pocket Square',
  'Wardrobe Styling:Polo',
  'Wardrobe Styling:Ready Made Clothing',
  'Wardrobe Styling:Rush fee',
  'Wardrobe Styling:Shipping - Wardrobe Styling',
  'Wardrobe Styling:Shoe Repair',
  'Wardrobe Styling:Shoes',
  'Wardrobe Styling:Socks',
  'Wardrobe Styling:Tie',
  'Wardrobe Styling:Tips',
  'Wardrobe Styling:VIP Client Discount',
]

const unknowns: string[] = []
for (const p of fullCatalog) {
  const r = parseInvoiceLineItem(p, '')
  if (r.category === 'unknown') unknowns.push(p)
}

console.log(`\nFull-catalog sweep: ${fullCatalog.length} products checked, ${unknowns.length} fell into 'unknown'`)
if (unknowns.length > 0) {
  console.log('Unknown products (will land in needs-review at import time):')
  unknowns.forEach((p) => console.log('  - ' + p))
}
