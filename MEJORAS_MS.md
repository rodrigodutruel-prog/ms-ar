MS AR y 3DDUT AR 4.15.0

Actualización de rendimiento sobre 4.14.0. Conserva el diseño, los materiales, las texturas y las sombras.

- La vista 3D se actualiza cuando se gira, acerca o cambia el modelo. Una pieza quieta deja de generar cuadros y consumir GPU innecesariamente.
- Las sombras se reutilizan mientras la geometría, su posición y visibilidad no cambien. Girar la cámara mantiene las sombras sin volver a dibujar todas las piezas desde la luz.
- La APK limita la superficie de dibujo a 1,2 millones de píxeles y usa suavizado de bordes de 2 muestras. Mantiene la proporción de la cámara y el modelo, con menor demanda de GPU en pantallas de alta resolución.
- La microtextura nativa usa una textura con niveles de detalle, evitando cálculos trigonométricos por píxel y parpadeo de grano fino.
- Se reutilizan los parámetros gráficos y los arreglos de trabajo para reducir llamadas y pausas de memoria durante la cámara.
- Una vez fijado el modelo a la hoja, se detiene la detección de imágenes y superficies; el anclaje espacial sigue activo. Volver a ubicar reactiva la búsqueda del QR.
- El primer anclaje espera a que el seguimiento haya tenido tiempo de estabilizarse; cuando se usa una imagen reconocida, se conserva la posición del fotograma actual para evitar mezclar correcciones anteriores del mapa.

Pruebas: comparación con 4.14, reapertura y recuperación del visor, materiales, sombras, geometría y biblioteca. Pruebas de cámara virtual a 1080x2400, seguimiento después del anclaje y reposicionamiento. Las medidas del emulador no equivalen al rendimiento real del Motorola; esa comprobación física sigue pendiente.

Instalar la APK 4.15.0 de cada marca sobre la anterior. Conserva los modelos importados en la biblioteca de la APK 4.14.0.

Referencia técnica: https://developers.google.com/ar/develop/performance
