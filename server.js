const net = require("net");
const crypto = require("crypto");
const fs = require("fs");
const readline = require("readline");

const monthDictionary = {
  0: "Enero",
  1: "Febrero",
  2: "Marzo",
  3: "Abril",
  4: "Mayo",
  5: "Junio",
  6: "Julio",
  7: "Agosto",
  8: "Septiembre",
  9: "Octubre",
  10: "Noviembre",
  11: "Diciembre",
};

fs.open("tendenciaMensual.txt", "a", (err, file) => {
  if (err) throw err;
});

fs.readFile("tendenciaMensual.txt", "utf8", (err, data) => {
  if (err) throw err;
  if (data === "") {
    fs.writeFile("tendenciaMensual.txt", "mes,año,ratio,tendencia\n", (err) => {
      if (err) throw err;
    });
  }
});

const sqlite3 = require("sqlite3").verbose();
//Conexión a la base de datos estática para mantener en el tiempo los datos recibidos
const db = new sqlite3.Database("mydatabase.db", (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log("Conectado a la base de datos SQLite en mydatabase.db.");
});
//La base de datos tiene los atributos id, tiempo, la información de la petición, si la petición fue válida y la clave pública usada
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS Requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        data TEXT NOT NULL,
        signatureValid INTEGER NOT NULL,
        publicKey TEXT NOT NULL
    )`);
});

const server = net.createServer((socket) => {
  let chunks = [];

  socket.on("data", (chunk) => {
    chunks.push(chunk);
  });

  socket.on("end", () => {
    const buffer = Buffer.concat(chunks);
    handleReceivedData(buffer);
  });
});
//El servidor está activo en localhost:7070
server.listen(7070, () => {
  console.log("Servidor escuchando en puerto 7070");
});

server.on("error", (err) => {
  console.error(`Error del servidor: ${err}`);
});
//Cuando llegue una petición:
function handleReceivedData(buffer) {
  // Leer las longitudes de los datos, la firma y la clave pública
  const dataLength = buffer.readInt32BE(0);
  const data = buffer.slice(4, 4 + dataLength).toString();

  const signatureLength = buffer.readInt32BE(4 + dataLength);
  const signature = buffer.slice(
    4 + dataLength + 4,
    4 + dataLength + 4 + signatureLength
  );

  const publicKeyLength = buffer.readInt32BE(
    4 + dataLength + 4 + signatureLength
  );
  const publicKeyString = buffer
    .slice(
      4 + dataLength + 4 + signatureLength + 4,
      4 + dataLength + 4 + signatureLength + 4 + publicKeyLength
    )
    .toString();
  //Pasamos a verificar el contenido de la petición
  verifyData(data, signature, publicKeyString);
}

// Se actualiza el archivo tendenciaMensual.txt.
function updateTendenciaMensual() {
  const date = new Date();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  const monthString = month < 10 ? "0" + month : "" + month;
  const yearMonth = `${year}-${monthString}%`;

  // Obtener todas las entradas de la db cuyo año y mes sean iguales al actual.
  const dataTimestamp = new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM Requests WHERE timestamp LIKE ?`,
      [yearMonth + "%"],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });

  dataTimestamp
    .then((rows) => {
      // Obtenemos el ratio de las firmas válidas
      let numberValid = rows.filter((row) => row.signatureValid == 1).length;
      let ratio = numberValid / rows.length;
      ratio = ratio.toFixed(2);
      checkTendenciaMensual(ratio, month, year);
    })
    .catch((err) => {
      console.error(err);
    });
}

// Con esta función se compruba la tendencia actual con respecto a los dos meses anteriores.
function checkTendenciaMensual(ratio, month, year) {
  const fileStream = fs.createReadStream("tendenciaMensual.txt");
  let secondLastLine = "";
  let firstLastLine = "";

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lines = [];

  rl.on("line", (line) => {
    lines.push(line);
  });

  rl.on("close", () => {
    // Obtenemos las dos últimas líneas del archivo, que corresponden a los dos últimos méses
    secondLastLine = lines[lines.length - 2];
    if (secondLastLine === undefined) {
      secondLastLine = "";
    }
    firstLastLine = lines[lines.length - 1];

    secondLastLine = secondLastLine.split(",");
    firstLastLine = firstLastLine.split(",");

    let secondLastLineRatio = 0;
    let firstLastLineRatio = 0;

    if (secondLastLine.length > 0 && secondLastLine[0] != "mes") {
      secondLastLineRatio = parseFloat(secondLastLine[2]);
    }

    if (firstLastLine.length > 0 && firstLastLine[0] != "mes") {
      firstLastLineRatio = parseFloat(firstLastLine[2]);
    }

    let lastLineMonth = firstLastLine[0];
    let currentMonth = new Date().getMonth();
    currentMonth = monthDictionary[currentMonth];

    let tendencia = calculateTendenciaMensual(
      secondLastLineRatio,
      firstLastLineRatio,
      ratio
    );

    // Si el mes actual es igual al mes de la última línea, editamos la última línea. En caso contrario, añadimos una nueva línea con el nuevo mes.
    if (lastLineMonth === currentMonth) {
      // Editamos la última línea
      firstLastLine[2] = ratio;
      firstLastLine[3] = tendencia;
      lines[lines.length - 1] = firstLastLine.join(",");
    } else {
      // Añadimos una nueva línea
      const data = `${
        monthDictionary[month - 1]
      },${year},${ratio},${tendencia}\n`;
      lines.push(data);
    }

    // Reescribimo de nuevo todas las líneas en el archivo.
    fs.writeFile("tendenciaMensual.txt", lines.join("\n"), (err) => {
      if (err) {
        console.error(err);
      }
    });
  });
}

// Se calcula la tendnecia actual con respecto a los ratios de los dos meses anteriores.
function calculateTendenciaMensual(
  secondLastLineRatio,
  firstLastLineRatio,
  ratio
) {
  let tendencia = "";
  if ((secondLastLineRatio == firstLastLineRatio) == ratio) {
    tendencia = "0";
  } else if (secondLastLineRatio > ratio || firstLastLineRatio > ratio) {
    tendencia = "-";
  } else {
    tendencia = "+";
  }
  return tendencia;
}

function verifyData(data, signature, publicKeyString) {
  try {
    const publicKey = crypto.createPublicKey({
      key: publicKeyString,
      format: "pem",
    });

    // A partir de la clave pública, comprobamos que la firma le pertenece
    const verifier = crypto.createVerify("SHA256");
    verifier.update(data);
    const isValid = verifier.verify(publicKey, signature);

    const timestamp = new Date().toISOString();
    const signatureValid = isValid ? 1 : 0;

    // Insertar el resultado en la base de datos SQLite, incluyendo la clave pública
    db.run(
      "INSERT INTO Requests (timestamp, data, signatureValid, publicKey) VALUES (?, ?, ?, ?)",
      [timestamp, data, signatureValid, publicKeyString],
      function (err) {
        if (err) {
          return console.error(err.message);
        }
        console.log(
          `Una nueva fila ha sido inserada en la db con id ${this.lastID}\n------`
        );
        updateTendenciaMensual();
      }
    );

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

//Función de lectura del contenido que se recibe por la petición
function processReceivedData(data) {
  console.log("Procesando datos recibidos...");
  const items = data.split(", ").reduce((acc, item) => {
    const [key, value] = item.split(": ");
    acc[key.trim()] = parseInt(value, 10);
    return acc;
  }, {});
  console.log("Datos procesados: ", items);
}

process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log("Cerrando la conexión a la base de datos.");
  });
  process.exit();
});
