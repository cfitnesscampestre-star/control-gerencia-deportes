'use strict';
/* =====================================================================
   config.js — conexión con la base de datos (Firebase) y simulación.

   MIENTRAS SE PRUEBA:  CONECTAR_FIREBASE = false
     · La app guarda solo en el equipo y se ven DATOS DE SIMULACIÓN en todas las áreas
       (ejemplos para presentar y revisar; no se guardan y no se mezclan con datos reales).

   CUANDO SE CONECTE LA BASE DE DATOS:  CONECTAR_FIREBASE = true
     · Gerencia tiene su PROPIA base de datos (proyecto registro-gerencia): lee y escribe ahí.
     · Además LEE (solo lectura) la base de Fitness Control (proyecto fitness-campestre-e218c)
       para mostrar sus datos en el área Fitness. Son dos proyectos distintos, con cuota
       independiente cada uno (ver LEEME-vinculo.txt).
     · Los datos de simulación desaparecen solos.
   ===================================================================== */
const CONECTAR_FIREBASE = true;

/* Base propia de Gerencia (lee y escribe) */
const FIREBASE_GERENCIA_REAL = {
  apiKey:     'AIzaSyDX1Vw-YaT0i7hN24r42VMGBPWwFGYAnQA',
  authDomain: 'registro-gerencia.firebaseapp.com',
  databaseURL:'https://registro-gerencia-default-rtdb.firebaseio.com',
  projectId:  'registro-gerencia',
  appId:      '1:439284382620:web:fc12d9529900592d9ae659'
};
/* Base de Fitness Control (SOLO LECTURA) */
const FIREBASE_FITNESS_REAL = {
  apiKey:     'AIzaSyC3_83rzlemRzDEr5rbQoYTzvLock5xkjE',
  authDomain: 'fitness-campestre-e218c.firebaseapp.com',
  databaseURL:'https://fitness-campestre-e218c-default-rtdb.firebaseio.com',
  projectId:  'fitness-campestre-e218c',
  appId:      '1:813526273487:web:3a3643ae3d95d44d4a16ba'
};
const FIREBASE_CONFIG        = CONECTAR_FIREBASE ? FIREBASE_GERENCIA_REAL : { apiKey:'', authDomain:'', databaseURL:'', projectId:'', appId:'' };
const FIREBASE_CONFIG_FITNESS= CONECTAR_FIREBASE ? FIREBASE_FITNESS_REAL  : { apiKey:'', authDomain:'', databaseURL:'', projectId:'', appId:'' };

/* Datos de ejemplo en todas las áreas. Solo existen mientras no haya base de datos conectada. */
const SIMULACION = !CONECTAR_FIREBASE;
