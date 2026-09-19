'use strict';
/* =====================================================================
   config.js — conexión con la base de datos (Firebase) y simulación.

   MIENTRAS SE PRUEBA:  CONECTAR_FIREBASE = false
     · La app guarda solo en el equipo y se ven DATOS DE SIMULACIÓN en todas las áreas
       (ejemplos para presentar y revisar; no se guardan y no se mezclan con datos reales).

   CUANDO SE CONECTE LA BASE DE DATOS:  CONECTAR_FIREBASE = true
     · Se conecta a la MISMA base de Fitness Control (proyecto fitness-campestre-e218c):
         - Gerencia guarda sus datos en el nodo  gerencia_deportes  (lee y escribe)
         - Gerencia lee el nodo                  fitness            (SOLO LECTURA)
     · Los datos de simulación desaparecen solos.
     · Las reglas de Firebase deben permitir esos dos nodos: ver LEEME-vinculo.txt
   ===================================================================== */
const CONECTAR_FIREBASE = false;

const FIREBASE_REAL = {
  apiKey:     'AIzaSyC3_83rzlemRzDEr5rbQoYTzvLock5xkjE',
  authDomain: 'fitness-campestre-e218c.firebaseapp.com',
  databaseURL:'https://fitness-campestre-e218c-default-rtdb.firebaseio.com',
  projectId:  'fitness-campestre-e218c',
  appId:      '1:813526273487:web:3a3643ae3d95d44d4a16ba'
};
const FIREBASE_CONFIG = CONECTAR_FIREBASE ? FIREBASE_REAL : { apiKey:'', authDomain:'', databaseURL:'', projectId:'', appId:'' };

/* Datos de ejemplo en todas las áreas. Solo existen mientras no haya base de datos conectada. */
const SIMULACION = !CONECTAR_FIREBASE;
