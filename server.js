
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// Настройки магазина
const SHOP_ID = '1223028';
const SECRET_KEY = 'test_epdm18C2SIOTlmED5m05Q-jXQDTsgJJK28m8JwdxlBM';

app.use(cors()); // Разрешаем запросы с React (localhost:3000)
app.use(express.json());

app.post('/create-payment', async (req, res) => {
    try {
        const { amount, returnUrl, description } = req.body;
        const idempotenceKey = Math.random().toString(36).substring(7);
        
        // Формируем заголовок авторизации
        const auth = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64');

        const response = await axios.post('https://api.yookassa.ru/v3/payments', {
            amount: {
                value: amount || "1.00",
                currency: "RUB"
            },
            capture: true,
            confirmation: {
                type: "redirect",
                return_url: returnUrl
            },
            description: description || "Оплата StyleVision"
        }, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Idempotence-Key': idempotenceKey,
                'Content-Type': 'application/json'
            }
        });

        // Отдаем ответ Юкассы обратно на фронтенд
        res.json(response.data);

    } catch (error) {
        console.error('Ошибка ЮКассы:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Payment creation failed', details: error.message });
    }
});

// Новый эндпоинт для отправки фото (для поддержки локального сервера или Amvera)
app.post('/api/send-photo', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
      console.error("TELEGRAM_BOT_TOKEN is missing");
      return res.status(500).json({ error: 'Bot token not configured' });
  }

  try {
      const { chatId, image, caption } = req.body;
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append("chat_id", chatId);
      formData.append("photo", buffer, "stylevision_look.png");
      if (caption) formData.append("caption", caption);

      const response = await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, formData, {
          headers: formData.getHeaders()
      });

      res.json({ success: true, data: response.data });
  } catch (error) {
      console.error('Send Photo Error:', error.response ? error.response.data : error.message);
      res.status(500).json({ error: 'Failed to send photo', details: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Local Payment Server running on http://localhost:${PORT}`);
});
