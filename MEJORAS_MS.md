# MS AR 4.3.0

## Correcciones de esta versión

- El modo de cámara ya no llama a `renderer.setSize` en cada captura. Esa llamada reiniciaba el lienzo WebGL aunque el tamaño no cambiara y podía borrar el modelo mientras el lector procesaba la siguiente imagen. Una prueba nueva reproduce el error de 4.2 y verifica su corrección.
- **Fijar a la hoja** es el modo recomendado para mover el teléfono. Usa detección de superficies y seguimiento espacial WebXR. La ubicación no depende de seguir leyendo el QR. Las dos cruces determinan posición, orientación y escala.
- Se requieren una superficie detectada y controles visibles. No degrada a una ubicación supuesta si esas capacidades faltan. La retícula de papel es pequeña y exige más estabilidad que la colocación de un modelo a tamaño real.
- El recorrido tiene dos pasos: marcar cruz 1 y marcar cruz 2. Rechaza puntos demasiado cercanos o en distintas alturas. Evita mostrar un modelo orientado a medias.
- Si falta temporalmente la pose de un ancla pero el teléfono conserva seguimiento espacial, mantiene las coordenadas de la sesión. Si se pierde el seguimiento espacial, lo informa y recupera la visualización al volver. Reubicar libera las anclas anteriores.
- Se conservan la lectura QR local, el seguimiento óptico entre lecturas, los controles 3D y la biblioteca local. La biblioteca también está disponible en 3DDUT.
- Después de encontrar un archivo por QR, iniciar el modo espacial requiere tocar **Fijar el archivo encontrado a la hoja**. La solicitud WebXR ocurre desde ese gesto, no desde la respuesta asíncrona del lector.

## Ver el modelo sobre la hoja y moverse

1. Actualizar con Internet desde **Más opciones → Actualizar aplicación** y comprobar **v4.3.0**. Las APK 4.1.0 existentes abren esta web; no hace falta desinstalarlas.
2. Abrir el JSON AR de la Calculadora o el OBJ exportado con su plano AR. Se debe usar la hoja de esa misma exportación.
3. Elegir **Sobre plano impreso → Fijar a la hoja** e **Iniciar AR**.
4. Apoyar la hoja plana sobre una mesa. Mover despacio la cámara para que detecte la mesa. Apuntar al centro de la cruz 1 y tocar **Marcar cruz 1** cuando el aro esté verde.
5. Repetir con la cruz 2. A partir de allí se puede cambiar el punto de vista sin mantener el QR en cámara.
6. La hoja debe permanecer en su lugar. Si se mueve la hoja, usar **Volver a ubicar**. Este modo fija una ubicación en el espacio; no sigue una hoja que alguien levanta o traslada.

Si el equipo no ofrece seguimiento espacial, la app lo indica. **Seguir QR** sigue disponible como modo de cámara, pero exige detalles visibles y confirmaciones periódicas del código. Ocultar completamente la referencia o mover muy rápido la cámara puede interrumpir ese seguimiento. **Ver 3D sin cámara** permite explorar sin apuntar a la hoja.

## Abrir archivos del teléfono con QR

**Agregar archivos del teléfono** o **Agregar carpeta** permite seleccionar JSON de la Calculadora y OBJ con QR embebido, junto con sus MTL. La biblioteca guarda copias locales; no sube archivos ni imágenes. La selección inicial es necesaria para conceder acceso a los archivos.

Después, **Leer QR y abrir modelo** encuentra el archivo sin elegirlo de nuevo. Se puede abrir en 3D, preparar la colocación fija sobre la hoja o iniciar el seguimiento del QR. Si varias revisiones comparten un QR, se elige la correcta. Un código desconocido no abre otra obra ni navega a una dirección externa.

Las copias persisten entre aperturas y funcionan sin Internet una vez descargada la app. Modificar el archivo original no cambia la copia: hay que agregar la nueva revisión. **Quitar copia** elimina únicamente la copia de la biblioteca. Borrar los datos del sitio o del navegador puede quitar esas copias.

## Verificación y alcance

Se prueban ambas interfaces, lectura real de los QR de prueba, cámara simulada, geometría 3D y sesiones WebXR con poses simuladas. Las comprobaciones espaciales cubren alineación de las dos cruces, escala, movimiento sin QR, pérdida y recuperación, ausencia de la API opcional de anclas, permisos, salida y capacidades insuficientes. También se prueban biblioteca persistente, uso sin conexión, revisiones duplicadas y solicitud WebXR desde un gesto.

**No se verificó físicamente en el Motorola Edge 20 Pro ni con el plano concreto del usuario.** Estas pruebas verifican el código y sus transformaciones; no certifican la precisión ni la calidad del seguimiento de los sensores reales. La visualización no reemplaza una medición de replanteo.

La detección de superficie y las anclas siguen las API de [WebXR hit testing](https://developer.mozilla.org/en-US/docs/Web/API/XRSession/requestHitTestSource) y [WebXR anchors](https://developer.mozilla.org/en-US/docs/Web/API/XRFrame/createAnchor). Las dependencias locales jsQR, js-aruco y jsfeat conservan licencias y referencias en `vendor/sources.json`.

Sincronizar ambas aplicaciones: `python sincronizar_core.py`. Verificar sin modificar: `python sincronizar_core.py --check`.
