MS AR y 3DDUT AR 4.14.0

Mejoras aplicadas sobre la versión 4.13, conservando su diseño y herramientas.

- APK con visor AR nativo: reconoce el marcador de la hoja, valida su posición durante varios fotogramas y crea un anclaje espacial. Después de fijarlo, el QR puede salir de la cámara mientras el seguimiento espacial continúe disponible.
- Biblioteca local: importar los modelos al teléfono una vez y encontrarlos escaneando su QR. El lector libera la cámara antes de abrir el visor AR.
- Modos a escala real y maqueta con colocación sobre una superficie horizontal detectada, rotación y reposicionamiento.
- Materiales con rugosidad, respuesta metálica, microtextura y reflejos. Sombras suaves proyectadas en el visor 3D y sombra del modelo sobre el plano en AR nativa. Se conservan los colores del modelo.
- Correcciones de altura y orientación de anclajes WebXR, rechazo de paredes al colocar por profundidad y limpieza de recursos al cerrar y reabrir el visor.
- Correcciones de geometrías OBJ y exportación Android: los modelos se guardan con extensión .obj, sin agregar .txt.
- Recursos esenciales incluidos en las APK para abrir la interfaz y los modelos importados sin Internet. Los servicios AR de Google deben estar instalados y actualizados; su instalación inicial puede requerir Internet.

Instalación: actualizar con la APK 4.14.0 de la misma marca. Conserva el identificador y certificado de firma de la versión anterior. La biblioteca de la APK ahora se guarda dentro de la aplicación; si los modelos estaban guardados en Chrome, hay que importarlos una vez en esta biblioteca.

Uso sobre la hoja: importar el JSON de la Calculadora o el OBJ con el marcador de su hoja, seleccionar Sobre plano impreso y Anclaje automático, y enfocar el QR con la hoja apoyada, buena luz y pequeños movimientos laterales hasta que indique Modelo fijado. Usar el porcentaje real de impresión. Si el teléfono pierde el seguimiento espacial, se solicita recuperar el encuadre para evitar dibujar una ubicación falsa.

Validación: pruebas automatizadas de lectura QR, biblioteca, geometría, exportación, materiales, sombras, apertura y cierre, anclajes y colocación. Compilación Android y pruebas con cámara virtual del emulador. La alineación y estabilidad física sobre el plano requieren validación final en el Motorola Edge 20 Pro; no se afirma precisión milimétrica medida en ese equipo.
