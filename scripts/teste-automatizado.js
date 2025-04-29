const puppeteer = require('puppeteer');

async function delay(time) {
    return new Promise(function(resolve) {
        setTimeout(resolve, time);
    });
}

async function simularEscolha() {
    console.log('🤖 Iniciando teste automatizado...');
    
    const browser = await puppeteer.launch({
        headless: false, // false para visualizar o processo
        defaultViewport: null,
        args: ['--start-maximized']
    });

    try {
        const page = await browser.newPage();
        console.log('📱 Acessando sistema...');
        await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });

        // Login
        console.log('🔑 Realizando login...');
        await page.type('#nome', 'TESTE');
        await page.select('#turma', '1I01');
        await page.click('.btn');

        // Aguarda carregamento da página de escolhas
        await page.waitForSelector('.lista-tutores', { timeout: 5000 });
        console.log('✅ Login realizado com sucesso!');

        // Aguarda um momento para os professores carregarem
        await delay(2000);

        // Seleciona 3 professores
        console.log('👥 Selecionando professores...');
        const professores = await page.$$('.card-professor');
        for (let i = 0; i < 3 && i < professores.length; i++) {
            await professores[i].click();
            await delay(500); // Pequena pausa entre seleções
        }

        console.log('📝 Professores selecionados!');

        // Confirma as escolhas
        console.log('✍️ Confirmando escolhas...');
        await page.click('#btn-confirmar');

        // Aguarda o processamento
        await delay(5000);
        console.log('🎉 Teste concluído com sucesso!');

    } catch (error) {
        console.error('❌ Erro durante o teste:', error);
    } finally {
        // Aguarda 5 segundos antes de fechar o navegador
        await delay(5000);
        await browser.close();
        console.log('🏁 Teste finalizado');
    }
}

// Executa o teste
simularEscolha().catch(console.error); 