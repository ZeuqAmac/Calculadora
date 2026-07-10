# 🪚 Calculadora de Carpintería

PWA (aplicación web instalable) para cálculos de medidas en carpintería:
aritmética con **fracciones de pulgada** y conversión al **sistema métrico**,
sin conexión y con todas las funciones desbloqueadas.

## Funciones

- **Calculadora de fracciones**: suma, resta, multiplica y divide medidas como
  `3 1/2″ + 5/8″`. Todo se calcula con aritmética exacta de fracciones (sin
  errores de redondeo acumulados) y el resultado se muestra como fracción de
  pulgada **y** en mm/cm/m a la vez.
- **Unidades mezcladas**: puedes sumar `30 cm + 2 1/2 pulg` directamente.
- **Áreas y volúmenes**: multiplicar dos longitudes da pulg²/cm²/m²; tres dan
  volumen con **pies tablares** incluidos.
- **Precisión configurable**: redondeo a 1/8, 1/16, 1/32 o 1/64, siempre
  indicando el error de redondeo en mm.
- **Conversor** métrico ↔ pulgadas fraccionarias (con fracción más cercana).
- **Pies tablares**: volumen de madera y costo estimado por pie tablar.
- **Espaciado uniforme**: balaustres, estantes, etc., considerando el espesor
  de cada pieza, con tabla de posiciones de marcado.
- **Triángulo / escuadra**: diagonal por Pitágoras, ángulo y pendiente, y
  verificación de escuadra con tolerancia.
- **Historial**: los cálculos se guardan en el dispositivo y se pueden
  reutilizar con un toque.
- **Offline**: una vez instalada funciona sin internet (service worker).

## Cómo publicarla (GitHub Pages)

1. En GitHub: **Settings → Pages → Source: GitHub Actions**.
2. En la pestaña **Actions**, ejecuta el workflow `Publicar en GitHub Pages`
   con el botón **Run workflow** (después se ejecutará solo en cada push a
   `main` o a esta rama).
3. La app quedará en `https://<tu-usuario>.github.io/<repositorio>/`.

## Cómo instalarla en Android

1. Abre la URL de la app en **Chrome** en tu teléfono.
2. Menú ⋮ → **Agregar a pantalla de inicio** (o el aviso "Instalar app").
3. Se instala como una app normal: icono propio, pantalla completa y
   funcionamiento sin conexión.

> ¿APK real? Esta PWA puede empaquetarse como APK/AAB con
> [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) (Trusted Web
> Activity) usando la URL de GitHub Pages, por si algún día quieres subirla a
> Play Store. Para uso personal, la instalación desde Chrome es equivalente.

## Desarrollo

Sin dependencias ni build: HTML + CSS + JavaScript puro. Para probar en local:

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

Los tests del motor de fracciones están en `test/engine.test.mjs`:

```bash
node test/engine.test.mjs
```
