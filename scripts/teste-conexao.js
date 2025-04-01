const { conectar } = require('./src/config/db');

async function testarConexao() {
    try {
        const db = await conectar();
        console.log("Conexão bem sucedida!");
        
        // Tenta criar uma coleção de teste
        await db.createCollection("teste");
        console.log("Coleção de teste criada!");
        
        // Tenta inserir um documento
        const resultado = await db.collection("teste").insertOne({
            teste: "Conexão funcionando",
            data: new Date()
        });
        console.log("Documento inserido:", resultado);
        
    } catch (error) {
        console.error("Erro no teste:", error);
    }
}

testarConexao();