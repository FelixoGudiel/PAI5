const sqlite3 = require('sqlite3').verbose();

// Conectarse a la base de datos SQLite
const db = new sqlite3.Database('./mydatabase.db', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error al conectar a la base de datos: ' + err.message);
        return;
    }
    console.log('Conectado a la base de datos SQLite.');
});

// Función para consultar y mostrar los datos de la base de datos
function viewDatabaseContents() {
    console.log("Viendo el contenido de la base de datos...");
    db.all("SELECT id, timestamp, data, signatureValid, publicKey FROM Requests", [], (err, rows) => {
        if (err) {
            console.error("Error al consultar la base de datos: ", err.message);
            return;
        }
        // Imprimir los resultados de la consulta
        if (rows.length > 0) {
            rows.forEach((row) => {
                console.log(`ID: ${row.id}, Timestamp: ${row.timestamp}, Data: ${row.data}, Signature Valid: ${row.signatureValid}, Public Key: ${row.publicKey}`);
            });
        } else {
            console.log("No hay datos disponibles para mostrar.");
        }
        // Cerrar la base de datos
        db.close((err) => {
            if (err) {
                console.error(err.message);
            }
            console.log('Cerrada la conexión a la base de datos.');
        });
    });
}

// Llamar a la función para ver el contenido
viewDatabaseContents();
