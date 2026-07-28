import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PWA required square resolutions
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('=== MERCADO LUSO - SHARP PWA ICON GENERATOR ===');
  
  const publicDir = path.join(__dirname, 'public');
  const iconsDir = path.join(publicDir, 'icons');
  const sourceLogo = path.join(__dirname, 'logo.png');
  
  // 1. Ensure icons folder exists
  if (!fs.existsSync(iconsDir)) {
    console.log(`Criando pasta de ícones: ${iconsDir}`);
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  // 2. Check if source logo.png is present, otherwise create a beautiful default green square vector drawing
  if (!fs.existsSync(sourceLogo)) {
    console.log('⚠️ [AVISO] O arquivo logo.png não foi localizado na raiz do projeto!');
    console.log('Criando um logo.png de backup (fundo verde #046a38 oficial com sacola branca) usando Sharp...');
    
    // SVG representation of the Mercado Luso Shopping Bag
    const svgContent = `
      <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" fill="#046a38" />
        <!-- Shopping Bag Handle -->
        <path d="M 256,110 C 202,110 202,180 202,180" fill="none" stroke="#ffffff" stroke-width="18" stroke-linecap="round" />
        <path d="M 256,110 C 310,110 310,180 310,180" fill="none" stroke="#ffffff" stroke-width="18" stroke-linecap="round" />
        <!-- Shopping Bag Body -->
        <path d="M 170,180 L 342,180 L 360,400 C 360,415 348,425 335,425 L 177,425 C 164,425 152,415 152,400 Z" fill="#ffffff" />
      </svg>
    `;
    
    await sharp(Buffer.from(svgContent))
      .png()
      .toFile(sourceLogo);
      
    console.log('✅ Arquivo logo.png temporário de backup gerado com sucesso!');
  }
  
  // 3. Process resizing for all specified sizes
  console.log('\n--- 1. Redimensionando ícones PWA ---');
  for (const size of ICON_SIZES) {
    try {
      const destPath = path.join(iconsDir, `icon-${size}.png`);
      const destFallbackPath = path.join(publicDir, `icon-${size}.png`);
      
      await sharp(sourceLogo)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 4, g: 106, b: 56, alpha: 1 } // ensure official green fill
        })
        .png()
        .toFile(destPath);
        
      // Ensure we have a copy in the root public folder too
      fs.copyFileSync(destPath, destFallbackPath);
      
      console.log(`✅ Gerado: icons/icon-${size}.png e public/icon-${size}.png (${size}x${size}px)`);
    } catch (err) {
      console.error(`❌ Erro gerando ícone ${size}x${size}:`, err.message);
    }
  }
  
  // 4. Process Apple Touch Icon (180x180)
  try {
    const destApple = path.join(iconsDir, 'apple-touch-icon.png');
    const destAppleFallback = path.join(publicDir, 'apple-touch-icon.png');
    
    await sharp(sourceLogo)
      .resize(180, 180, { fit: 'contain', background: { r: 4, g: 106, b: 56, alpha: 1 } })
      .png()
      .toFile(destApple);
      
    fs.copyFileSync(destApple, destAppleFallback);
    console.log('✅ Gerado: icons/apple-touch-icon.png e public/apple-touch-icon.png (180x180px)');
  } catch (err) {
    console.error('❌ Erro gerando apple-touch-icon:', err.message);
  }
  
  // 5. Process favicon.ico (32x32 size, single image ico)
  try {
    const destIcoFolder = path.join(iconsDir, 'favicon.ico');
    const destIcoFallback = path.join(publicDir, 'favicon.ico');
    
    // Generate temporary 32x32 png
    const tempBuffer32 = await sharp(sourceLogo)
      .resize(32, 32, { fit: 'contain', background: { r: 4, g: 106, b: 56, alpha: 1 } })
      .png()
      .toBuffer();
      
    // Write valid single ICO wrapper
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0); // Reserved
    icoHeader.writeUInt16LE(1, 2); // Type = 1 (ico)
    icoHeader.writeUInt16LE(1, 4); // Count = 1
    
    const icoEntry = Buffer.alloc(16);
    icoEntry.writeUInt8(32, 0); // Width
    icoEntry.writeUInt8(32, 1); // Height
    icoEntry.writeUInt8(0, 2);  // Colors
    icoEntry.writeUInt8(0, 3);  // Reserved
    icoEntry.writeUInt16LE(1, 4); // Planes
    icoEntry.writeUInt16LE(32, 6); // Bits per pixels
    icoEntry.writeUInt32LE(tempBuffer32.length, 8); // PNG size
    icoEntry.writeUInt32LE(22, 12); // Offset to image data
    
    const icoBuffer = Buffer.concat([icoHeader, icoEntry, tempBuffer32]);
    fs.writeFileSync(destIcoFolder, icoBuffer);
    fs.copyFileSync(destIcoFolder, destIcoFallback);
    
    console.log('✅ Gerado: icons/favicon.ico e public/favicon.ico (32x32px .ico format)');
  } catch (err) {
    console.error('❌ Erro gerando favicon.ico:', err.message);
  }
  
  console.log('\n🌟 PROCEDIMENTO CONCLUÍDO!');
}

generateIcons().catch(console.error);
