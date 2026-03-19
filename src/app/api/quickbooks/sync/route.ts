import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { quickBooksRequest } from '@/lib/quickbooks'

export async function GET() {
  const supabase = createClient()
  
  try {
    console.log('Starting QuickBooks sync...')
    
    // 1. Fetch all customers from QuickBooks
    const customersResponse = await quickBooksRequest(
      "/query?query=SELECT * FROM Customer MAXRESULTS 1000"
    )
    
    const customers = customersResponse.QueryResponse?.Customer || []
    console.log(`Found ${customers.length} customers in QuickBooks`)
    
    let created = 0
    let updated = 0
    let errors = 0
    
    // 2. Process each customer
    for (const qbCustomer of customers) {
      try {
        // Parse the customer data
        const clientData = {
          quickbooks_id: qbCustomer.Id,
          first_name: qbCustomer.GivenName || qbCustomer.DisplayName?.split(' ')[0] || 'Unknown',
          last_name: qbCustomer.FamilyName || qbCustomer.DisplayName?.split(' ').slice(1).join(' ') || '',
          email: qbCustomer.PrimaryEmailAddr?.Address || null,
          phone: qbCustomer.PrimaryPhone?.FreeFormNumber || qbCustomer.Mobile?.FreeFormNumber || null,
          billing_address: qbCustomer.BillAddr ? {
            line1: qbCustomer.BillAddr.Line1,
            city: qbCustomer.BillAddr.City,
            state: qbCustomer.BillAddr.CountrySubDivisionCode,
            postal_code: qbCustomer.BillAddr.PostalCode,
            country: qbCustomer.BillAddr.Country,
          } : null,
          shipping_address: qbCustomer.ShipAddr ? {
            line1: qbCustomer.ShipAddr.Line1,
            city: qbCustomer.ShipAddr.City,
            state: qbCustomer.ShipAddr.CountrySubDivisionCode,
            postal_code: qbCustomer.ShipAddr.PostalCode,
            country: qbCustomer.ShipAddr.Country,
          } : null,
          stage: 'active',
          source: 'quickbooks',
          updated_at: new Date().toISOString(),
        }
        
        // Check if client already exists
        const { data: existingClient } = await supabase
          .from('clients')
          .select('id')
          .eq('quickbooks_id', qbCustomer.Id)
          .single()
        
        if (existingClient) {
          // Update existing client
          await supabase
            .from('clients')
            .update(clientData)
            .eq('id', existingClient.id)
          updated++
        } else {
          // Create new client
          await supabase
            .from('clients')
            .insert({
              ...clientData,
              created_at: new Date().toISOString(),
            })
          created++
        }
      } catch (err) {
        console.error(`Error processing customer ${qbCustomer.Id}:`, err)
        errors++
      }
    }
    
    // 3. Now sync invoices to get purchase history
    console.log('Fetching invoices...')
    const invoicesResponse = await quickBooksRequest(
      "/query?query=SELECT * FROM Invoice MAXRESULTS 1000"
    )
    
    const invoices = invoicesResponse.QueryResponse?.Invoice || []
    console.log(`Found ${invoices.length} invoices in QuickBooks`)
    
    let purchasesCreated = 0
    
    // Process invoices to extract ready-made purchases
    for (const invoice of invoices) {
      if (!invoice.Line) continue
      
      // Find the client for this invoice
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('quickbooks_id', invoice.CustomerRef?.value)
        .single()
      
      if (!client) continue
      
      // Process line items
      for (const line of invoice.Line) {
        if (line.DetailType !== 'SalesItemLineDetail') continue
        
        const itemName = line.SalesItemLineDetail?.ItemRef?.name || ''
        const description = line.Description || ''
        
        // Parse the product to determine category
        const parsed = parseProduct(itemName, description)
        if (!parsed) continue // Skip custom items for now
        
        // Check if this purchase already exists
        const { data: existingPurchase } = await supabase
          .from('ready_made_purchases')
          .select('id')
          .eq('quickbooks_line_id', `${invoice.Id}-${line.Id}`)
          .single()
        
        if (existingPurchase) continue // Skip if already imported
        
        // Create the purchase record
        await supabase
          .from('ready_made_purchases')
          .insert({
            client_id: client.id,
            quickbooks_line_id: `${invoice.Id}-${line.Id}`,
            quickbooks_invoice_id: invoice.Id,
            category: parsed.category,
            brand: parsed.brand,
            product_name: parsed.productName,
            description: parsed.description,
            size: parsed.size,
            price: line.Amount,
            quantity: line.SalesItemLineDetail?.Qty || 1,
            purchase_date: invoice.TxnDate,
          })
        
        purchasesCreated++
      }
    }
    
    console.log(`Sync complete: ${created} created, ${updated} updated, ${errors} errors, ${purchasesCreated} purchases imported`)
    
    return NextResponse.json({
      success: true,
      customers: { created, updated, errors, total: customers.length },
      purchases: { created: purchasesCreated, total: invoices.length },
    })
    
  } catch (err) {
    console.error('Sync error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Helper function to parse QuickBooks product names
function parseProduct(itemName: string, description: string): {
  category: string
  brand: string | null
  productName: string
  description: string | null
  size: string | null
} | null {
  const itemLower = itemName.toLowerCase()
  
  // Skip custom items - they go through Trinity
  if (itemLower.includes('ccvp') || itemLower.includes('custom coat') || 
      itemLower.includes('custom suit') || itemLower.includes('custom pant') ||
      itemLower.includes('custom shirt') || itemLower.includes('custom trouser') ||
      itemLower.includes('csc') || itemLower.includes('ct') || itemLower.includes('cv')) {
    return null
  }
  
  // Magnanni shoes
  if (itemLower.includes('magnanni')) {
    const sizeMatch = description.match(/(\d+\.?\d*)/);
    return {
      category: 'shoes',
      brand: 'Magnanni',
      productName: 'Magnanni Shoes',
      description: description,
      size: sizeMatch ? sizeMatch[1] : null,
    }
  }
  
  // 34 Heritage jeans
  if (itemLower.includes('34 heritage') || itemLower.includes('heritage')) {
    const sizeMatch = description.match(/(\d+x\d+|\d+)/i);
    return {
      category: 'jeans',
      brand: '34 Heritage',
      productName: itemName.includes('Short') ? '34 Heritage Shorts' : '34 Heritage Jeans',
      description: description,
      size: sizeMatch ? sizeMatch[0] : null,
    }
  }
  
  // Belts
  if (itemLower.includes('belt')) {
    const sizeMatch = description.match(/(\d+)/);
    return {
      category: 'belt',
      brand: null,
      productName: itemName,
      description: description,
      size: sizeMatch ? sizeMatch[0] : null,
    }
  }
  
  // Ready-made catch-all
  if (itemLower.includes('ready-made') || itemLower.includes('ready made')) {
    return {
      category: 'other',
      brand: null,
      productName: itemName,
      description: description,
      size: null,
    }
  }
  
  // Socks, accessories
  if (itemLower.includes('sock')) {
    return {
      category: 'accessories',
      brand: null,
      productName: itemName,
      description: description,
      size: null,
    }
  }
  
  // Skip anything else (probably custom items we didn't catch)
  return null
}
