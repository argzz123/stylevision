
// Utility to generate a styled story image (1080x1920)

export const generateStoryImage = async (
  imageUrl: string
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

    // --- 1. Background (Dark Luxury Gradient) ---
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#000000');
    bgGradient.addColorStop(1, '#111111');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Decorative Ambient Glow (Amber/Gold)
    const glow = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 800);
    glow.addColorStop(0, 'rgba(245, 158, 11, 0.05)'); // Very faint center
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // --- 2. Load Image ---
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
        // --- 3. Layout Configuration ---
        // Header ~250px
        // Footer ~150px
        // Image Area: Large central block
        
        const margin = 50;
        const cardWidth = width - (margin * 2);
        const cardHeight = 1350; // Large vertical image
        const cardX = margin;
        const cardY = 320; // Start below header

        // --- Draw Header (Branding) ---
        ctx.save();
        
        // Logo Circle
        const logoX = width / 2;
        const logoY = 140;
        const logoRad = 60;

        ctx.shadowColor = "rgba(245, 158, 11, 0.4)";
        ctx.shadowBlur = 20;
        
        ctx.beginPath();
        ctx.arc(logoX, logoY, logoRad, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0a0a';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#f59e0b'; // Amber-500
        ctx.stroke();
        
        // "S" Letter
        ctx.shadowBlur = 0; 
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'italic 700 70px "Playfair Display", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', logoX, logoY + 5);

        // App Name
        ctx.fillStyle = '#ffffff';
        ctx.font = '400 42px "Playfair Display", serif';
        ctx.letterSpacing = "6px";
        ctx.fillText('STYLEVISION', width / 2, logoY + 110);
        ctx.restore();

        // --- Draw Main Image (Rounded Card) ---
        ctx.save();
        
        // 1. Shadow for depth
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 50;
        ctx.shadowOffsetY = 20;

        // 2. Clipping Path (Rounded Rect)
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 40);
        ctx.clip();

        // 3. Draw Image (Cover Fit)
        const imgRatio = img.width / img.height;
        const targetRatio = cardWidth / cardHeight;
        let renderW, renderH, renderX, renderY;

        if (imgRatio > targetRatio) {
            renderH = cardHeight;
            renderW = cardHeight * imgRatio;
            renderX = cardX + (cardWidth - renderW) / 2;
            renderY = cardY;
        } else {
            renderW = cardWidth;
            renderH = cardWidth / imgRatio;
            renderX = cardX;
            renderY = cardY + (cardHeight - renderH) / 2;
        }
        ctx.drawImage(img, renderX, renderY, renderW, renderH);
        
        // 4. Inner Shadow / Vignette Overlay (for style)
        const gradient = ctx.createLinearGradient(0, cardY, 0, cardY + cardHeight);
        gradient.addColorStop(0, 'rgba(0,0,0,0.1)');
        gradient.addColorStop(0.8, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.restore();

        // --- Draw Border ---
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 40);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#333'; // Subtle border
        ctx.stroke();
        
        // Inner thin gold border
        ctx.beginPath();
        ctx.roundRect(cardX + 15, cardY + 15, cardWidth - 30, cardHeight - 30, 30);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.stroke();
        ctx.restore();

        // --- Badge (Optional) ---
        /*
        ctx.save();
        const badgeText = "AI LOOK";
        ctx.font = 'bold 24px Manrope, sans-serif';
        const badgeW = ctx.measureText(badgeText).width + 60;
        const badgeH = 60;
        const badgeX = cardX + cardWidth - badgeW - 30;
        const badgeY = cardY + 30;

        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 30);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#fff";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, badgeX + badgeW/2, badgeY + badgeH/2);
        ctx.restore();
        */

        // --- Footer ---
        ctx.save();
        ctx.fillStyle = '#666';
        ctx.font = '300 28px Manrope, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = "2px";
        ctx.fillText('PERSONAL AI STYLIST', width / 2, height - 100);
        ctx.restore();

        // --- Export ---
        try {
            const dataUrl = canvas.toDataURL('image/png', 0.95);
            resolve(dataUrl);
        } catch (e) {
            reject(e);
        }
    };

    img.onerror = (e) => {
        console.error("Story image load failed", e);
        reject(new Error("Failed to load image"));
    };

    img.src = imageUrl;
  });
};
