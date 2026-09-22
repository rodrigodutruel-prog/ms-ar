MS AR y 3DDUT AR 4.17.0

Ajuste y oclusión en la vista AR de la APK, a pedido de la primera prueba de la 4.16.1.

- Botones de ajuste, como el panel Ajustar de la web, cuando el modelo está apoyado sobre una superficie: ◀ izq / der ▶ y ▲ lejos / ▼ cerca lo mueven respecto de hacia dónde se mira, ↑ subir / ↓ bajar cambian la altura y ⟲ ⟳ lo giran. Pasos de 10 cm y 15°; con Fino: ON, de 1 cm y 1°. Siguen los gestos (1 dedo mueve, 2 dedos giran, un toque re-apoya) y Girar 90°.
- Paredes (oclusión): con la Depth API de ARCore el modelo se esconde detrás de paredes, columnas, máquinas y personas que quedan delante, como en la realidad. Se apaga y prende con el botón Paredes. En teléfonos sin Depth API el botón queda inactivo y todo lo demás sigue igual.

Pruebas: puente nativo en las dos marcas (38 comprobaciones), regresión del núcleo y del service worker (40), suites de navegador (6), compilación de las dos marcas, y la vista AR nativa probada en un emulador Android 13 con ARCore 1.56 y GPU real: detección de la superficie, apoyar con un toque, los botones (10 cm y 15°, 1 cm y 1° en fino), Girar y la foto a la galería. La oclusión no se puede probar en el emulador (no tiene Depth API): queda para el teléfono.

Instalar la APK 4.17.0 de cada marca sobre la anterior. Conserva los modelos importados en la biblioteca.

MS AR y 3DDUT AR 4.16.1

Corrección sobre 4.15.0 pensada para los modelos reales (maquetas de Inventor de 100.000 caras o más). Conserva el diseño, los materiales, las texturas y las sombras.

- Botón Foto. En la vista AR (APK) saca una foto de lo que se ve en pantalla —cámara y modelo— y la guarda en la galería del teléfono, en el álbum de la aplicación. En el visor 3D hay un botón Foto junto a Centrar / Planta / Isométrica: en la APK va a la galería; en el navegador del celular se comparte; en la PC se descarga.
- El pasaje del modelo a la vista AR nativa ahora es binario. Antes cada vértice viajaba como números de texto: con la maqueta de FITECMA reducida a 100.000 triángulos eran 21,5 MB de texto y 2,8 millones de números que Android parseaba dos veces. Ahora es un buffer de 9 números por vértice (14 MB) que Android copia directo al motor gráfico: en el emulador la vista AR abre en 3 s en vez de 6, con menos memoria y menos riesgo de que el sistema cierre la aplicación al abrir la cámara con un modelo grande.
- Un OBJ que no trae su hoja con QR ya no falla con "Abrí el JSON de la Calculadora…": se apoya sobre una superficie (piso o mesa), aunque el modo elegido sea "Sobre plano impreso". El aviso lo dice antes de abrir la cámara.
- Ajuste en la vista AR de la APK. Un toque apoya el modelo en la mira; ya apoyado, 1 dedo lo arrastra por el piso o la mesa, 2 dedos lo giran y un toque en otro lugar lo re-apoya ahí. Sigue el botón Girar 90°. Sobre plano impreso no hace falta: el QR fija la posición.
- Aristas negras en la vista AR de la APK: las mismas del visor (el sombreado con aristas de Inventor) ahora viajan al módulo nativo y se dibujan sobre las caras.
- Aristas calculadas en la app. Si el OBJ no trae las líneas de aristas (opciones Detalle o Máximo del .bat, o un OBJ exportado directo de Inventor) o la app tuvo que reducirlo, las calcula sobre la malla final —hasta 45.000, las más marcadas— en vez de dejar el modelo liso. Con la maqueta de FITECMA (745.558 caras, preparada sin aristas): 43.400 aristas y 6 s de apertura, igual que antes. El .bat Preparar_OBJ_para_AR aclara ahora que Detalle y Máximo se vuelven a reducir a 110.000 caras al abrir: la opción Normal es la recomendada.
- El visor 3D conserva el dibujo bajo demanda de 4.15 y suma los ganchos que usa la foto.

Pruebas: puente nativo en las dos marcas (38 comprobaciones: aristas del archivo y calculadas → módulo nativo, esquema binario, normales unitarias, reducción de impresión, error nativo visible, OBJ suelto → superficie, foto del visor), regresión del núcleo y del service worker (40), y la maqueta real de FITECMA abierta y pasada al módulo nativo en el emulador Android 16 (192 MB de heap). La cámara AR y los gestos de ajuste sobre el teléfono siguen pendientes de comprobación física.

Instalar la APK 4.16.1 de cada marca sobre la anterior. Conserva los modelos importados en la biblioteca.

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
