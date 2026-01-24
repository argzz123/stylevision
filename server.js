
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path'); // Импорт path для работы с путями
const app = express();

// Настройки магазина
const SHOP_ID = '1254700';
const SECRET_KEY = 'test_iCFbKUwMgGqxOuPZ23LbXv--BPh8oDZEG_UJ2wCLHaw';

// Увеличиваем лимит payload для приема больших картинок (Base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());

// --- API ROUTES ---

app.post('/api/create-payment', async (req, res) => {
    try {
        const { amount, returnUrl, description } = req.body;
        const idempotenceKey = Math.random().toString(36).substring(7);
        
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

        res.json(response.data);

    } catch (error) {
        console.error('Ошибка ЮКассы:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Payment creation failed', details: error.message });
    }
});

// Эндпоинт отправки фото в Telegram
app.post('/api/send-photo', async (req, res) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
      console.error("ОШИБКА: TELEGRAM_BOT_TOKEN не найден в переменных окружения!");
      return res.status(500).json({ error: 'Bot token not configured on server' });
  }

  try {
      const { chatId, image, caption } = req.body;

      if (!image || !chatId) {
          return res.status(400).json({ error: 'No image or chatId provided' });
      }

      console.log(`Начинаем обработку фото для чата: ${chatId}`);

      // 1. Убираем префикс data:image...
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      
      // 2. Создаем Буфер из строки (стандарт Node.js)
      const buffer = Buffer.from(base64Data, 'base64');
      
      // 3. Используем библиотеку form-data
      const form = new FormData();
      form.append('chat_id', String(chatId)); // Telegram API требует string/int
      form.append('photo', buffer, { filename: 'stylevision_look.png', contentType: 'image/png' });
      if (caption) {
          form.append('caption', caption);
      }

      // 4. Отправляем через axios
      console.log(`Отправка в Telegram API...`);
      
      const telegramResponse = await axios.post(
          `https://api.telegram.org/bot${token}/sendPhoto`,
          form,
          {
              headers: {
                  ...form.getHeaders()
              },
              maxContentLength: Infinity,
              maxBodyLength: Infinity
          }
      );

      console.log('Telegram Ответ:', telegramResponse.data ? 'OK' : 'Empty');
      res.json({ success: true, result: telegramResponse.data });

  } catch (error) {
      const errorDetails = error.response ? error.response.data : error.message;
      console.error('Send Photo Error:', errorDetails);
      res.status(500).json({ 
          error: 'Failed to send photo', 
          details: errorDetails
      });
  }
});

// --- СТАТИЧЕСКИЕ ФАЙЛЫ (React Frontend) ---
// Это заставляет Node.js отдавать собранное React приложение
app.use(express.static(path.join(__dirname, 'dist')));

// Любой другой запрос, который не API, возвращает index.html (для React Router и SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Используем process.env.PORT для Amvera/Heroku/etc, иначе 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
