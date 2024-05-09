package com.example.myapplication;

import android.app.AlertDialog;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.os.Bundle;
import android.os.StrictMode;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

import java.security.PublicKey;
import java.util.Base64;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.SecureRandom;
import java.io.DataOutputStream;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.io.OutputStream;
import java.util.Date;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "RequestPrefs";
    private static final String KEY_LAST_TIME = "lastTime";
    private static final String KEY_REQUEST_COUNT = "requestCount";

    //Se debe actualizar esta información para que apunte a la dirección IP del servidor. A través de ipconfig se puede obtener.
    protected static String server = "192.168.56.1";
    protected static int port = 7070;

    private SharedPreferences preferences;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);

        StrictMode.ThreadPolicy policy = new StrictMode.ThreadPolicy.Builder().permitAll().build();
        StrictMode.setThreadPolicy(policy);

        // Capturamos el boton de Enviar
        View button = findViewById(R.id.button_send);

        // Llama al listener del boton Enviar
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                // Comprobación de que no se hayan hecho más de 3 requests en 4 horas.
                if (canSendRequest()) {
                    showDialog();
                } else {
                    Toast.makeText(MainActivity.this, "Límite de 3 peticiones cada 4 horas alcanzado.", Toast.LENGTH_LONG).show();
                }
            }
        });
    }
    // Registra el timestamp de la petición y cuántas peticiones se han hecho. Si hay 3 peticiones en las últimas 4 horas, devuelve False.
    private boolean canSendRequest() {
        long lastTime = preferences.getLong(KEY_LAST_TIME, 0);
        int requestCount = preferences.getInt(KEY_REQUEST_COUNT, 0)
        long currentTime = new Date().getTime();
        if (currentTime - lastTime > //4 * 3600 * 1000 // 4 horas
                30 ) { //testing
            SharedPreferences.Editor editor = preferences.edit();
            editor.putLong(KEY_LAST_TIME, currentTime);
            editor.putInt(KEY_REQUEST_COUNT, 1);
            editor.apply();
            return true;
        } else if (requestCount < 3) {
            SharedPreferences.Editor editor = preferences.edit();
            editor.putInt(KEY_REQUEST_COUNT, requestCount + 1);
            editor.apply();
            return true;
        } else {
            return false;
        }
    }

    // Creación de un cuadro de dialogo para confirmar pedido
    private void showDialog() {
        EditText editTextCamas = findViewById(R.id.editTextCamas);
        EditText editTextMesas = findViewById(R.id.editTextMesas);
        EditText editTextSillas = findViewById(R.id.editTextSillas);
        EditText editTextSillones = findViewById(R.id.editTextSillones);

        try {
            int camas = Integer.parseInt(editTextCamas.getText().toString());
            int mesas = Integer.parseInt(editTextMesas.getText().toString());
            int sillas = Integer.parseInt(editTextSillas.getText().toString());
            int sillones = Integer.parseInt(editTextSillones.getText().toString());
            //Comprobación de que los parámetros están dentro de los límites impuestos 
            if (camas < 0 || camas > 300 || mesas < 0 || mesas > 300 || sillas < 0 || sillas > 300 || sillones < 0 || sillones > 300) {
                Toast.makeText(getApplicationContext(), "Los valores deben estar entre 0 y 300", Toast.LENGTH_SHORT).show();
            } else {
                new AlertDialog.Builder(this)
                        .setTitle("Enviar")
                        .setMessage("¿Confirmar el envío de los datos?")
                        .setIcon(android.R.drawable.ic_dialog_alert)
                        .setPositiveButton(android.R.string.yes, new DialogInterface.OnClickListener() {
                            public void onClick(DialogInterface dialog, int whichButton) {
                                //Mandar esta información
                                String dataToSend = "Camas: " + camas + ", Mesas: " + mesas + ", Sillas: " + sillas + ", Sillones: " + sillones;
                                sendData(dataToSend);
                            }
                        })
                        .setNegativeButton(android.R.string.no, null)
                        .show();
            }
        } catch (NumberFormatException e) {
            Toast.makeText(getApplicationContext(), "Por favor, introduce valores válidos.", Toast.LENGTH_SHORT).show();
        }
    }

    // Método para enviar datos a través de un Socket
    private void sendData(String data) {
        try (Socket socket = new Socket(server, port);
             OutputStream out = socket.getOutputStream();
             DataOutputStream dos = new DataOutputStream(out)) {

            // Generar claves
            KeyPair keyPair = generateKeyPair();
            PublicKey publicKey = keyPair.getPublic();
            byte[] publicKeyEncoded = publicKey.getEncoded();
            String publicKeyString = "-----BEGIN PUBLIC KEY-----\n" +
                    Base64.getEncoder().encodeToString(publicKeyEncoded) +
                    "\n-----END PUBLIC KEY-----";

            // Firmar los datos
            byte[] signature = signData(data, keyPair.getPrivate());

            // Enviar los datos
            dos.writeInt(data.getBytes(StandardCharsets.UTF_8).length);
            dos.write(data.getBytes(StandardCharsets.UTF_8));

            // Enviar la firma
            dos.writeInt(signature.length);
            dos.write(signature);

            // Enviar la clave pública
            dos.writeInt(publicKeyString.getBytes(StandardCharsets.UTF_8).length);
            dos.write(publicKeyString.getBytes(StandardCharsets.UTF_8));

            dos.flush();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    //Proceso de generación de claves mediante RSA
    private KeyPair generateKeyPair() throws Exception {
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048, new SecureRandom());
        return keyGen.generateKeyPair();
    }
    //Proceso de firma usando la clave privada
    private byte[] signData(String data, PrivateKey privateKey) throws Exception {
        Signature signature = Signature.getInstance("SHA256withRSA");
        signature.initSign(privateKey);
        signature.update(data.getBytes(StandardCharsets.UTF_8));
        return signature.sign();
    }
}

