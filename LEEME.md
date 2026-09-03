# MS AR — Realidad Aumentada en obra (Metalúrgica Sarmiento)

    ms-ar/
    ├── index.html      <- la app (interfaz MS)
    ├── ar-core.js      <- NÚCLEO compartido con 3DDUT AR (se copia desde ..\_core\ con sincronizar_core.py)
    ├── three.min.js    <- three r160 (UMD)
    ├── sw.js · manifest.json · icon-*.png · fonts/ · img/
    └── ductos/         <- redirección de la app vieja "AR Conductería" (se auto-desinstala)

## Qué abre
- **OBJ** (Inventor, PlanObra, cualquier CAD). Con `v x y z r g b` trae los colores adentro; con
  `usemtl` colorea por material (y se puede cargar el `.mtl` aparte). En la PC:
  `..\Preparar_OBJ_para_AR.bat` deja un OBJ único con colores y liviano.
- **JSON** del botón AR de la Calculadora de Aspiración (`formato: MS_ASPIRACION_RED`).

## Publicar
Commit + push a `main` (GitHub Pages desde /(root)). La URL no cambia:
https://rodrigodutruel-prog.github.io/ms-ar/
En el celu: Chrome → menú ⋮ → Instalar aplicación.
