import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // Log the order data to console
    console.log('New order received:', JSON.stringify(data, null, 2));

    // TODO: Send to Telegram bot or email
    // The order data includes: photoMethod, comment, delivery, contact, productInfo

    // For now, just return success
    // Later this can be connected to:
    // - Telegram Bot API to send notification to admin chat
    // - Email service (SendGrid, Resend, etc.) to send email notification
    // - Database to store order data

    return NextResponse.json({
      success: true,
      message: 'Order received successfully'
    });
  } catch (error) {
    console.error('Error processing order:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process order' },
      { status: 500 }
    );
  }
}
