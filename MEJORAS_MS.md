# MS AR 4.1.0

Se conserva la interfaz MS. Esta actualización se concentra en la colocación, el plano impreso y el visor 3D.

- **QR con cámara:** lee el QR embebido en el JSON de la Calculadora y verifica su contenido contra la hoja. Funciona sin habilitar reconocimiento experimental de imágenes. Los píxeles se procesan en el teléfono y no se envían a un servidor.
- **Hoja inclinada:** reconstruye posición y orientación completas. Mide dentro del PNG el QR real, separado del marco negro, para respetar su tamaño relativo.
- **Referencia perdida:** oculta el modelo al perder el QR y verifica varias lecturas antes de recuperarlo. El fondo de cámara y el modelo corresponden al mismo cuadro, evitando retrasos entre ambos. Pausar imagen congela los dos.
- **Colocación en obra:** espera una superficie estable, muestra el aro verde y fija el modelo al colocarlo. Los toques accidentales no lo desplazan. Las anclas que llegan tarde se descartan si cambió la sesión o la ubicación.
- **Calidad y controles:** más detalle en los tubos, iluminación de relleno, materiales y tonos ajustados. En el visor 3D: un dedo gira; dos dedos acercan y desplazan. Se agregan Centrar, Planta e Isométrica. Se corrige la creación de bordes después de cerrar el visor.
- **Uso sin Internet:** el lector QR y sus dependencias quedan incluidos en el guardado local de la aplicación. Es necesario guardar también el modelo desde Más opciones.

## Usar los planos de la Calculadora

1. Actualizá MS AR y comprobá que figure **v4.1.0**.
2. Abrí el JSON exportado con el botón AR de la Calculadora.
3. Elegí **Sobre plano impreso → QR con cámara** y tocá **Iniciar AR**.
4. Permití la cámara. Apuntá al QR completo del plano correspondiente, sin reflejos ni pliegues.
5. Si cambiaste el tamaño al imprimir, indicá la reducción o medí el **marco negro completo**, de borde a borde. El valor por defecto supone impresión al 100 %.

El QR debe permanecer visible. Si está tapado o fuera de cámara, el modelo se oculta y vuelve al recuperar la referencia. **Dos cruces** permite una colocación manual en teléfonos con AR compatible. El reconocimiento nativo es una alternativa opcional y solo se utiliza cuando el teléfono confirma que puede rastrear la imagen.

En Ajustar vista se puede corregir la perspectiva si la altura se ve deformada. La cámara web no expone su calibración óptica exacta: el tamaño, el enfoque, la iluminación, el movimiento y la lente influyen en la precisión. Esta visualización no reemplaza una medición de replanteo.

## Verificación

44 pruebas Node del motor, lector/pose, estabilidad, sesiones y cachés; 17 pruebas Python; 22 comprobaciones de navegador de la nueva cámara con imágenes sintéticas del formato Calculadora; 19 comprobaciones de la interfaz original. Se comprueba la alineación de la cruz 1 con perspectiva frontal, inclinada y girada; QR equivocado; pérdida/recuperación; cancelación de permisos; cierre de cámara; reapertura y uso sin conexión.

Se verificó el código y una cámara simulada en Chromium. **Queda pendiente la comprobación física en el Motorola Edge 20 Pro y con el plano concreto del usuario.** La simulación no certifica la precisión ni la fluidez de una cámara real.

Para sincronizar solo MS: `python sincronizar_core.py --marca ms-ar`. Para verificar sin modificar: agregar `--check`. La publicación de 3DDUT no forma parte de esta actualización.

Dependencias locales: [jsQR](https://github.com/cozmo/jsQR) (Apache 2.0) y [js-aruco POSIT/SVD](https://github.com/jcmellado/js-aruco) (MIT). Los commits y SHA-256 están en `vendor/sources.json`; se conservan sus licencias. La orientación del reconocimiento nativo sigue el [documento de WebXR Image Tracking](https://github.com/immersive-web/image-tracking/blob/main/explainer.md).
