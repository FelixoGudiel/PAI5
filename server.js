const net = require('net');
const crypto = require('crypto');

const sqlite3 = require('sqlite3').verbose();
// Cambiar ':memory:' por 'mydatabase.db' para almacenar la base de datos en un archivo
const db = new sqlite3.Database('mydatabase.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Conectado a la base de datos SQLite en mydatabase.db.');
});

db.serialize(() => {
    
    db.run(`CREATE TABLE IF NOT EXISTS Requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        data TEXT NOT NULL,
        signatureValid INTEGER NOT NULL,
        publicKey TEXT NOT NULL
    )`);
});


const server = net.createServer(socket => {
    let chunks = [];

    socket.on('data', chunk => {
        chunks.push(chunk);
    });

    socket.on('end', () => {
        const buffer = Buffer.concat(chunks);
        handleReceivedData(buffer);
    });
});

server.listen(7070, () => {
    console.log('Servidor escuchando en puerto 7070');
});

server.on('error', (err) => {
    console.error(`Error del servidor: ${err}`);
});

function handleReceivedData(buffer) {
    // Leer las longitudes de los datos, la firma y la clave pública
    const dataLength = buffer.readInt32BE(0);
    const data = buffer.slice(4, 4 + dataLength).toString();

    const signatureLength = buffer.readInt32BE(4 + dataLength);
    const signature = buffer.slice(4 + dataLength + 4, 4 + dataLength + 4 + signatureLength);

    const publicKeyLength = buffer.readInt32BE(4 + dataLength + 4 + signatureLength);
    const publicKeyString = buffer.slice(4 + dataLength + 4 + signatureLength + 4, 4 + dataLength + 4 + signatureLength + 4 + publicKeyLength).toString();

    verifyData(data, signature, publicKeyString);
}

function verifyData(data, signature, publicKeyString) {
    try {
        const publicKey = crypto.createPublicKey({
            key: publicKeyString,
            format: 'pem'
        });

        const verifier = crypto.createVerify('SHA256');
        verifier.update(data);
        const isValid = verifier.verify(publicKey, signature);

        const timestamp = new Date().toISOString();
        const signatureValid = isValid ? 1 : 0;

        // Insertar el resultado en la base de datos SQLite, incluyendo la clave pública
        db.run('INSERT INTO Requests (timestamp, data, signatureValid, publicKey) VALUES (?, ?, ?, ?)', 
            [timestamp, data, signatureValid, publicKeyString], function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`A row has been inserted with rowid ${this.lastID}`);
        });

        if (isValid) {
            console.log("Firma verificada con éxito.");
            processReceivedData(data);
        } else {
            console.log("Firma no verificada.");
        }
    } catch (err) {
        console.error("Error al verificar la firma: ", err.message);
    }
}

function processReceivedData(data) {
    console.log("Procesando datos recibidos...");
    const items = data.split(', ').reduce((acc, item) => {
        const [key, value] = item.split(': ');
        acc[key.trim()] = parseInt(value, 10);
        return acc;
    }, {});
    console.log("Datos procesados: ", items);
}


process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Cerrando la conexión a la base de datos.');
    });
    process.exit();
});