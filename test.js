const net = require('net');
const crypto = require('crypto');

function generateKeyPair() {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
}

function signData(data, privateKey, shouldCorrupt) {
    const signer = crypto.createSign('SHA256');
    signer.update(data);
    signer.end();
    const signature = signer.sign(privateKey);
    // Corromper la firma aproximadamente 1/3 de las veces
    if (shouldCorrupt) {
        console.log("Enviando firma corrupta.");
        return Buffer.from(signature).map(byte => byte ^ 0x01); // Modificar cada byte ligeramente
    }
    return signature;
}

function generateRandomData() {
    // Genera valores aleatorios para camas, mesas, sillas y sillones entre 0 y 300
    const camas = Math.floor(Math.random() * 301);
    const mesas = Math.floor(Math.random() * 301);
    const sillas = Math.floor(Math.random() * 301);
    const sillones = Math.floor(Math.random() * 301);
    return `Camas: ${camas}, Mesas: ${mesas}, Sillas: ${sillas}, Sillones: ${sillones}`;
}

function sendData(index, totalRequests) {
    const data = generateRandomData(); // Generar datos aleatorios para cada petición
    const shouldCorrupt = Math.random() < 0.33; // Determinar si se debe corromper la firma
    const client = new net.Socket();
    client.connect(7070, '192.168.56.1', () => {
        console.log(`Connected to server for request ${index + 1} of ${totalRequests}!`);

        const { privateKey, publicKey } = generateKeyPair();
        const signature = signData(data, privateKey, shouldCorrupt);

        const dataBuffer = Buffer.from(data);
        const signatureBuffer = Buffer.from(signature);
        const publicKeyBuffer = Buffer.from(publicKey);

        client.write(Buffer.concat([
            Buffer.from([dataBuffer.length >>> 24, dataBuffer.length >>> 16 & 0xFF, dataBuffer.length >>> 8 & 0xFF, dataBuffer.length & 0xFF]),
            dataBuffer,
            Buffer.from([signatureBuffer.length >>> 24, signatureBuffer.length >>> 16 & 0xFF, signatureBuffer.length >>> 8 & 0xFF, signatureBuffer.length & 0xFF]),
            signatureBuffer,
            Buffer.from([publicKeyBuffer.length >>> 24, publicKeyBuffer.length >>> 16 & 0xFF, publicKeyBuffer.length >>> 8 & 0xFF, publicKeyBuffer.length & 0xFF]),
            publicKeyBuffer
        ]), () => {
            client.end(); // Cerrar la conexión después de enviar los datos
        });

        client.on('close', () => {
            console.log(`Connection for request ${index + 1} of ${totalRequests} closed.`);
            if (index < totalRequests - 1) {
                setTimeout(() => sendData(index + 1, totalRequests), 1000); // Espaciar las peticiones por 1 segundo
            }
        });

        client.on('error', (err) => {
            console.error('Error: ' + err.message);
        });
    });
}

// Iniciar el envío de un número definido de peticiones, por ejemplo 10 o 100
const totalRequests = 10; // Cambiar este número para probar con diferentes cantidades de peticiones
sendData(0, totalRequests);
