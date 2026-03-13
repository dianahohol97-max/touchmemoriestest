import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

async function testConnection() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data, error } = await supabase.from('products').select('*').limit(1)
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('✅ Supabase connected (Table "products" exists but is empty/unavailable for select).')
      } else {
        console.error('❌ Supabase error:', error.message)
      }
    } else {
      console.log('✅ Supabase connected successfully.')
    }
  } catch (err) {
    console.error('❌ Supabase connection failed:', err)
  }
}

testConnection()
