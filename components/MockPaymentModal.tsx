import React, { useState, useEffect } from 'react';

interface MockPaymentModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const MockPaymentModal: React.FC<MockPaymentModalProps> = ({ onSuccess, onClose }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-format card number
  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    val = val.substring(0, 16);
    val = val.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(val);
  };

  // Auto-format date
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length >= 2) {
        val = val.substring(0, 2) + '/' + val.substring(2, 4);
    }
    setExpiry(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (cardNumber.replace(/\s/g, '').length < 16) {
        setError('Неверный номер карты');
        return;
    }
    if (expiry.length < 5) {
        setError('Неверный срок действия');
        return;
    }
    if (cvc.length < 3) {
        setError('Введите CVC');
        return;
    }

    setIsLoading(true);

    // Simulate network request processing
    setTimeout(() => {
        setIsLoading(false);
        onSuccess();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-2xl relative">
        
        {/* Header similar to Yookassa */}
        <div className="bg-[#f2f3f5] p-4 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">Ю</div>
                <span className="font-bold text-gray-700">Kassa</span>
            </div>
            <div className="text-right">
                <p className="text-xs text-gray-500">Сумма к оплате</p>
                <p className="text-lg font-bold text-black">1.00 ₽</p>
            </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Номер карты</label>
                <div className="relative">
                    <input 
                        type="text" 
                        value={cardNumber}
                        onChange={handleCardChange}
                        placeholder="0000 0000 0000 0000"
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                    />
                    <div className="absolute right-3 top-3 opacity-50">
                        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="w-1/2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Срок (ММ/ГГ)</label>
                    <input 
                        type="text" 
                        value={expiry}
                        maxLength={5}
                        onChange={handleDateChange}
                        placeholder="MM / YY"
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-center"
                    />
                </div>
                <div className="w-1/2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">CVC / CWW</label>
                    <input 
                        type="password" 
                        value={cvc}
                        maxLength={3}
                        onChange={(e) => setCvc(e.target.value.replace(/\D/g,''))}
                        placeholder="123"
                        className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-center"
                    />
                </div>
            </div>

            {error && (
                <p className="text-red-500 text-xs text-center">{error}</p>
            )}

            <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition-all shadow-lg flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                ) : (
                    'Оплатить 1.00 ₽'
                )}
            </button>
            
            <button 
                type="button" 
                onClick={onClose}
                className="w-full text-xs text-gray-400 hover:text-gray-600 mt-2"
            >
                Отменить оплату
            </button>
        </form>

        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex justify-center gap-4 opacity-60 grayscale">
            {/* Fake Logos for realism */}
            <div className="h-4 w-8 bg-gray-300 rounded"></div>
            <div className="h-4 w-8 bg-gray-300 rounded"></div>
            <div className="h-4 w-8 bg-gray-300 rounded"></div>
        </div>
      </div>
    </div>
  );
};

export default MockPaymentModal;