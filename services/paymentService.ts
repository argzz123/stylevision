// Yookassa Integration Service

export interface PaymentResponse {
  id: string;
  status: string;
  amount: {
    value: string;
    currency: string;
  };
  confirmation: {
    type: string;
    confirmation_url: string;
  };
  test: boolean;
}

/**
 * Creates a payment via Vercel Serverless Function
 */
export const createPayment = async (): Promise<PaymentResponse> => {
  
  // Используем относительный путь, который Vercel обработает как API запрос
  const SERVER_URL = '/api/create-payment';

  // Construct a return URL that signals success back to our app
  const returnUrl = new URL(window.location.href);
  returnUrl.searchParams.set('payment_processed', 'true');

  const paymentData = {
    amount: "1.00",
    returnUrl: returnUrl.toString(),
    description: "Подписка StyleVision PRO (Тест)"
  };

  try {
    const response = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });

    if (!response.ok) {
      throw new Error(`Payment Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Payment Service Error:', error);
    throw error;
  }
};