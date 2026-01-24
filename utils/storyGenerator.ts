
// Utility to generate a styled story image (1080x1920)

export const generateStoryImage = async (
  beforeUrl: string,
  afterUrl: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Story Resolution (HD Vertical)
    const width = 1080;
    const height = 1920;
    
    canvas.width = width;
    canvas.height = height;

    if (!ctx) {
      reject(new Error("Canvas context not supported"));
      return;
    }

    // --- 1. Background ---
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    // --- 2. Load Images ---
    const loadImg = (src: string): Promise<HTMLImageElement> => {
      return new Promise((res, rej) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => res(img);
        img.onerror = (e) => rej(e);
        img.src = src;
      });
    };

    Promise.all([loadImg(beforeUrl), loadImg(afterUrl)])
      .then(([imgBefore, imgAfter]) => {
        
        // --- 3. Layout Configuration ---
        const photoHeight = 780; // Height of each photo section
        const margin = 40;
        const photoWidth = width - (margin * 2);
        
        const topY = 220; // Y position for top photo
        const bottomY = topY + photoHeight + 40; // Y position for bottom photo

        // Helper to draw image cover
        const drawImageCover = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
          // Draw border/container
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 30); // Rounded corners
          ctx.clip();

          // Draw Image Cover logic
          const imgRatio = img.width / img.height;
          const targetRatio = w / h;
          let renderW, renderH, renderX, renderY;

          if (imgRatio > targetRatio) {
            renderH = h;
            renderW = h * imgRatio;
            renderX = x + (w - renderW) / 2;
            renderY = y;
          } else {
            renderW = w;
            renderH = w / imgRatio;
            renderX = x;
            renderY = y + (h - renderH) / 2;
          }
          ctx.drawImage(img, renderX, renderY, renderW, renderH);
          
          // Inner Shadow overlay
          const gradient = ctx.createLinearGradient(0, y, 0, y + h);
          gradient.addColorStop(0, 'rgba(0,0,0,0.1)');
          gradient.addColorStop(0.8, 'rgba(0,0,0,0)');
          gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, w, h);

          ctx.restore();

          // Border stroke
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 30);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#262626';
          ctx.stroke();
        };

        // Draw Images
        drawImageCover(imgBefore, margin, topY, photoWidth, photoHeight);
        drawImageCover(imgAfter, margin, bottomY, photoWidth, photoHeight);

        // --- 4. Labels ---
        const drawLabel = (text: string, x: number, y: number) => {
           ctx.save();
           ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
           ctx.beginPath();
           ctx.roundRect(x, y, 200, 60, 15);
           ctx.fill();
           ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'; // Amber
           ctx.lineWidth = 2;
           ctx.stroke();
           
           ctx.fillStyle = '#ffffff';
           ctx.font = 'bold 28px Manrope, sans-serif';
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           ctx.fillText(text.toUpperCase(), x + 100, y + 30);
           ctx.restore();
        };

        drawLabel("Было", margin + 30, topY + 30);
        drawLabel("Стало", margin + 30, bottomY + 30);

        // --- 5. Header Branding ---
        ctx.save();
        ctx.fillStyle = '#d97706'; // Amber-600
        ctx.font = 'italic 700 80px "Playfair Display", serif';
        ctx.textAlign = 'center';
        ctx.fillText('S', width / 2, 120);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '40px "Playfair Display", serif';
        ctx.letterSpacing = "4px";
        ctx.fillText('STYLEVISION', width / 2, 170);
        ctx.restore();

        // --- 6. Divider Element ---
        const midY = (topY + photoHeight + bottomY) / 2;
        ctx.save();
        ctx.strokeStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(width/2 - 50, midY);
        ctx.lineTo(width/2 + 50, midY);
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();

        // --- 7. Footer text ---
        ctx.save();
        ctx.fillStyle = '#737373';
        ctx.font = '24px Manrope, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Сгенерировано AI Стилистом', width / 2, height - 80);
        ctx.restore();

        // --- 8. Export ---
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        resolve(dataUrl);
      })
      .catch(err => {
        console.error("Story generation failed", err);
        reject(err);
      });
  });
};
