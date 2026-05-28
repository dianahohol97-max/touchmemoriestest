import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const name = formData.get('name') as string
    const lastName = formData.get('lastName') as string
    const phone = formData.get('phone') as string
    const contactChannel = formData.get('contactChannel') as string
    const contactHandle = formData.get('contactHandle') as string
    const comment = formData.get('comment') as string
    const delivery = formData.get('delivery') as string
    const city = formData.get('city') as string
    const address = formData.get('address') as string
    const productSlug = formData.get('productSlug') as string
    const coverInscription = formData.get('coverInscription') as string
    const coverPhoto = formData.get('coverPhoto') as File | null
    const photos = formData.getAll('photos') as File[]

    console.log('New designer order:', {
      name, lastName, phone, contactChannel, contactHandle,
      comment, delivery, city, address, productSlug,
      coverInscription,
      coverPhotoName: coverPhoto?.name || null,
      photoCount: photos.length,
      photoNames: photos.map(p => p.name),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Order API error:', error)
    return NextResponse.json({ success: false, error: 'Failed to process order' }, { status: 500 })
  }
}
