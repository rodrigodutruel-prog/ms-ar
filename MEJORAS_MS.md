# MS AR 4.2.0


## Cambios de 4.2.0

- **Movimiento entre lecturas:** seguimiento óptico de puntos de la hoja con comprobación de ida y vuelta y ajuste de perspectiva. Se verifica periódicamente el contenido exacto del QR. El seguimiento no se reinicia por una sola lectura incompleta ni por una cámara que entrega cuadros más lentamente.
- **Cortes breves:** conserva juntos la última imagen y su modelo durante hasta 600 ms. Si no recupera una referencia válida, oculta la ubicación y vuelve a buscar. No coloca una pose antigua sobre una imagen nueva. Esto no sustituye un ancla espacial: si se pierde la hoja o el teléfono se mueve demasiado rápido, debe recuperarse la referencia.
- **Ver 3D sin cámara:** acceso directo desde el plano para explorar sin depender de mantener el QR visible.
- **Biblioteca local por QR:** Agregar archivos del teléfono o Agregar carpeta permite seleccionar JSON de la Calculadora y OBJ con su hoja AR embebida. Guarda copias en el dispositivo; no sube los archivos. Después, Leer QR y abrir modelo busca automáticamente en esas copias. Se puede abrir en 3D sin cámara o iniciar la ubicación sobre el plano.
- **Revisiones:** si el mismo QR corresponde a varios archivos, se elige la revisión. Un QR desconocido no abre otra obra ni navega a direcciones externas. Quitar copia elimina solo la copia de la biblioteca.

La selección inicial de archivos es necesaria: la app no puede recorrer el almacenamiento privado del teléfono sin que el usuario le conceda acceso. Las copias no se actualizan solas si se modifica el archivo original: hay que agregar la revisión nueva. La biblioteca persiste entre aperturas y funciona sin conexión una vez descargada la app. Borrar los datos del sitio o desinstalar el navegador puede eliminar las copias.

La APK 4.1.0 existente abre esta web 4.2.0; no es necesario desinstalar ni cambiar la firma. Con conexión, salir del visor y usar **Más opciones → Actualizar aplicación** cuando aparezca; comprobar **v4.2.0**.

Validación de 4.2.0: pruebas de movimiento con imágenes reales del formato Calculadora, pérdidas breves y completas, búsqueda persistente y sin conexión, QR desconocido, revisiones duplicadas y cierre de permisos tardíos. Se usa cámara simulada: queda pendiente repetirlo físicamente en el Motorola Edge 20 Pro.

El seguimiento óptico usa [jsfeat](https://github.com/inspirit/jsfeat), MIT; commit y huellas en vendor/sources.json, licencia conservada. La selección de carpetas utiliza el [selector de directorios del navegador](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory).

## Mejoras anteriores conservadas

Se conserva la interfaz MS. Esta actualización se concentra en la colocación, el plano impreso y el visor 3D.

- **QR con cámara:** lee el QR embebido en el JSON de la Calculadora y verifica su contenido contra la hoja. Funciona sin habilitar reconocimiento experimental de imágenes. Los píxeles se procesan en el teléfono y no se envían a un servidor.
- **Hoja inclinada:** reconstruye posición y orientación completas. Mide dentro del PNG el QR real, separado del marco negro, para respetar su tamaño relativo.
- **Referencia perdida:** oculta el modelo al perder el QR y verifica varias lecturas antes de recuperarlo. El fondo de cámara y el modelo corresponden al mismo cuadro, evitando retrasos entre ambos. Pausar imagen congela los dos.
- **Colocación en obra:** espera una superficie estable, muestra el aro verde y fija el modelo al colocarlo. Los toques accidentales no lo desplazan. Las anclas que llegan tarde se descartan si cambió la sesión o la ubicación.
- **Calidad y controles:** más detalle en los tubos, iluminación de relleno, materiales y tonos ajustados. En el visor 3D: un dedo gira; dos dedos acercan y desplazan. Se agregan Centrar, Planta e Isométrica. Se corrige la creación de bordes después de cerrar el visor.
- **Uso sin Internet:** el lector QR y sus dependencias quedan incluidos en el guardado local de la aplicación. Es necesario guardar también el modelo desde Más opciones.

## Usar los planos de la Calculadora

1. Actualizá MS AR y comprobá que figure **v4.2.0**.
2. Abrí el JSON exportado con el botón AR de la Calculadora.
3. Elegí **Sobre plano impreso → QR con cámara** y tocá **Iniciar AR**.
4. Permití la cámara. Apuntá al QR completo del plano correspondiente, sin reflejos ni pliegues.
5. Si cambiaste el tamaño al imprimir, indicá la reducción o medí el **marco negro completo**, de borde a borde. El valor por defecto supone impresión al 100 %.

El seguimiento necesita detalles visibles de la hoja y confirmaciones periódicas del QR. Tolera cortes breves; si pierde la referencia por completo, el modelo se oculta y vuelve al recuperarla. **Dos cruces** permite una colocación manual en teléfonos con AR compatible. El reconocimiento nativo es una alternativa opcional y solo se utiliza cuando el teléfono confirma que puede rastrear la imagen.

En Ajustar vista se puede corregir la perspectiva si la altura se ve deformada. La cámara web no expone su calibración óptica exacta: el tamaño, el enfoque, la iluminación, el movimiento y la lente influyen en la precisión. Esta visualización no reemplaza una medición de replanteo.

## Verificación

44 pruebas Node del motor, lector/pose, estabilidad, sesiones y cachés; 17 pruebas Python; 22 comprobaciones de navegador de la nueva cámara con imágenes sintéticas del formato Calculadora; 19 comprobaciones de la interfaz original. Se comprueba la alineación de la cruz 1 con perspectiva frontal, inclinada y girada; QR equivocado; pérdida/recuperación; cancelación de permisos; cierre de cámara; reapertura y uso sin conexión.

Se verificó el código y una cámara simulada en Chromium. **Queda pendiente la comprobación física en el Motorola Edge 20 Pro y con el plano concreto del usuario.** La simulación no certifica la precisión ni la fluidez de una cámara real.

Para sincronizar solo MS: `python sincronizar_core.py --marca ms-ar`. Para verificar sin modificar: agregar `--check`. La publicación de 3DDUT no forma parte de esta actualización.

Dependencias locales: [jsQR](https://github.com/cozmo/jsQR) (Apache 2.0) y [js-aruco POSIT/SVD](https://github.com/jcmellado/js-aruco) (MIT). Los commits y SHA-256 están en `vendor/sources.json`; se conservan sus licencias. La orientación del reconocimiento nativo sigue el [documento de WebXR Image Tracking](https://github.com/immersive-web/image-tracking/blob/main/explainer.md).
