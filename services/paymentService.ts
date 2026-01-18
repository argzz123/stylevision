
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
export const createPayment = async (amount: string, description: string): Promise<PaymentResponse> => {
  
  // UPDATED: Absolute URL for Vercel
  const SERVER_URL = 'https://stylevision.vercel.app/api/create-payment';

  // We do NOT add 'payment_processed=true' here manually anymore to prevent fake success.
  // We just return to the app, and the app will check localStorage for pending payment IDs.
  const returnUrl = window.location.href;

  const paymentData = {
    amount: amount,
    returnUrl: returnUrl,
    description: description
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
    
    // SAVE ID TO LOCAL STORAGE for verification later
    if (data.id) {
        localStorage.setItem('pending_payment_id', data.id);
    }

    return data;

  } catch (error) {
    console.error('Payment Service Error:', error);
    throw error;
  }
};

/**
 * Verify payment status with backend
 */
export const checkPaymentStatus = async (paymentId: string): Promise<boolean> => {
    try {
        // UPDATED: Absolute URL for Vercel
        const response = await fetch('https://stylevision.vercel.app/api/check-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentId })
        });
        
        if (!response.ok) return false;
        
        const data = await response.json();
        return data.status === 'succeeded' || data.paid === true;
    } catch (e) {
        console.error("Verification failed", e);
        return false;
    }
}
