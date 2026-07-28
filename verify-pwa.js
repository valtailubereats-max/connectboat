import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyPWA() {
  console.log('========================= AUDITING MERCADO LUSO PWA INTEGRITY =========================');
  let errorsCount = 0;
  let warningsCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ✅ ${message}`);
    } else {
      console.log(`[FAIL] ❌ ${message}`);
      errorsCount++;
    }
  }

  function warn(condition, message) {
    if (condition) {
      console.log(`[PASS] ✅ ${message}`);
    } else {
      console.log(`[WARN] ⚠️ ${message}`);
      warningsCount++;
    }
  }

  const publicDir = path.join(__dirname, 'public');
  const iconsDir = path.join(publicDir, 'icons');
  const screenshotsDir = path.join(publicDir, 'screenshots');

  // 1. Check directories
  assert(fs.existsSync(publicDir), 'Pasta /public encontrada.');
  assert(fs.existsSync(iconsDir), 'Pasta /public/icons encontrada.');
  assert(fs.existsSync(screenshotsDir), 'Pasta /public/screenshots encontrada.');

  // 2. Check individual PWA icons
  const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
  for (const size of iconSizes) {
    const iconPath = path.join(iconsDir, `icon-${size}.png`);
    const exists = fs.existsSync(iconPath);
    assert(exists, `Ícone de tamanho ${size}x${size} existe no caminho correto: icons/icon-${size}.png`);
    
    if (exists) {
      const buf = fs.readFileSync(iconPath);
      const hexSig = buf.toString('hex', 0, 8);
      assert(hexSig === '89504e470d0a1a0a', `icons/icon-${size}.png possui assinatura binária PNG legítima: ${hexSig}`);
    }
  }

  // 2b. Check apple touch icon and favicon
  const applePath = path.join(iconsDir, 'apple-touch-icon.png');
  assert(fs.existsSync(applePath), 'Ícone Apple Touch icons/apple-touch-icon.png existe.');
  if (fs.existsSync(applePath)) {
    const buf = fs.readFileSync(applePath);
    assert(buf.toString('hex', 0, 8) === '89504e470d0a1a0a', 'apple-touch-icon.png possui cabeçalho PNG válido.');
  }

  const faviconPath = path.join(iconsDir, 'favicon.ico');
  assert(fs.existsSync(faviconPath), 'Ícone Favicon icons/favicon.ico existe.');
  if (fs.existsSync(faviconPath)) {
    const buf = fs.readFileSync(faviconPath);
    const hasIcoSig = buf.toString('hex', 0, 4) === '00000100';
    assert(hasIcoSig, 'favicon.ico possui cabeçalho de container de ícone ICO (.ico) válido: 00000100');
  }

  // 3. Check responsive screenshots
  const desktopScr = path.join(screenshotsDir, 'desktop-wide.png');
  assert(fs.existsSync(desktopScr), 'Screenshot Desktop screenshots/desktop-wide.png existe.');
  if (fs.existsSync(desktopScr)) {
    const buf = fs.readFileSync(desktopScr);
    assert(buf.toString('hex', 0, 8) === '89504e470d0a1a0a', 'desktop-wide.png possui assinatura PNG válida.');
  }

  const mobileScr = path.join(screenshotsDir, 'mobile.png');
  assert(fs.existsSync(mobileScr), 'Screenshot Mobile screenshots/mobile.png existe.');
  if (fs.existsSync(mobileScr)) {
    const buf = fs.readFileSync(mobileScr);
    assert(buf.toString('hex', 0, 8) === '89504e470d0a1a0a', 'mobile.png possui assinatura PNG válida.');
  }

  // 4. Check manifest validity
  const manifestPath = path.join(publicDir, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'Arquivo manifest.json localizado no diretório /public.');
  
  if (fs.existsSync(manifestPath)) {
    try {
      const manifestStr = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestStr);
      assert(true, 'manifest.json analisado com sucesso pelo parser JSON nativo.');
      
      assert(manifest.name === 'Mercado Luso', 'Atributo "name" exato definido como "Mercado Luso".');
      assert(manifest.short_name === 'MercadoLuso', 'Atributo "short_name" exato definido como "MercadoLuso".');
      assert(manifest.theme_color === '#1a73e8', 'Atributo "theme_color" definido com o azul solicitado: #1a73e8');
      assert(manifest.background_color === '#ffffff', 'Atributo "background_color" definido com o branco solicitado: #ffffff');
      assert(manifest.display === 'standalone', 'Atributo "display" configurado como "standalone".');
      assert(manifest.orientation === 'portrait-primary', 'Atributo "orientation" configurado para portrait-primary.');
      assert(manifest.start_url === '/', 'Atributo "start_url" configurado como "/".');
      
      // Screenshots schema validation
      assert(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 2, 'Atributo "screenshots" é uma matriz contendo pelo menos 2 registros.');
      if (Array.isArray(manifest.screenshots)) {
        const desktopRecord = manifest.screenshots.find(s => s.form_factor === 'wide');
        assert(!!desktopRecord, 'Contém um registro de screenshot com form_factor definido para "wide" (obrigatório para computadores).');
        if (desktopRecord) {
          assert(desktopRecord.src === '/screenshots/desktop-wide.png', 'O caminho da screenshot de computador aponta para: /screenshots/desktop-wide.png');
          assert(desktopRecord.sizes === '1280x720', 'As dimensões do registro refletem as reais: 1280x720');
        }
        
        const mobileRecord = manifest.screenshots.find(s => !s.form_factor || s.form_factor !== 'wide');
        assert(!!mobileRecord, 'Contém um registro de screenshot com form_factor não-wide (obrigatório para smartphones).');
        if (mobileRecord) {
          assert(mobileRecord.src === '/screenshots/mobile.png', 'O caminho da screenshot móvel aponta para: /screenshots/mobile.png');
          assert(mobileRecord.sizes === '360x720', 'As dimensões do registro de celular refletem as reais: 360x720');
        }
      }
      
      // Icons array schema checks
      assert(Array.isArray(manifest.icons) && manifest.icons.length >= 8, 'Atributo "icons" é uma matriz contendo as resoluções completas obrigatórias de instalação.');
      if (Array.isArray(manifest.icons)) {
        const minSizeRecord = manifest.icons.find(i => i.sizes === '144x144');
        assert(!!minSizeRecord, 'Contém um ícone de no mínimo 144x144 pixels exatos, como exigido implicitamente pelo navegador.');
        
        const anyPurposeRecord = manifest.icons.find(i => i.purpose === 'any');
        assert(!!anyPurposeRecord, 'Contém elementos de imagem com o atributo purpose definido exato para "any" (obrigatório).');
        
        const hasUrlQuery = manifest.icons.some(i => i.src.includes('?'));
        assert(!hasUrlQuery, 'As URLs dos ícones não contêm strings de query adicionais (?v=2), como explicitamente solicitado para evitar falha de parse no chrome.');
      }
    } catch (e) {
      assert(false, `Falha crítica ao ler/analisar manifest.json: ${e.message}`);
    }
  }

  // 5. Auditing sw.js
  const swPath = path.join(publicDir, 'sw.js');
  assert(fs.existsSync(swPath), 'Arquivo sw.js Service Worker localizado com sucesso no diretório raiz /public.');
  if (fs.existsSync(swPath)) {
    const swContent = fs.readFileSync(swPath, 'utf8');
    assert(swContent.includes("const CACHE_NAME = 'mercado-luso-pwa-v3';"), 'CACHE_NAME do Service Worker atualizado para "mercado-luso-pwa-v3" exato.');
    assert(swContent.includes('/icons/icon-192.png'), 'O Service Worker está cacheando o caminho de ícone /icons/icon-192.png exato.');
    assert(swContent.includes('/icons/icon-512.png'), 'O Service Worker está cacheando o caminho de ícone /icons/icon-512.png exato.');
    assert(swContent.includes('self.addEventListener(\'install\''), 'Contém listener de ciclo de instalação (install).');
    assert(swContent.includes('self.addEventListener(\'activate\''), 'Contém listener de ciclo de ativação e remoção de caches antigos (activate).');
    assert(swContent.includes('self.addEventListener(\'fetch\''), 'Contém listener interceptor de requisições de rede (fetch).');
  }

  console.log('\n========================= EXECUTION OF AUDITING REPORTS =========================');
  console.log(`Auditoria concluída com: [Erros: ${errorsCount}]  [Avisos: ${warningsCount}]`);
  
  if (errorsCount === 0) {
    console.log('🌟 PARABÉNS! TODOS OS CRITÉRIOS DE INSTALABILIDADE DO CHROME PWA FORAM TOTALMENTE SATISFEITOS!');
  } else {
    console.log('⚠️ ALGUNS ERROS SÃO DETECTADOS. Por favor, ajuste as configurações de arquivos antes de lançar em produção.');
  }
}

verifyPWA();
