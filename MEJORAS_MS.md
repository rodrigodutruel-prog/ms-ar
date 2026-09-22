MS AR y 3DDUT AR 4.19.5

Todo formato se ve como un dibujo de Inventor (regla fija).

- STL con sombreado suave y aristas negras. Un STL abierto directo, en texto o binario, entraba con normales planas o promediadas sin quiebre y sin aristas, y el visor le calculaba las aristas en el hilo principal (se trababa) y sin presupuesto (garabatos). Ahora termina igual que el OBJ: normales suaves con quiebre de 24°, aristas negras con presupuesto quedándose con las más vivas, calculadas con el mismo método rápido, y viajan a la vista AR nativa como en el OBJ. Vale también para los STL recibidos por Abrir con o Compartir y para los reducidos al abrir.

Verificación: 43 regresiones del núcleo (una nueva con un prisma STL en texto y en binario: tapas planas, laterales suaves, solo los cantos como aristas), puente nativo, suites de navegador, compilación de ambas marcas.

Instalar cada APK 4.19.5 sobre la anterior, sin desinstalar.


MS AR y 3DDUT AR 4.19.4

Herramientas para ver por qué el modelo cae fuera del plano impreso (fotos del 22-sep).

- Marco del QR en la vista AR. Sobre plano impreso, la app dibuja un cuadrado celeste del tamaño exacto del marcador donde cree que está la hoja. Si el cuadrado cae sobre el QR impreso, el anclaje está bien y lo que hay que revisar es la posición del modelo respecto del marcador (los dx/dy del archivo); si cae en otro lado, el problema es el anclaje.
- Bitácora de la vista AR en el Diagnóstico. Al salir de la vista AR queda anotado cómo se ancló (por la imagen completa con ARCore o por reconstrucción del QR), el tamaño del marcador usado, dónde quedó el ancla respecto de la cámara y hacia dónde apuntan sus ejes en el mundo. Con eso se puede diagnosticar a distancia.
- La consulta de versión se hace una sola vez por apertura (antes se anotaba dos veces).

Instalar cada APK 4.19.4 sobre la anterior, sin desinstalar.


MS AR y 3DDUT AR 4.19.3

Corrección a partir de la captura "No se pudo abrir Operario.stl".

- El aviso dice el motivo. Antes cualquier falla al recibir un archivo mostraba "No se pudo abrir X". Ahora dice por qué: pesa más de 150 MB (el tope de carga del teléfono; se indica el peso y que se prepare en la PC con Preparar_OBJ_para_AR.bat, que lo deja en unos 4 MB), la app que lo mandó no dio permiso de lectura (probar con Compartir), el archivo ya no está disponible, o no es un modelo. Y todo queda anotado en el Diagnóstico de Más opciones, que antes venía vacío porque la parte nativa no escribía ahí: archivo recibido, tamaño, resultado y consulta de versión.
- Abrir con para cualquier tipo de archivo. Algunas apps entregan el STL con un tipo que no estaba en la lista y no ofrecían la app; ahora aparece siempre y valida al recibir.
- Tarjeta de versión nueva arriba de todo. Se insertaba debajo del selector de hoja, que en la APK queda oculto, y no se veía. Ahora es la primera tarjeta de la pantalla. La consulta se repite al volver a la app, no solo al abrirla de cero.

Verificación: banco del puente nativo con la tarjeta y el registro, núcleo, preparador y compilación de ambas marcas.

Instalar cada APK 4.19.3 sobre la anterior, sin desinstalar.


MS AR y 3DDUT AR 4.19.2

Corrección de calidad visual a partir de la foto de la maqueta (figura del operario y conducto).

- Aristas negras con presupuesto. En un CAD limpio las aristas de quiebre son unos pocos por ciento de las caras, pero en una malla densa u orgánica (la figura del operario, un tanque mal teselado) entre el 30 y el 50 % de los bordes supera los 24° y el modelo se llenaba de garabatos negros. Ahora se dibujan como máximo el 10 % de las caras (nunca menos de 2.000 aristas, nunca más de 45.000) y quedan las más vivas: cantos de 90°, bordes y uniones de piezas. Un cubo o una brida conservan todas sus aristas. El preparador de la PC aplica el mismo presupuesto al escribir el archivo, y si un archivo viejo trae de más, la app las recalcula con el presupuesto.

Verificación: 42 regresiones del núcleo y service worker (una nueva con una malla orgánica de 51.000 caras y un cubo), puente nativo, suites de navegador, preparador, compilación de ambas marcas.

Instalar cada APK 4.19.2 sobre la anterior, sin desinstalar.


MS AR y 3DDUT AR 4.19.1

Corrección sobre 4.19.0 a partir de la primera prueba en el teléfono.

- Modelo fijado más quieto. Una vez tocado Fijar, la posición del ancla pasa por un filtro: los temblores y las correcciones chicas del seguimiento (por ejemplo cuando una mano pasa delante de la cámara o hay pocas referencias) se amortiguan en lugar de mostrarse cuadro a cuadro, y un salto grande de relocalización se toma entero para no deslizar el modelo por el ambiente. Mientras se ajusta, la posición va cruda para que los botones respondan al instante. Si la cámara queda tapada del todo, el seguimiento se pierde y el modelo se oculta hasta recuperarlo; al volver, la posición nueva se toma sin arrastre. El seguimiento sigue siendo el del teléfono: con la cámara tapada o en movimiento brusco puede haber una corrección al recuperarlo.
- STL desde WhatsApp. Algunas aplicaciones entregan el archivo con un tipo MIME poco común o sin nombre: ahora la extensión se infiere también por el tipo del archivo y, si tampoco, por su contenido (STL ASCII o binario, OBJ, MTL, JSON). Se aceptan más tipos MIME de STL y OBJ en "Abrir con", y Compartir ofrece la app para cualquier archivo, validando al recibirlo. Si "Abrir con" no ofrece la app, usar Compartir.
- Aviso de versión nueva. La APK trae la web adentro y no se actualiza sola: el botón "Actualizar aplicación" de Más opciones es de la versión web instalada desde el navegador, no de la APK. Ahora, al abrir, la app consulta el último release de su marca y, si es más nuevo que el instalado, muestra arriba "Hay una versión nueva" con el link para bajar la APK. Se instala encima, sin desinstalar, y conserva la biblioteca. Sin conexión no avisa y no molesta.

Verificación: 64 comprobaciones del volcado y el bloqueo, 22 del filtro de pose, 10 de comparación de versiones, 41 regresiones del núcleo y service worker, 48 del puente nativo (STL recibido y aviso de versión incluidos), compilación debug y release de ambas marcas y prueba en emulador del "Abrir con" con STL sin extensión. La amortiguación con cámara real queda para el teléfono.

Instalar cada APK 4.19.1 sobre la anterior, sin desinstalar.


MS AR y 3DDUT AR 4.19.0

Abrir archivos con un toque desde otras aplicaciones y volcar el modelo en la vista AR, sobre la base 4.18.0. Se conservan Ubicar, Ajustar y Fijar, el pasaje binario, las aristas, las sombras, las texturas, la oclusión y la foto.

- Abrir con / Compartir. Un OBJ, STL, JSON o MTL recibido por WhatsApp, guardado en Archivos o adjunto en un correo se abre en la aplicación con un toque: al tocar el archivo, Android ofrece la app en "Abrir con" (elegir "Siempre" para que no vuelva a preguntar). También aparece en la hoja de Compartir, incluso con varios archivos a la vez (OBJ + MTL). Ya no hace falta guardarlo en una carpeta y buscarlo desde Seleccionar archivo. La app copia el archivo a su caché, lo abre igual que desde el selector y avisa "Modelo recibido". Los tipos que no son modelo se rechazan con un aviso.
- Volcar y Ladear en la vista AR. Junto a Giro, dos ejes nuevos: Volcar inclina la pieza hacia adelante o atrás (sobre el eje que la cámara ve como derecha) y Ladear la inclina a los costados (sobre el eje adelante). Pasos de 15° o, con Paso fino, de 1°. Volcar 90° para una pieza que el archivo trae acostada de un toque. Los ejes siguen a la cámara: se vuelca respecto de cómo se está mirando.
- Al volcar, la pieza se vuelve a apoyar: su punto más bajo queda sobre la superficie o la hoja, no enterrado ni flotando. La sombra se recalcula con la pieza volcada (sin sombra durante la fracción de segundo que tarda). Girar 90° y los gestos siguen igual; Ubicar descarta el volcado.
- Sombreado suave. Los OBJ de Inventor se dibujaban con una normal por cara, así que toda superficie curva (tanques, conos, tubos) se veía como un poliedro, en el visor y en la vista AR. Ahora cada esquina promedia las caras vecinas que comparten la posición hasta un quiebre de 24°, ponderadas por el ángulo de la esquina: las curvas quedan lisas y los cantos vivos siguen planos, con el mismo criterio con el que se dibujan las aristas negras. Vale también para los modelos que la app reduce al abrir. Subir el detalle en el .bat no arreglaba esto; la resolución de exportación de Inventor sí sigue mandando en el tamaño de las facetas.

Uso: recibir el archivo → tocar → la app lo abre. En AR: Ajustar → Volcar 90° si está acostada → Fijar.

Verificación: 64 comprobaciones del volcado y el bloqueo, 41 regresiones del núcleo y service worker (una nueva del sombreado), 42 comprobaciones del puente nativo (cuatro nuevas del archivo recibido), compilación debug y release de ambas marcas. El "Abrir con" desde WhatsApp y el volcado con la cámara real quedan para el teléfono.

Instalar cada APK 4.19.0 sobre la anterior, sin desinstalar, para conservar la biblioteca. Mantiene el identificador y la firma de cada aplicación.


MS AR y 3DDUT AR 4.18.0

Controles Ubicar, Ajustar y Fijar dentro de la cámara AR de las dos APK, sobre la base 4.17.0. Se conservan el pasaje binario, las aristas, las sombras, las texturas y la foto a la galería.

- Ubicación por QR o sobre una superficie: la pieza queda fijada automáticamente. Los toques y arrastres no modifican la posición mientras está fijada.
- Ajustar permite corregir posición, altura y giro. Sobre la hoja: pasos de 1 o 5 mm; sobre superficie: 1 o 10 cm. Giros de 1°, 15° y 90°. Fijar guarda la posición mostrada y cierra los ajustes; el estado Fijado aparece en verde.
- Los ajustes conservan un único anclaje espacial. Antes se reemplazaba el anclaje con cada desplazamiento sobre una superficie. Ahora se modifican coordenadas locales; el arrastre tampoco salta a otra mesa o piso.
- Ubicar descarta los ajustes y vuelve a buscar el QR o la superficie. Al interrumpir la cámara o perder el seguimiento, se bloquean los ajustes y se descartan gestos pendientes.
- La medida del marco introducida con regla se calcula con las dimensiones del archivo actual, aunque se haya escrito antes de abrirlo. Las medidas inválidas muestran un aviso y elegir una reducción de impresión sustituye la medida manual.
- Se evita usar mapas de profundidad de cuadros anteriores, que podían ocultar partes del modelo desde una posición de cámara incorrecta. Si falla una captura de foto, el botón permite reintentar.

Uso: escanear → Ajustar si hace falta → Fijar. Para reconocer nuevamente la hoja, tocar Ubicar. Fijar bloquea la edición: el anclaje sigue usando la cámara y los sensores para conservar su posición en el entorno.

Verificación: compilaciones debug y release de ambas marcas; 42 comprobaciones del bloqueo y los desplazamientos; 40 regresiones del núcleo y service worker; 38 comprobaciones del puente nativo; calibración física y flujos de navegador de ambas marcas. Pruebas Android con ARCore en emulador: lectura del QR, movimiento de cámara, ajustes, bloqueo y reubicación. Esto no certifica precisión milimétrica del seguimiento en un teléfono físico. El Motorola Edge 20 Pro y la oclusión Depth API requieren comprobación en el equipo; el emulador no ofrece esa API.

Instalar cada APK 4.18.0 sobre la anterior, sin desinstalar, para conservar la biblioteca. Mantiene el identificador y la firma de cada aplicación.


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
