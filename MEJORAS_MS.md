MS AR y 3DDUT AR 4.30.0

- Parado como en Inventor: con «Ver en MS AR» en la PC, el modelo llega con la vista Superior de Inventor hacia arriba (la del ViewCube de cada archivo). Los ensambles dibujados con el Superior en +Y (la mayoría de los de Leiner y Colibri, el Operario) llegaban acostados; ahora llegan parados. La PC lo lee con un Inventor aparte y oculto, en paralelo con la conversión (unos 10 s la primera vez; después queda guardado para ese archivo), y la ventana dice «Parado como en Inventor (vista Superior +Y)».
- «Tocar la base», en Ajustar: se toca el botón y después la cara de la pieza que va apoyada en el piso, y la pieza se para sobre esa cara de un toque, se la mire desde donde se la mire. «Deshacer volcado» la deja como vino.
- La app recuerda cómo se paró cada modelo: si se volcó (con «Tocar la base» o con Volcar) y se fijó, la próxima vez que se abre ese mismo modelo vuelve parado igual.
- Aristas negras en todos los dibujos: en los modelos que repiten el mismo punto en cada cara (ensambles del servidor, piezas leídas cara por cara, STL) las aristas se armaban mal y casi no se veían; ahora se reconocen por posición. Además, una pieza de CAD dibuja todos sus cantos (el Organizador Hogi pasó de 2.000 a 9.390), y una figura orgánica como el operario sigue con el límite de siempre para que no se llene de rayas. Los modelos ya guardados en el teléfono se corrigen solos al abrirlos.
- Ensambles del servidor (Z:) con más detalle: Inventor los exporta en resolución media o alta (el Ventilador Gatti pasó de 6.116 a 95.178 triángulos: caños redondos, sin facetas) y el archivo pesa la mitad.
- El ingeniero ya no atraviesa: su recorrido rodea la pieza como quedó después de volcarla (antes rodeaba la planta sin volcar y cruzaba el equipo), y lo que la cámara ya vio (paredes, máquinas) queda fijo en el lugar: mover, girar, volcar o escalar el modelo con Ajustar ya no lo borra.

Verificación: pruebas nativas (19 baterías, entre ellas colocación 107 con «Tocar la base», obstáculos 59 con la memoria fija al lugar y herramientas 33), web (26 de regresión con la nueva de aristas de CAD, flujo, seguimiento y service worker), preparador (11), colores y orientación (20), servidor de punta a punta y puente web → vista nativa (90). En la PC, la vista Superior leída de Inventor: Operario +Y, Carro +Z (sin cambio), Brida TN y Ventilador Gatti +Y. En el emulador, las dos APK abren la 4.30.0, recalculan las aristas de un modelo viejo (3.073 → 15.164) y muestran «Tocar la base» y «Deshacer volcado» en Ajustar; el toque sobre la pieza con ARCore queda para probar en el teléfono (el emulador no encontró el piso).

Instalar cada APK 4.30.0 sobre la anterior, sin desinstalar.

MS AR y 3DDUT AR 4.29.0

- Escala regulable: con el modelo apoyado, «Ajustar» muestra arriba una fila con «−», una barra y «+», y la escala del modelo («1:20»). La barra agranda o achica el modelo en su lugar, sin despegarlo de la mesa, y se imanta a las escalas comunes (1:10, 1:15, 1:20, 1:25, 1:50…); «−» y «+» saltan a la escala común siguiente. La persona de referencia, la cinta métrica y el aire siguen la escala nueva. Sobre la hoja impresa la escala la fija el plano y no se ofrece.
- La escala que se ve es la real del modelo: si la web agrandó una maqueta que quedaba de menos de 30 cm, la barra lo dice (por ejemplo 1:11) y se puede llevar a 1:20.
- «Paredes: n/d» ya no se parte en dos renglones.
- En la PC (Ver en MS AR): un .ipt grande (una sala, un stand, ~150 MB) ya no traba el servidor. Lo exporta un Inventor aparte, oculto, con sus colores, en unos 2 minutos; la ventana avisa que tarda. Una pieza sin caja ya no se factea a 0,03 mm. Cada archivo tiene 8 minutos como máximo y, si se pasa, se corta con aviso sin frenar a los que siguen.

Verificación: pruebas de la escala (15) y todas las nativas; en el emulador, «−» y «+» (1:11 → 1:15 → 1:20) y la barra (de 1:1,2 a 1:60); en la PC, la sala de reuniones (2 min, 29 colores), el stand FITECMA (2 min, 23 colores) y el organizador (4 s) por el servidor real; puente web → vista nativa (90), web y navegador de las dos marcas.

Instalar cada APK 4.29.0 sobre la anterior, sin desinstalar.

MS AR y 3DDUT AR 4.28.1

- Guardar y compartir, a la vista: cuando llega un modelo desde la PC (el QR de «Ver en MS AR») o desde WhatsApp, aparece una tarjeta ARRIBA DE TODO con su nombre y los botones «Guardar en el teléfono» y «Compartir». En la 4.28 estaban debajo de «Modelo recibido», más abajo en la página, y no se veían sin bajar.

Verificación: en el emulador, con el enlace real del servidor de la PC («Organizador matriceria Hogi.ipt»): la tarjeta aparece arriba al llegar y «Guardar en el teléfono» lo deja en Descargas › MS AR con su tamaño exacto; puente web → vista nativa (90), web y navegador de las dos marcas.

Instalar cada APK 4.28.1 sobre la anterior, sin desinstalar.

MS AR y 3DDUT AR 4.28.0

- Guardar y compartir el modelo que llega a la app: cuando un modelo llega de la PC («Ver en MS AR» con el QR, o un .ipt compartido) o desde WhatsApp, debajo de «Modelo recibido» aparecen «Guardar en el teléfono» (queda en Descargas › MS AR o 3DDUT AR) y «Compartir» (WhatsApp, correo, Drive…). Se manda el archivo tal cual está preparado para la app, con sus colores y sus aristas; quien lo recibe lo toca y lo abre con la app.
- La persona revisa lo real de a poco: la 4.27 miraba todo alrededor de la pieza de un saque cada 0,3 s, en el mismo hilo que dibuja la cámara, y en un modelo grande podía dar tironcitos al caminar. Ahora lo reparte cuadro a cuadro.
- Colores de Inventor cara por cara (en la PC): un ensamble guardado como pieza llega con el color de cada componente.
- El Diagnóstico ya no se llena con avisos repetidos de la persona.

Verificación: en el emulador, un modelo recibido se guardó en Descargas con su nombre y tamaño exactos, y compartido desde MS AR lo abrió 3DDUT AR con sus 30.732 triángulos y sus colores; puente web → vista nativa (88), web y navegador de las dos marcas, pruebas nativas completas.

Instalar cada APK 4.28.0 sobre la anterior, sin desinstalar.

MS AR y 3DDUT AR 4.27.0

HERRAMIENTAS en la vista AR: un botón «Herramientas» abre un panel. Todo arranca apagado; si no se toca, la vista hace lo mismo que antes.
- Choques con lo real: lo que el modelo toca o atraviesa de verdad (una pared, una columna, una máquina, el techo) se pinta en ROJO, y lo que queda a menos de 10 cm, en NARANJA. Vale para cualquier modelo que se inserte (OBJ, STL, Inventor, red de la Calculadora). Usa la profundidad del teléfono, hasta unos 5 m; si el teléfono no la tiene, el botón lo avisa.
- Medir: se tocan dos puntos, sobre la pieza o sobre lo real (piso, pared, una máquina), y aparece la distancia; entre dos puntos de un plano a escala dice los metros reales. Hasta 6 medidas, con «Borrar medidas».
- Ficha al tocar: con el modelo fijado, tocar una pieza muestra su ficha. En una red de la Calculadora, el tramo: tipo, Ø, largo, velocidad (bien / baja / alta respecto de la de diseño), caudal y chapa. En cualquier otro modelo, sus medidas reales y la altura del punto tocado.
- Aire: en una red de la Calculadora, partículas que corren por dentro de los caños, de las captaciones hacia el equipo, a su velocidad: azul lento, verde la de diseño, rojo rápido. El modelo se vuelve semitransparente para verlas.
- Corte: un plano que corta el modelo en X, en altura o en Z, con una barra para moverlo; lo cortado se ve por dentro.
- Rayos X: el modelo al 60, 35 o 15 % para ver lo que tiene adentro o detrás.
- Grabar video: la vista AR (cámara, modelo y medidas, sin los botones) a la galería, en Películas › MS AR / 3DDUT AR. La foto también sale con las medidas y la ficha.

- La persona esquiva lo real: con la profundidad del teléfono, el ingeniero ve paredes, máquinas, columnas y gente. Si algo se le cruza, se abre de costado para rodearlo y vuelve a su recorrido; si no hay paso, se da vuelta. No atraviesa nada. Funciona a escala real o casi (en un plano 1:40 mide 4 cm y la profundidad no alcanza para eso).
- Replanteo en obra a tamaño real: botón «Replanteo en obra», al lado de «Plano con QR». Se elige un punto del plano (la esquina del galpón, la boca de una máquina, la entrada al equipo, o la esquina o el centro de la pieza, con un corrimiento opcional) y la app genera una hoja A4 con una marca de 170 mm para pegar en el piso ahí. Al apuntarla, el modelo aparece a escala 1:1 en su lugar. Si la hoja se imprimió reducida, el modelo igual sale a tamaño real.
- Colores de Inventor: las piezas y ensambles que lee la PC («Ver en MS AR» o compartir un .ipt) llegan con sus colores de Inventor, el de cada pieza y el que el ensamble le sobrescribe. El aluminio y la chapa, que Inventor guarda como blanco, salen gris metálico.
- Detalles: las fotos y los videos ya no llevan «.obj» en el nombre; los botones de la vista AR quedan alineados y en un renglón.

Verificación: pruebas nativas de las herramientas (29) y del esquive (47: rodea una columna en 6 recorridos distintos, se da vuelta ante una pared, encerrado entre dos no atraviesa ninguna), más todas las anteriores sin cambios; los 6 programas gráficos compilados; puente web → vista nativa (82: tramos, sentido del aire, replanteo 1:1); web y navegador de las dos marcas; conversor de Inventor con colores (un ensamble real con 4 colores) y servidor de la PC. En el emulador: el panel, la grabación de video y las dos marcas. Sin probar en un teléfono: choques, medir, ficha, aire, corte, rayos X y el esquive, que necesitan la cámara y la profundidad reales.

Instalar cada APK 4.27.0 sobre la anterior, sin desinstalar.

MS AR y 3DDUT AR 4.26.0

Reúne todo lo probado en el teléfono y en el taller desde la 4.23.1 (las 4.23.2, 4.24 y 4.25 se probaron como APK sueltas y no se publicaron).

- Una persona de referencia: un ingeniero de obra de 1,75 m, a la misma escala del modelo, que INSPECCIONA la pieza: camina por afuera de ella hasta un punto, se frena, se gira hacia la pieza y la mira de lado a lado, mira hacia arriba (si la pieza es más alta que él), se agacha a mirar abajo, la señala, se queda pensando con la mano en el mentón o anota en la planilla; después va a otro punto, a veces vuelve sobre sus pasos. Lleva casco blanco, chaleco reflectivo con bandas, camisa de trabajo, botines y una planilla en la mano; parado respira y se balancea apenas, gira dando pasitos y tiene su sombra. Sobre un plano 1:40 mide 44 mm.
- Se le habla: «alto» lo frena, «caminá» lo hace seguir, «chau» lo hace desaparecer y «vení» lo trae. Se activa con el botón «Voz» (pide el micrófono la primera vez); el reconocimiento es en el teléfono, lo que se dice no sale del equipo, y si falta el español sin internet el teléfono lo descarga. El botón «Persona» pasa por camina, quieta y oculta.
- El modelo apoyado en una superficie queda quieto donde lo dejás: ya no sigue las re-estimaciones del piso de ARCore, que lo arrastraban de 2 a 15 cm. Si la superficie está a más de 2,5 m la app sugiere acercarse.
- El modelo ya no se desvanece al mirarlo de medio lejos: la oclusión por paredes solo tapa lo que está claramente delante, con una tolerancia que crece con la distancia, y se apaga de a poco entre 5 y 8 m.
- La sombra ya no se mueve al recorrer el modelo: la dirección de la luz se asienta y queda fija mientras la luz real no cambie.
- Piezas y ensambles de Inventor sin exportar: en la PC de la oficina, clic derecho en un .ipt o .iam → «Ver en MS AR» muestra un QR y el modelo llega al teléfono; también se puede compartir un .ipt a la app y lo lee la PC. Nada sale a internet. (Requiere la PC con Inventor y el servidor de la carpeta de AR; sin colores de Inventor.)
- Con el modelo volcado la sombra va al piso; arrastrar en Ajustar responde aunque ARCore corrija el piso; los avisos en superficie ya no hablan de "la hoja"; un fallo puntual de ARCore ya no cierra la vista AR; la bitácora del Diagnóstico ya no se llena con pérdidas de seguimiento repetidas.

Verificación: pruebas del ingeniero (inspección, acciones, posturas con los pies siempre en el piso), de la voz, del enlace y la descarga desde la PC, del anclaje y de la luz; shaders, puente nativo y compilación de las dos marcas; camino completo de Inventor probado en la PC y en el emulador.

Instalar cada APK 4.26.0 sobre la anterior, sin desinstalar.

MS AR y 3DDUT AR 4.25.0

De la prueba de la 4.24 ("anda muy bien"): que la persona se comporte como un ingeniero investigando la pieza, y que el 3D "va desapareciendo" cuando se lo enfoca de medio lejos.

- La persona INSPECCIONA la pieza en vez de dar vueltas: camina por afuera del modelo hasta un punto, se frena, se gira hacia la pieza y hace algo: la mira de lado a lado, mira hacia arriba (solo si la pieza es más alta que ella), se agacha a mirar abajo, la señala o se queda pensando con la mano en el mentón; a veces encadena dos. Después elige otro punto: el siguiente, a veces saltea uno o vuelve sobre sus pasos. Caminando mira de reojo la pieza. Nunca la atraviesa. «alto», «caminá», «chau» y «vení» siguen funcionando igual.
- El modelo ya no se desvanece de lejos. La función «Paredes» (oclusión por profundidad) lo tapaba por error: dejaba a medias todo lo que estaba a la misma distancia que lo real (justo donde el modelo toca el piso), usaba una tolerancia casi fija aunque el error de la profundidad crece con la distancia, y al suavizar el mapa de profundidad mezclaba medidas con puntos sin dato y fabricaba "objetos" delante del modelo. Ahora solo tapa lo que está claramente delante, con una tolerancia que crece con la distancia (6 cm a 1 m, 30 cm a 3 m, 70 cm a 5 m), y la oclusión se apaga de a poco entre 5 y 8 m, donde la profundidad del teléfono ya no sirve. Una pared de verdad delante del modelo lo sigue tapando.
- La bitácora del Diagnóstico ya no se llena con "seguimiento perdido" repetido: se anota como mucho una vez cada 10 s.

Verificación: pruebas nuevas del inspector (5 minutos simulados: visita puntos distintos, alterna caminar e inspeccionar, siempre de frente a la pieza al inspeccionar, vuelve a veces sobre sus pasos, mira arriba solo si la pieza es alta, obedece "alto", igual en un plano 1:40) y de las posturas (agachado, señalando, pensando: los pies planos en el piso, nada por debajo), más las baterías Java, shaders, puente nativo y compilación de las dos marcas.

Instalar cada APK 4.25.0 sobre la anterior, sin desinstalar.

MS AR y 3DDUT AR 4.24.0

A partir del uso en el taller con el 3D de las matrices ("anda bastante bien pero el dibujo se mueve, necesito que se quede quieto en la posición que lo dejo"), del pedido de una persona para apreciar el tamaño y de poder usar archivos .ipt sin convertirlos.

- El modelo apoyado en una superficie queda quieto donde lo dejás. Hasta ahora el anclaje quedaba pegado al plano que detecta ARCore, y cada vez que ARCore re-estimaba ese piso (sobre todo al acercarse) arrastraba el modelo: el Diagnóstico del taller registró correcciones de 2 a 15 cm con el modelo apoyado a 3,18 m. Ahora el anclaje queda fijo en el espacio, en el punto tocado; las re-estimaciones del piso ya no lo mueven y quedan anotadas en la bitácora ("ARCore re-estimó el piso X cm; el modelo no se movió").
- Si la superficie está a más de 2,5 m, la app sugiere acercarse para que quede firme (se puede apoyar igual).
- Persona de referencia: una figura de 1,75 m camina alrededor del modelo, a 60 cm de su borde y a paso normal (1,2 m/s reales), a la misma escala del modelo (sobre una hoja 1:40 mide 44 mm). Mueve piernas y brazos, pisa siempre el piso, tiene su sombra, se esconde detrás de paredes como el modelo y sale en las fotos. El botón "Persona" la muestra u oculta.
- Piezas y ensambles de Inventor sin exportar: en la PC, clic derecho en un .ipt o .iam → "Ver en MS AR". La PC lo lee con Inventor sin abrirlo (sólidos, superficies y ensambles con cada pieza en su lugar; unos segundos) y muestra un QR; con la cámara del teléfono, en el Wi-Fi de la oficina, se abre una página con el botón "Abrir en MS AR" y el modelo llega a la app con sus aristas negras. Nada sale a internet. Los colores de Inventor no llegan (Inventor no los entrega sin abrirse): el modelo toma la terminación metálica de la app.
- Un .ipt compartido al teléfono (WhatsApp, Archivos) se abre también: la app se lo manda a la PC de la oficina, que lo lee y se lo devuelve listo. La PC queda vinculada la primera vez que se escanea un QR de "Ver en MS AR". Un .iam compartido se rechaza explicando que se abre desde la PC (necesita todas sus piezas).
- La persona obedece la voz: «alto» la frena (se detiene de a poco y queda parada con los dos pies en el piso), «caminá» o «seguí» la hace seguir, «chau» la hace desaparecer y «vení» la trae de nuevo como estaba. Se activa con el botón «Voz» (pide permiso de micrófono la primera vez). El reconocimiento es EN EL TELÉFONO: lo que se dice no sale del equipo; si al teléfono le falta el español para reconocer sin internet, la app pide descargarlo, y si no lo tiene, queda el botón. El botón «Persona» pasa por camina → quieta → oculta.
- Con el modelo volcado, la sombra quedaba flotando a la altura del volcado: ahora va al piso.
- Apoyado en una superficie, los avisos de seguimiento hablan del entorno y no de "la hoja" (antes decía "Mostrá parte de la mesa junto con la hoja" también sin hoja).
- Arrastrar el modelo en Ajustar sigue respondiendo aunque ARCore corrija el piso unos centímetros (antes se descartaban los toques a más de 3 cm de altura del ancla; una mesa está a más de 40 cm).

Verificación: pruebas nuevas de la persona (mallas, 1,75 m, pies siempre en el piso, largo del paso, recorrido sin saltos alrededor del modelo), del enlace y la descarga desde la PC (solo red local, descarga por partes que se recupera de cortes), de la lectura de Inventor en la PC (el Operario de superficies, 830.323 triángulos en 28 s; un ensamble de 38 piezas en 0,4 s) y del camino completo en el emulador (página de la PC en Chrome → botón → la app abre el ensamble; .ipt compartido → lo lee la PC); más las baterías Java, shaders, puente nativo y compilación de las dos marcas.

Instalar cada APK 4.24.0 sobre la anterior, sin desinstalar.

MS AR y 3DDUT AR 4.23.2

Corrección de la prueba de la 4.23.1 en el teléfono ("anda bastante bien, la sombra se mueve mucho").

- La sombra ya no sigue cada cambio de la estimación de luz de ARCore. Esa estimación depende de lo que ve la cámara y cambia al mover el teléfono aunque las luces del lugar estén quietas, y la sombra se redibujaba hacia otro lado hasta cada 1,5 s (en una simulación de un minuto con la luz quieta: 25 veces). Ahora la dirección de la luz se promedia lentamente, se asienta en los primeros segundos (mientras la app busca la hoja) y después queda fija: la sombra solo cambia si la luz real cambia más de 20° durante 4 s seguidos, o si se gira el modelo.
- Con una luz casi horizontal (una ventana) la sombra ya no salta al lado opuesto: la app invertía la dirección entera cuando el estimado cruzaba el horizonte.
- Si ARCore deja de estimar la luz un momento, la sombra se queda donde estaba en lugar de volver a la posición fija y saltar de nuevo.
- La oscuridad de la sombra (según el contraste de la luz del lugar) se ajusta en unos 3 s en vez de 0,4 s, para que no pulse al mover el teléfono.
- El sombreado del modelo usa la misma dirección estable que la sombra.
- La bitácora del Diagnóstico anota la dirección de la luz principal cuando queda fijada.
- Si ARCore rechaza por un instante el anclaje con el que se busca la hoja (pasa en los primeros cuadros de seguimiento), se saltea ese cuadro sin descartar las lecturas juntadas.

Verificación: prueba nueva de la dirección de la luz (luz quieta con ruido, luz casi horizontal, cambio real sostenido y cambio breve, cortes de la estimación) más las baterías Java, shaders, puente nativo y compilación de las dos marcas.

Instalar cada APK 4.23.2 sobre la anterior, sin desinstalar.

MS AR y 3DDUT AR 4.23.1

Revisión a fondo del anclaje sobre la hoja, a partir del video del 23-sep ("se mueve todo"): el modelo tiene que quedar pegado a la hoja y no mostrarse nunca en un lugar equivocado.

- El modelo se dibuja con la posición real del anclaje en cada cuadro. Hasta la 4.23.0 un filtro suavizaba la posición del anclaje pero no la de la cámara: cuando ARCore corregía su mapa, el modelo se quedaba atrás y parecía deslizarse (una corrección de 10 cm dejaba 8,8 cm de error visible).
- Si el teléfono pierde el seguimiento (cámara tapada, muy cerca de una mesa lisa, movimiento brusco) o la app se pausa, el modelo se oculta y la app pide volver a mostrar la hoja: "Verificando la hoja. Mostrá el QR y parte de la mesa". Recuperar el seguimiento no alcanza; el modelo vuelve recién cuando la hoja se vio de nuevo y quedó comprobada, y conserva los ajustes hechos con Ajustar (desplazamientos, giro y volcado).
- Con el modelo pegado a la imagen impresa, la lectura del QR ya no lo mueve: antes las dos mediciones podían turnarse para corregirlo y el modelo iba y venía unos milímetros. El QR se usa para ubicar, para recuperar la hoja tras una pérdida y cuando ARCore no reconoce la imagen. Si la hoja se ubicó por el QR y después ARCore reconoce la imagen de lleno, el anclaje se pega a la imagen aunque la diferencia sea chica.
- Al fijar ya no se reconfigura la sesión de ARCore, lo que podía reiniciar el reconocimiento de la hoja justo al pegar el anclaje.
- Un fallo puntual de ARCore al leer la hoja ya no cierra la vista AR: se pierde ese cuadro y sigue.
- El botón Fijar se ve apagado mientras no hay nada fijado (antes parecía activo y no respondía).
- El estado distingue "Fijado a la hoja · referencia visible" de "Fijado · seguimiento del entorno". La bitácora del Diagnóstico anota las pérdidas y recuperaciones y, mientras busca la hoja, cada 5 s si ARCore reconoce la imagen, el tamaño del QR y por qué todavía no hay posición.

Verificación: baterías Java del módulo nativo (registro de la hoja con cambios del mapa, pérdida y recuperación, y qué medición manda), reconstrucción del QR, shaders, regresiones del núcleo, puente nativo y compilación release de las dos marcas. En el emulador la app lee el QR de la hoja sobre una mesa virtual, pero el emulador no sostiene el seguimiento de ARCore; la prueba de perder el seguimiento y volver a la hoja se hace en el teléfono.

Instalar cada APK 4.23.1 sobre la anterior, sin desinstalar.

MS AR y 3DDUT AR 4.23.0

Corrección a partir del video del 23-sep ("se mueve todo"): el modelo fijado a la hoja quedaba corrido y a la deriva después de que el teléfono perdiera el seguimiento.

- El anclaje sobre la hoja queda pegado a la imagen impresa. Al ubicar por el QR, ARCore reconoce la hoja entera y el anclaje del modelo se crea sobre esa imagen, no sobre un punto suelto del mundo, y la app sigue rastreando la imagen con el modelo ya fijado (hasta ahora se apagaba al fijar, para ahorrar trabajo). Si el seguimiento se pierde, por ejemplo al acercar la cámara a 10 cm de una mesa lisa, y vuelve en un marco corrido, basta con volver a mirar el QR: ARCore realinea el anclaje solo y el modelo vuelve a la hoja. En el video, a los 41 s la app recuperó el seguimiento con el QR a la vista pero ya no lo miraba, y el modelo se fue deslizando fuera de la hoja.
- Si la hoja se había ubicado por la reconstrucción del QR (cuando ARCore no reconoce la imagen) y más tarde ARCore la reconoce de lleno, el anclaje pasa a la imagen en ese momento, conservando los ajustes hechos.
- El mensaje mientras se recupera el anclaje sobre la hoja ahora dice qué hacer: "Apuntá al QR de la hoja para volver a alinearla".
- La bitácora del Diagnóstico anota cuándo el anclaje pasa a la imagen y cada corrección de más de 2 cm que ARCore le aplique (a lo sumo una por 2 s), para ver en el teléfono cuánto se corrigió y cuándo.

Verificación: compilación y baterías Java del módulo nativo, puente nativo, regresiones del núcleo, suites de navegador y, en el emulador, la vista AR sobre la hoja abierta con el plano de la Calculadora (base de imágenes activa en las dos configuraciones). El realineo con la hoja real queda para el teléfono: perder el seguimiento a propósito acercándose a la mesa y volver a mirar el QR.

Instalar cada APK 4.23.0 sobre la anterior, sin desinstalar.


MS AR y 3DDUT AR 4.22.0

A partir del Diagnóstico del teléfono del 23-sep: el STL grande recibido por WhatsApp se abre igual, y la bitácora dice hacia dónde apunta la hoja en pantalla.

- STL grande reducido en el teléfono. Un STL de más de 40 MB recibido por Abrir con o Compartir (la figura del operario pesa 327 MB) ya no se rechaza: la app lo lee por pasadas desde la aplicación que lo mandó, sin copiarlo entero, agrupa los vértices por celda de una rejilla como hace Preparar_OBJ_para_AR en la PC y abre el resultado de unas 110.000 caras con sombreado suave y aristas negras. El avance se ve en la línea de estado ("pasada 2: 84.000 caras") y el resultado queda en el Diagnóstico. Vale para STL binario y de texto. Sin colores (un STL no los trae); un OBJ de más de 150 MB sigue pidiendo la PC.
- Ejes de la hoja en pantalla. Al anclar sobre el plano impreso, la bitácora de la vista AR anota además hacia dónde apuntan en pantalla el +X y el +Z de la hoja (derecha y arriba). Con el teléfono sobre la hoja en posición de lectura se espera +X hacia la derecha y +Z hacia abajo; si sale al revés, el corrimiento del modelo sobre el plano está en el anclaje y no en el archivo.

Verificación: 9 baterías Java del módulo nativo (nueva: STL binario de 320.000 triángulos reducido a menos de 110.000 caras en pocas pasadas, tope chico, tamaño desconocido, STL de texto entero, archivos truncados o vacíos rechazados), 44 regresiones del núcleo y service worker, 56 comprobaciones del puente nativo, suites de navegador, compilación de ambas marcas y, en el emulador, un STL de 60 MB recibido por Abrir con, reducido y abierto.

Instalar cada APK 4.22.0 sobre la anterior, sin desinstalar.


MS AR y 3DDUT AR 4.21.0

Segunda vuelta de calidad sobre la 4.20.0 (probada en el teléfono): oclusión más limpia, sombra según la luz real, aristas con grosor de pantalla y el preparador de la PC más rápido.

- Oclusión por paredes con bordes suaves. La visibilidad de cada punto del modelo se promedia en cinco muestras del mapa de profundidad y se aplica como transparencia gradual en vez de un corte seco: el borde del modelo contra una pared, una columna o una persona deja de verse a bloques. Solo actúa con Paredes: ON.
- Sombra según la luz real. Con la estimación de luz de ARCore, la sombra se proyecta del lado opuesto a la luz principal del lugar (no siempre hacia el mismo lado) y es más marcada cuanto más contraste tiene el ambiente (sol de ventana) y más tenue si la luz es difusa. Se recalcula a lo sumo cada 1,5 s y solo si la luz giró más de unos 7°, sin sacar la sombra anterior mientras tanto. Sin estimación de luz, la sombra de siempre.
- Aristas con grosor según la pantalla. Las líneas negras se dibujan de unos 2 píxeles físicos en cualquier teléfono (antes 1,5 píxeles del buffer, que a resolución completa quedaban finas). Si la GPU solo dibuja líneas de 1 píxel queda en 1; el grosor elegido se anota en el Diagnóstico.
- Preparar_OBJ_para_AR.bat lee los archivos grandes una sola vez. Un ensamble de Inventor de más de 60 MB se reducía releyendo el archivo entero en cada intento (hasta 14 pasadas sobre un OBJ de 1 GB). Ahora se lee una vez y se reduce en memoria con numpy (ya está en el Python de la PC de Innovación; sin numpy sigue el camino anterior). Un OBJ de 288.000 caras: de 4,4 a 1,7 s; en archivos de 1 GB la diferencia es de minutos.

Verificación: 44 regresiones del núcleo y service worker, 56 comprobaciones del puente nativo, 8 baterías Java del módulo nativo (9.000 aserciones), 18 pruebas del preparador (nueva: los dos caminos del archivo grande dan las mismas caras, materiales y vidrios), shaders compilados y enlazados en WebGL, compilación de ambas marcas y la vista AR nativa abierta en el emulador con ARCore. La oclusión suave, la sombra según la luz y el grosor de aristas con cámara real quedan para el teléfono.

Instalar cada APK 4.21.0 sobre la anterior, sin desinstalar.


MS AR y 3DDUT AR 4.20.0

Revisión de calidad y velocidad de la vista AR nativa y de la carga de modelos, sobre la base 4.19.6. Se conservan Abrir con, Volcar y Ladear, Ubicar, Ajustar y Fijar, aristas negras, sombras, texturas, oclusión y Foto.

- Vista AR a la resolución de la pantalla. La cámara y el modelo se dibujaban en una superficie fija de 1,2 millones de píxeles (en una pantalla de 1080x2400 es menos de la mitad) y se veían borrosos. Ahora arranca a la resolución real (hasta 2,6 Mpx). Si el teléfono no sostiene los cuadros con el modelo puesto (más de 42 ms por cuadro durante 3 s), baja sola un escalón (1,8 y después 1,2 Mpx) y lo anota en el Diagnóstico. Las fotos de la vista AR salen a esa resolución.
- Antialias de 4 muestras (antes 2): las aristas negras y los contornos dejan de verse dentados. Si la GPU no lo ofrece, cae a 2.
- Luz del ambiente real. ARCore estima la dirección de la luz principal, su tinte, el ambiente y el contraste del lugar, y el modelo se sombrea con eso: los brillos y las sombras del sombreado caen del lado de donde viene la luz, un galpón con ventanas al sol tiene más contraste que una oficina difusa, y el tinte de la luz (cálido o frío) se traslada al modelo, acotado. El brillo total es el mismo de antes, así que un ambiente oscuro no apaga el modelo, y la estimación se suaviza para que no titile. En teléfonos sin estimación de luz todo sigue como en 4.19.
- El modelo pasa a la vista AR con la mitad de datos y sin parsear. Cada vértice viaja en 20 bytes en vez de 36 (normal y color en bytes) y el bloque binario va por tandas a un archivo de la aplicación antes de abrir la vista; la vista lo lee derecho al motor gráfico. Antes el modelo entero era un JSON de hasta 20 MB que Android copiaba y parseaba varias veces justo al abrir la cámara. Con maquetas grandes la vista abre antes, con menos memoria y menos riesgo de que el sistema cierre la aplicación. La web de esta versión necesita la APK 4.20 (avisa si la APK instalada es anterior).
- Carga de OBJ y STL grandes de 2 a 4 veces más rápida. Las tres pasadas pesadas (agrupar vértices al simplificar, normales suaves y aristas) identificaban cada punto con un texto "x,y,z" en un mapa; ahora usan una tabla de enteros. El lector de OBJ ya no parte cada línea con expresiones regulares, los decimales simples se convierten sin crear texto y las normales evitan las funciones trigonométricas lentas. Medido en la PC con un ensamble sintético como los de Inventor (node tests/bench_carga.cjs): 800.000 caras de 1,7 a 0,4 s, 300.000 de 0,7 a 0,3 s y 100.000 de 0,33 a 0,15 s; en el teléfono la proporción es la misma.
- ARCore recibe la geometría de pantalla solo cuando cambia (antes en cada cuadro) y la app borra al abrir los archivos de modelo que hayan quedado de una sesión cortada.

Verificación: 44 regresiones del núcleo y service worker, 56 comprobaciones del puente nativo con el esquema nuevo (blob por tandas, normales y colores en bytes, tinte horneado), 8 baterías Java del módulo nativo (9.000 aserciones), los shaders nuevos compilados y enlazados en WebGL, suites de navegador, compilación de ambas marcas y la vista AR nativa abierta en el emulador con ARCore (transferencia por archivo, luz del ambiente configurada, sin errores de GL). La nitidez, el antialias y la luz del ambiente con cámara real quedan para el teléfono.

Instalar cada APK 4.20.0 sobre la anterior, sin desinstalar.


MS AR y 3DDUT AR 4.19.6

El modelo de la Calculadora también se ve como un dibujo de Inventor.

- Aristas negras en la red de conductería. El JSON de la Calculadora se arma pieza por pieza (tubos, codos, bridas, válvulas, cajas) y no pasaba por el mismo camino que el OBJ y el STL, así que salía sin aristas. Ahora, al armar la red, se calculan las aristas sobre las piezas ya armadas con el mismo método rápido y el mismo presupuesto (24°, hasta el 10 % de las caras, las más vivas): quedan marcados los bordes de bridas, codos, reducciones, válvulas y máquinas. Viajan a la vista AR nativa como líneas negras, igual que en el OBJ. La grilla, las etiquetas, la referencia y las cajas de alambre no suman aristas.

Verificación: 44 regresiones del núcleo (nueva: la red de demostración trae aristas negras dentro del presupuesto), 54 del puente nativo (nueva: las aristas de la red llegan al nativo como lotes de líneas negras), suites de navegador y compilación de ambas marcas.

Instalar cada APK 4.19.6 sobre la anterior, sin desinstalar.


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
